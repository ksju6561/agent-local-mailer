import type { AgentLocalClient } from './client.js';
import type { MailMessage, TurnHookContext, TurnHookResult } from '../types.js';

export interface TurnHookOptions {
  onMessage?: (message: MailMessage, context?: TurnHookContext) => Promise<void> | void;
  onBatch?: (messages: MailMessage[], context?: TurnHookContext) => Promise<void> | void;
  logger?: ((msg: string) => void) | null;
}

export interface AgentTurnHook {
  (context?: TurnHookContext): Promise<TurnHookResult>;
  formatForPrompt: (messages: MailMessage[]) => string;
}

/**
 * Creates a turn-end hook for an agent.
 * Checks the shared inbox whenever the agent completes a turn.
 */
export function createTurnHook(
  client: AgentLocalClient,
  options: TurnHookOptions = {}
): AgentTurnHook {
  const log = options.logger === null ? () => {} : options.logger || console.log;

  const hookFn = async (context?: TurnHookContext): Promise<TurnHookResult> => {
    const agentId = context?.agentId || client.agentId;
    const turnTag = context?.turnNumber !== undefined ? `[Turn #${context.turnNumber}]` : '';

    try {
      const messages = await client.checkInbox();
      const hasMessages = messages.length > 0;
      const unreadCount = messages.filter((m) => !m.isRead).length;

      if (hasMessages) {
        log(`📬 [Agent:${agentId}]${turnTag} Turn-End Hook checked inbox: ${messages.length} message(s) found.`);

        if (options.onBatch) {
          await options.onBatch(messages, context);
        }

        if (options.onMessage) {
          for (const msg of messages) {
            await options.onMessage(msg, context);
          }
        }
      }

      return {
        agentId,
        messages,
        hasMessages,
        unreadCount,
      };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      log(`⚠️ [Agent:${agentId}]${turnTag} Turn-End Hook error: ${errMsg}`);
      return {
        agentId,
        messages: [],
        hasMessages: false,
        unreadCount: 0,
      };
    }
  };

  hookFn.formatForPrompt = (messages: MailMessage[]): string => {
    if (!messages || messages.length === 0) return '';
    const formatted = messages
      .map((m, idx) => `[Message #${idx + 1} from ${m.from}]:\n${m.body}`)
      .join('\n\n');
    return `\n\n--- INCOMING AGENT MESSAGES ---\n${formatted}\n------------------------------\n`;
  };

  return hookFn;
}
