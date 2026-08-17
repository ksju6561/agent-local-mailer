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
});
