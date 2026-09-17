import { test, describe, beforeAll, afterAll, expect } from 'bun:test';
import { Database } from 'bun:sqlite';
import { MailStore } from '../src/db/mail-store.js';
import { initSchema } from '../src/db/database.js';
import { createApp } from '../src/server/app.js';
import { AgentLocalClient } from '../src/sdk/client.js';

describe('HTTP Server API & Client SDK Tests', () => {
  let db: Database;
  let store: MailStore;
  let server: any;
  const PORT = 3197;
  const baseUrl = `http://127.0.0.1:${PORT}`;

  beforeAll(async () => {
    db = new Database(':memory:');
    initSchema(db);
    store = new MailStore(db);
    const app = createApp(store);

    server = Bun.serve({
      fetch: app.fetch,
      port: PORT,
      hostname: '127.0.0.1',
    });

    await new Promise((r) => setTimeout(r, 50));
  });

  afterAll(() => {
    server.stop(true);
    db.close();
  });

  test('GET /health should return 200 ok with agent-local-mailer', async () => {
    const res = await fetch(`${baseUrl}/health`);
    const json = (await res.json()) as any;
    expect(res.status).toBe(200);
    expect(json.status).toBe('ok');
    expect(json.service).toBe('agent-local-mailer');
  });

  test('AgentLocalClient send, checkInbox, cancelSent lifecycle', async () => {
    const agent1 = new AgentLocalClient({ baseUrl, agentId: 'agent-1' });
    const agent2 = new AgentLocalClient({ baseUrl, agentId: 'agent-2' });

    // Send mail
    const sent = await agent1.send('agent-2', 'Hello from Agent 1');
    expect(sent.id).toBeDefined();
    expect(sent.to).toBe('agent-2');

    // Check inbox
    const messages = await agent2.checkInbox();
    expect(messages.length).toBe(1);
    expect(messages[0].body).toBe('Hello from Agent 1');

    // Recipient attempt to delete via DELETE /api/mail?agentId=agent-2 should fail with 403
    const forbiddenRes = await fetch(`${baseUrl}/api/mail?agentId=agent-2`, { method: 'DELETE' });
    expect(forbiddenRes.status).toBe(403);

    // Sender can cancel sent message
    const cancelled = await agent1.cancelSent(sent.id);
    expect(cancelled).toBe(1);

    const empty = await agent2.checkInbox();
    expect(empty.length).toBe(0);
  });

  test('cursor API returns bounded read-only pages without gaps', async () => {
    for (let index = 0; index < 105; index += 1) {
      store.sendMessage({ from: 'api-pager', to: 'api-paged-agent', body: `page-${index}` });
    }

    const firstRes = await fetch(`${baseUrl}/api/mail?agentId=api-paged-agent&limit=100`);
    const first = (await firstRes.json()) as any;
    expect(firstRes.status).toBe(200);
    expect(first.messages).toHaveLength(100);
    expect(first.page.hasMore).toBe(true);

    const secondRes = await fetch(
      `${baseUrl}/api/mail?agentId=api-paged-agent&limit=100&beforeId=${first.page.nextBeforeId}`,
    );
    const second = (await secondRes.json()) as any;
    expect(second.messages).toHaveLength(5);
    expect(second.page.hasMore).toBe(false);
    expect(new Set([...first.messages, ...second.messages].map((message: any) => message.id)).size).toBe(105);

    const stats = store.getStats();
    expect(stats.unread).toBeGreaterThanOrEqual(105);
  });

  test('cursor API filters by status, text, agent, sender, and recipient', async () => {
    store.sendMessage({ from: 'api-filter-alpha', to: 'api-filter-reviewer', body: 'review needle' });
    store.sendMessage({ from: 'api-filter-beta', to: 'api-filter-worker', body: 'worker message' });

    const agentRes = await fetch(`${baseUrl}/api/mail?agent=FILTER-REVIEWER&status=unread&limit=20`);
    const agent = (await agentRes.json()) as any;
    expect(agentRes.status).toBe(200);
    expect(agent.messages).toHaveLength(1);
    expect(agent.messages[0].from).toBe('api-filter-alpha');

    const combinedRes = await fetch(
      `${baseUrl}/api/mail?q=worker&fromAgent=filter-beta&toAgent=filter-worker&limit=20`,
    );
    const combined = (await combinedRes.json()) as any;
    expect(combined.messages).toHaveLength(1);
    expect(combined.messages[0].to).toBe('api-filter-worker');

    const incompatibleCursorRes = await fetch(`${baseUrl}/api/mail?limit=10&beforeId=2&afterId=1`);
    expect(incompatibleCursorRes.status).toBe(400);
    const tooLongRes = await fetch(`${baseUrl}/api/mail?fromAgent=${'x'.repeat(201)}`);
    expect(tooLongRes.status).toBe(400);
  });
});
