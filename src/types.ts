export interface MailMessage {
  id: number;
  from: string;
  to: string;
  body: string;
  createdAt: number;
  readAt?: number | null;
  isRead: boolean;
}

export interface SendMailInput {
  from: string;
  to: string;
  body: string;
}

export interface TurnHookContext {
  agentId?: string;
  turnNumber?: number;
}

export interface TurnHookResult {
  agentId: string;
  messages: MailMessage[];
  hasMessages: boolean;
  unreadCount: number;
}
