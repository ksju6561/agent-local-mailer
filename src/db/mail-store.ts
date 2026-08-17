import { Database } from 'bun:sqlite';
import { getDatabase } from './database.js';
import type { MailMessage, SendMailInput } from '../types.js';

interface RawRow {
  id: number;
  from_agent: string;
  to_agent: string;
  body: string;
  created_at: number;
  read_at: number | null;
}

export class MailStore {
  private db: Database;

  constructor(customDb?: Database) {
    this.db = customDb || getDatabase();
  }

  private mapRow(row: RawRow): MailMessage {
    const readAt = row.read_at !== null && row.read_at !== undefined ? Number(row.read_at) : null;
    return {
      id: Number(row.id),
      from: row.from_agent,
      to: row.to_agent,
      body: row.body,
      createdAt: Number(row.created_at),
      readAt,
      isRead: readAt !== null,
    };
  }

  public sendMessage(input: SendMailInput): MailMessage {
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO messages (from_agent, to_agent, body, created_at, read_at)
      VALUES (?, ?, ?, ?, NULL)
    `);

    const result = stmt.run(input.from, input.to, input.body, now);
    const id = Number(result.lastInsertRowid);

    return {
      id,
      from: input.from,
      to: input.to,
      body: input.body,
      createdAt: now,
      readAt: null,
      isRead: false,
    };
  }

  public getMessages(agentId?: string, markAsRead: boolean = true): MailMessage[] {
    if (agentId) {
      const selectStmt = this.db.prepare(`
        SELECT * FROM messages
        WHERE to_agent = ? OR to_agent = '*'
        ORDER BY created_at ASC
      `);
      const rows = selectStmt.all(agentId) as unknown as RawRow[];

      if (markAsRead && rows.length > 0) {
        const now = Date.now();
        const updateStmt = this.db.prepare(`
          UPDATE messages
          SET read_at = ?
          WHERE (to_agent = ? OR to_agent = '*') AND read_at IS NULL
        `);
        updateStmt.run(now, agentId);
      }

      return rows.map((r) => this.mapRow(r));
    }

    const stmt = this.db.prepare('SELECT * FROM messages ORDER BY created_at DESC');
    const rows = stmt.all() as unknown as RawRow[];
    return rows.map((r) => this.mapRow(r));
  }

  /**
   * Cancel/delete a sent message by sender agent.
   * Recipients CANNOT delete received messages.
   */
  public cancelSentMessage(fromAgent: string, messageId?: number): number {
    if (messageId !== undefined && messageId !== null && !isNaN(messageId)) {
      const stmt = this.db.prepare('DELETE FROM messages WHERE id = ? AND from_agent = ?');
      const result = stmt.run(messageId, fromAgent);
      return Number(result.changes || 0);
    }
    const stmt = this.db.prepare('DELETE FROM messages WHERE from_agent = ?');
    const result = stmt.run(fromAgent);
    return Number(result.changes || 0);
  }

  public getStats(): { total: number; unread: number; read: number } {
    const stmt = this.db.prepare(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN read_at IS NULL THEN 1 END) as unread,
        COUNT(CASE WHEN read_at IS NOT NULL THEN 1 END) as read
      FROM messages
    `);
    const row = stmt.get() as unknown as { total: number; unread: number; read: number };
    return {
      total: Number(row?.total || 0),
      unread: Number(row?.unread || 0),
      read: Number(row?.read || 0),
    };
  }
}
