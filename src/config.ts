import path from 'node:path';
import fs from 'node:fs';

export const CONFIG = {
  PORT: Number(process.env.PORT) || 3300,
  HOST: process.env.HOST || '0.0.0.0',
  DB_DIR: process.env.DB_DIR || path.resolve(process.cwd(), 'data'),
  get DB_PATH(): string {
    return process.env.DB_PATH || path.join(this.DB_DIR, 'mailer.db');
  },
  MAX_PAYLOAD_BYTES: 10 * 1024 * 1024, // 10MB max body limit
  MAX_BODY_PREVIEW_LENGTH: 200,
  DEFAULT_PAGE_SIZE: 50,
  MAX_PAGE_SIZE: 500,
};

// Ensure data directory exists
export function ensureDataDir(): void {
  if (!fs.existsSync(CONFIG.DB_DIR)) {
    fs.mkdirSync(CONFIG.DB_DIR, { recursive: true });
  }
}
