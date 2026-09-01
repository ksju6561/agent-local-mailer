import { test, describe, beforeAll, afterAll, expect } from 'bun:test';
import { Database } from 'bun:sqlite';
import { MailStore } from '../src/db/mail-store.js';
import { initSchema } from '../src/db/database.js';

describe('MailStore Tests', () => {
  let db: Database;
  let store: MailStore;

  beforeAll(() => {
    db = new Database(':memory:');
    initSchema(db);
    store = new MailStore(db);
  });

  afterAll(() => {
    db.close();
  });

  test('should send mail between agents with unread status', () => {
    const msg = store.sendMessage({
      from: 'agent-a',
      to: 'agent-b',
      body: 'Hello Agent B',
    });

    expect(msg.id).toBeGreaterThan(0);
    expect(msg.from).toBe('agent-a');
    expect(msg.to).toBe('agent-b');
    expect(msg.isRead).toBe(false);
    expect(msg.readAt).toBeNull();
  });

  test('should get messages and track read status', () => {
    const peekMsgs = store.getMessages('agent-b', false);
    expect(peekMsgs.length).toBe(1);
    expect(peekMsgs[0].isRead).toBe(false);

    const readMsgs = store.getMessages('agent-b', true);
    expect(readMsgs.length).toBe(1);

    const stats = store.getStats();
    expect(stats.total).toBe(1);
    expect(stats.read).toBe(1);
    expect(stats.unread).toBe(0);
  });

  test('should allow sender to cancel sent message, but not recipient', () => {
    const msg = store.sendMessage({
      from: 'agent-sender',
      to: 'agent-recipient',
      body: 'Will be cancelled',
    });

    // Recipient cannot cancel (should delete 0 rows when called with wrong sender)
    const failCount = store.cancelSentMessage('agent-recipient', msg.id);
    expect(failCount).toBe(0);

    // Sender can cancel
    const cancelCount = store.cancelSentMessage('agent-sender', msg.id);
    expect(cancelCount).toBe(1);
  });

  test('cursor pages are stable and never mark unread rows', () => {
    for (let index = 0; index < 205; index += 1) {
      store.sendMessage({ from: 'pager', to: 'paged-agent', body: `message-${index}` });
    }

    const first = store.getMessagePage({ agentId: 'paged-agent', limit: 100 });
    expect(first.messages).toHaveLength(100);
    expect(first.hasMore).toBe(true);
    expect(first.messages[0].id).toBeGreaterThan(first.messages[99].id);

    const second = store.getMessagePage({
      agentId: 'paged-agent',
      limit: 100,
      beforeId: first.nextBeforeId!,
    });
    const last = store.getMessagePage({
      agentId: 'paged-agent',
      limit: 100,
      beforeId: second.nextBeforeId!,
    });
    const ids = [...first.messages, ...second.messages, ...last.messages].map((message) => message.id);
    expect(new Set(ids).size).toBe(205);
    expect(last.hasMore).toBe(false);

    const newer = store.sendMessage({ from: 'pager', to: 'paged-agent', body: 'newer' });
    const delta = store.getMessagePage({ agentId: 'paged-agent', limit: 100, afterId: first.latestId! });
    expect(delta.messages.some((message) => message.id === newer.id)).toBe(true);
    expect(store.getStats().unread).toBe(206);
  });
});
