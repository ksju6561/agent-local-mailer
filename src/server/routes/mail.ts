import { Hono } from 'hono';
import { MailStore } from '../../db/mail-store.js';
import { CONFIG } from '../../config.js';
import type { SendMailInput } from '../../types.js';

export function createMailRouter(mailStore: MailStore): Hono {
  const router = new Hono();

  // POST /api/mail - Send message (from, to, body up to 10MB)
  router.post('/', async (c) => {
    try {
      const body = await c.req.json<SendMailInput>();

      if (!body.from || typeof body.from !== 'string' || body.from.trim() === '') {
        return c.json({ success: false, error: 'Field "from" is required.' }, 400);
      }

      if (!body.to || typeof body.to !== 'string' || body.to.trim() === '') {
        return c.json({ success: false, error: 'Field "to" is required.' }, 400);
      }

      if (body.body === undefined || body.body === null || typeof body.body !== 'string') {
        return c.json({ success: false, error: 'Field "body" is required.' }, 400);
      }

      const bodySize = Buffer.byteLength(body.body, 'utf8');
      if (bodySize > CONFIG.MAX_PAYLOAD_BYTES) {
        return c.json({ success: false, error: 'Payload exceeds 10MB limit.' }, 413);
      }

      const message = mailStore.sendMessage({
        from: body.from.trim(),
        to: body.to.trim(),
        body: body.body,
      });

      return c.json({ success: true, message }, 201);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return c.json({ success: false, error: msg }, 500);
    }
  });

  // GET /api/mail/stats - Get message stats (total, unread, read)
  router.get('/stats', (c) => {
    const stats = mailStore.getStats();
    return c.json({ success: true, stats });
  });

  // GET /api/mail - Check inbox for an agent (?agentId=... or ?to=...)
  router.get('/', (c) => {
    const agentId = c.req.query('agentId') || c.req.query('to') || c.req.query('agent_id');
    const peek = c.req.query('peek') === 'true' || c.req.query('peek') === '1';
    const limitParam = c.req.query('limit');
    const beforeIdParam = c.req.query('beforeId');
    const afterIdParam = c.req.query('afterId');

    if (beforeIdParam && afterIdParam) {
      return c.json({ success: false, error: 'Use either "beforeId" or "afterId", not both.' }, 400);
    }

    const usesCursorPage = limitParam !== undefined || beforeIdParam !== undefined || afterIdParam !== undefined;
    if (usesCursorPage) {
      const limit = limitParam === undefined ? 100 : Number(limitParam);
      const beforeId = beforeIdParam === undefined ? undefined : Number(beforeIdParam);
      const afterId = afterIdParam === undefined ? undefined : Number(afterIdParam);
      if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
        return c.json({ success: false, error: '"limit" must be an integer between 1 and 500.' }, 400);
      }
      if ((beforeId !== undefined && (!Number.isInteger(beforeId) || beforeId < 1))
        || (afterId !== undefined && (!Number.isInteger(afterId) || afterId < 0))) {
        return c.json({ success: false, error: '"beforeId" must be positive and "afterId" non-negative.' }, 400);
      }

      const page = mailStore.getMessagePage({ agentId, limit, beforeId, afterId });
      return c.json({
        success: true,
        agentId: agentId || null,
        count: page.messages.length,
        unreadCount: page.messages.filter((message) => !message.isRead).length,
        messages: page.messages,
        page: {
          limit,
          hasMore: page.hasMore,
          latestId: page.latestId,
          nextBeforeId: page.nextBeforeId,
        },
      });
    }

    // When agentId is given and not peeking, mark as read
    const markAsRead = !peek;
    const messages = mailStore.getMessages(agentId, markAsRead);
    const unreadCount = messages.filter((m) => !m.isRead).length;

    return c.json({
      success: true,
      agentId: agentId || null,
      count: messages.length,
      unreadCount,
      messages,
    });
  });

  // DELETE /api/mail - Cancel sent message(s) by sender agent (Recipients cannot delete)
  router.delete('/', (c) => {
    const fromAgent = c.req.query('from') || c.req.query('from_agent');
    const toAgent = c.req.query('to') || c.req.query('agentId') || c.req.query('agent_id');
    const idParam = c.req.query('id');
    const messageId = idParam ? Number(idParam) : undefined;

    if (!fromAgent && toAgent) {
      return c.json(
        {
          success: false,
          error: 'Received messages cannot be deleted by recipients. Only the sender can cancel/recall sent messages using "from".',
        },
        403
      );
    }

    if (!fromAgent) {
      return c.json(
        {
          success: false,
          error: 'Query parameter "from" (sender agent identity) is required to cancel sent messages.',
        },
        400
      );
    }

    const cancelledCount = mailStore.cancelSentMessage(fromAgent, messageId);
    return c.json({ success: true, from: fromAgent, cancelledCount });
  });

  // DELETE /api/mail/:id - Cancel specific message by ID and sender
  router.delete('/:id', (c) => {
    const id = Number(c.req.param('id'));
    const fromAgent = c.req.query('from') || c.req.query('from_agent');

    if (!fromAgent) {
      return c.json(
        {
          success: false,
          error: 'Query parameter "from" (sender agent identity) is required to cancel sent message.',
        },
        400
      );
    }

    const cancelledCount = mailStore.cancelSentMessage(fromAgent, id);
    if (cancelledCount === 0) {
      return c.json(
        {
          success: false,
          error: 'Message not found or you are not the sender of this message.',
        },
        404
      );
    }

    return c.json({ success: true, id, cancelled: true });
  });

  return router;
}
