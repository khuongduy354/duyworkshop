import { initDb, type IDatabase } from '../src/db'

const dbPath = process.env.DB_PATH || './database/mailbox.db'
const db = initDb(dbPath)

export const dbInstance = db
export { dbPath }

export async function createMailbox(id: string, type: 'public' | 'pin', pin: string | undefined, maxMessages: number, ttl: number): Promise<string> {
  return db.createMailbox(id, type, pin, maxMessages, ttl)
}

export async function getMailbox(id: string): Promise<import('../src/types').Mailbox | null> {
  return db.getMailbox(id)
}

export async function getMailboxCount(): Promise<number> {
  return db.getMailboxCount()
}

export async function createMessage(mailboxId: string, content: string): Promise<string> {
  return db.createMessage(mailboxId, content)
}

export async function getMessageCount(mailboxId: string): Promise<number> {
  return db.getMessageCount(mailboxId)
}

export async function getMessages(mailboxId: string): Promise<import('../src/types').Message[]> {
  return db.getMessages(mailboxId)
}

export async function cleanupExpired(): Promise<number> {
  return db.cleanupExpired()
}

export async function deleteMailbox(id: string): Promise<boolean> {
  return db.deleteMailbox(id)
}

export const config = {
  maxMailboxes: parseInt(process.env.MAX_MAILBOXES || '1000'),
  defaultTtl: parseInt(process.env.DEFAULT_TTL || '86400'),
  maxMessagesPerMailbox: parseInt(process.env.MAX_MESSAGES_PER_MAILBOX || '100'),
  maxMessageLength: parseInt(process.env.MAX_MESSAGE_LENGTH || '10000'),
}
