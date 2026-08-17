import type { MailMessage } from '../types.js';

export interface AgentLocalClientConfig {
  baseUrl?: string;
  agentId: string;
}

export type AgentMeshClientConfig = AgentLocalClientConfig;

export class AgentLocalClient {
  public readonly baseUrl: string;
  public readonly agentId: string;

  constructor(config: AgentLocalClientConfig) {
    this.baseUrl = (config.baseUrl || 'http://localhost:3300').replace(/\/$/, '');
    this.agentId = config.agentId;
  }

  /**
   * Send a message to another agent or broadcast (*).
   * Supports string payloads up to 10MB.
   */
  public async send(to: string, body: string): Promise<MailMessage> {
    const res = await fetch(`${this.baseUrl}/api/mail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: this.agentId,
        to,
        body,
      }),
    });

    const json = (await res.json()) as { success: boolean; message?: MailMessage; error?: string };
    if (!res.ok || !json.success || !json.message) {
      throw new Error(`Failed to send mail: ${json.error || res.statusText}`);
    }

    return json.message;
  }

  /**
   * Check inbox for messages addressed to this agent identity.
   */
  public async checkInbox(): Promise<MailMessage[]> {
    const encodedId = encodeURIComponent(this.agentId);
    const res = await fetch(`${this.baseUrl}/api/mail?agentId=${encodedId}`);

    const json = (await res.json()) as { success: boolean; messages?: MailMessage[]; error?: string };
    if (!res.ok || !json.success || !json.messages) {
      throw new Error(`Failed to check inbox: ${json.error || res.statusText}`);
    }

    return json.messages;
  }

  /**
   * Cancel/recall a sent message (or all sent messages by this agent).
   * Note: Only the sender can cancel sent messages; recipients cannot delete received mail.
   */
  public async cancelSent(messageId?: number): Promise<number> {
    const params = new URLSearchParams({ from: this.agentId });
    if (messageId !== undefined && messageId !== null && !isNaN(messageId)) {
      params.append('id', String(messageId));
    }
    const res = await fetch(`${this.baseUrl}/api/mail?${params.toString()}`, {
      method: 'DELETE',
    });

    const json = (await res.json()) as { success: boolean; cancelledCount?: number; error?: string };
    if (!res.ok || !json.success) {
      throw new Error(`Failed to cancel sent message: ${json.error || res.statusText}`);
    }

    return json.cancelledCount || 0;
  }
}

// Alias for backward compatibility
export const AgentMeshClient = AgentLocalClient;
