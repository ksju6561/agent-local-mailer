import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { MailStore } from '../db/mail-store.js';
import { createMailRouter } from './routes/mail.js';
import { getDashboardHtml } from '../ui/dashboard.js';
import { CONFIG } from '../config.js';

export function createApp(mailStore?: MailStore): Hono {
  const store = mailStore || new MailStore();
  const app = new Hono();

  app.use('*', cors());
  app.use('*', logger());

  app.get('/health', (c) => {
    return c.json({
      status: 'ok',
      service: 'agent-local-mailer',
      maxPayloadBytes: CONFIG.MAX_PAYLOAD_BYTES,
      timestamp: Date.now(),
    });
  });

  app.get('/', (c) => {
    return c.html(getDashboardHtml());
  });

  app.route('/api/mail', createMailRouter(store));

  app.notFound((c) => {
    return c.json({ success: false, error: `Route not found: ${c.req.path}` }, 404);
  });

  app.onError((err, c) => {
    console.error('Server Error:', err);
    return c.json({ success: false, error: err.message || 'Internal Server Error' }, 500);
  });

  return app;
}
