import { createApp } from './server/app.js';
import { CONFIG } from './config.js';

export function startServer(port: number = CONFIG.PORT, host: string = CONFIG.HOST) {
  const app = createApp();

  console.log(`
┌────────────────────────────────────────────────────────┐
│  ⚡ AGENT LOCAL MAILER - SHARED INBOX & TURN HOOKS      │
├────────────────────────────────────────────────────────┤
│  📡 Server running at: http://${host}:${port}          │
│  📬 Web Dashboard:     http://localhost:${port}            │
│  💾 Database Path:     ${CONFIG.DB_PATH}       │
│  📦 Max Body Payload:  10 MB                           │
└────────────────────────────────────────────────────────┘
`);

  return Bun.serve({
    fetch: app.fetch,
    port,
    hostname: host,
  });
}

// Auto-start if executed directly
if (import.meta.main) {
  startServer();
}

export { createApp };
export * from './types.js';
export * from './db/mail-store.js';
export * from './sdk/index.js';
