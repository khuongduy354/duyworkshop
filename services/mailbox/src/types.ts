export type MailboxType = 'public' | 'pin';

export interface Mailbox {
  id: string;
  type: MailboxType;
  pin?: string;
  maxMessages: number;
  createdAt: number;
  expiresAt: number;
}

export interface Message {
  id: string;
  content: string;
  createdAt: number;
}

export interface Config {
  port: number;
  dbPath: string;
  cleanupInterval: number;
  maxMailboxes: number;
  defaultTtl: number;
  maxMessagesPerMailbox: number;
  maxMessageLength: number;
  rateLimitMax: number;
  rateLimitWindow: number;
}
