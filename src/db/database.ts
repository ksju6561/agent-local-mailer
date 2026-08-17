import { Database } from 'bun:sqlite';
import { CONFIG, ensureDataDir } from '../config.js';

let dbInstance: Database | null = null;

export function getDatabase(dbPath?: string): Database {
  if (!dbInstance) {
    ensureDataDir();
    const resolvedPath = dbPath || CONFIG.DB_PATH;
    dbInstance = new Database(resolvedPath, { create: true });

    dbInstance.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
    `);

    initSchema(dbInstance);
  }
  return dbInstance;
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

export function initSchema(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_agent TEXT NOT NULL,
      to_agent TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      read_at INTEGER
    );
  `);

  // Migration: Ensure read_at exists if DB was created with previous schema
  try {
    db.exec('ALTER TABLE messages ADD COLUMN read_at INTEGER;');
  } catch {
    // Column already exists
  }

  // Create indexes after ensuring columns exist
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_messages_to ON messages(to_agent, created_at ASC);
    CREATE INDEX IF NOT EXISTS idx_messages_read ON messages(read_at);
  `);
}
