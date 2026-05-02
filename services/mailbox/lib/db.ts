import { initDb as initDbRaw, createMailbox as createMailboxRaw, getMailbox as getMailboxRaw, getMailboxCount as getMailboxCountRaw, createMessage as createMessageRaw, getMessageCount as getMessageCountRaw, getMessages as getMessagesRaw, cleanupExpired as cleanupExpiredRaw, deleteMailbox as deleteMailboxRaw } from '../src/db'
import type { Mailbox, Message } from '../src/types'

const dbPath = process.env.DB_PATH || './database/mailbox.db'
const db = initDbRaw(dbPath)

export const dbInstance = db
export { dbPath }

export function createMailbox(id: string, type: 'public' | 'pin', pin: string | undefined, maxMessages: number, ttl: number): string {
  return createMailboxRaw(db, id, type, pin, maxMessages, ttl)
}

export function getMailbox(id: string): Mailbox | null {
  return getMailboxRaw(db, id)
}

export function getMailboxCount(): number {
  return getMailboxCountRaw(db)
}

export function createMessage(mailboxId: string, content: string): string {
  return createMessageRaw(db, mailboxId, content)
}

export function getMessageCount(mailboxId: string): number {
  return getMessageCountRaw(db, mailboxId)
}

export function getMessages(mailboxId: string): Message[] {
  return getMessagesRaw(db, mailboxId)
}

export function cleanupExpired(): number {
  return cleanupExpiredRaw(db)
}

export function deleteMailbox(id: string): boolean {
  return deleteMailboxRaw(db, id)
}

export const config = {
  maxMailboxes: parseInt(process.env.MAX_MAILBOXES || '1000'),
  defaultTtl: parseInt(process.env.DEFAULT_TTL || '86400'),
  maxMessagesPerMailbox: parseInt(process.env.MAX_MESSAGES_PER_MAILBOX || '100'),
  maxMessageLength: parseInt(process.env.MAX_MESSAGE_LENGTH || '10000'),
}

setInterval(() => {
  const deleted = cleanupExpired()
  if (deleted > 0) console.log(`[${new Date().toISOString()}] Cleaned up ${deleted} expired mailboxes`)
}, parseInt(process.env.CLEANUP_INTERVAL || '3600000'))
