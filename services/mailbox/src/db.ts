import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import type { Mailbox, Message } from './types';

export function initDb(dbPath: string): Database.Database {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS mailboxes (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('public', 'pin')),
      pin TEXT,
      max_messages INTEGER DEFAULT 100,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_expires ON mailboxes(expires_at);

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      mailbox_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (mailbox_id) REFERENCES mailboxes(id) ON DELETE CASCADE
    );
  `);

  return db;
}

export function createMailbox(
  db: Database.Database,
  id: string,
  type: 'public' | 'pin',
  pin: string | undefined,
  maxMessages: number,
  ttl: number
): string {
  const now = Date.now();
  const stmt = db.prepare(`
    INSERT INTO mailboxes (id, type, pin, max_messages, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, type, pin || null, maxMessages, now, now + ttl * 1000);
  return id;
}

export function getMailbox(db: Database.Database, id: string): Mailbox | null {
  const stmt = db.prepare('SELECT * FROM mailboxes WHERE id = ?');
  const row = stmt.get(id) as any;
  if (!row) return null;

  return {
    id: row.id,
    type: row.type,
    pin: row.pin || undefined,
    maxMessages: row.max_messages,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

export function getMailboxCount(db: Database.Database): number {
  const stmt = db.prepare('SELECT COUNT(*) as count FROM mailboxes');
  const row = stmt.get() as { count: number };
  return row.count;
}

export function createMessage(db: Database.Database, mailboxId: string, content: string): string {
  const id = Math.random().toString(36).substring(2);
  const now = Date.now();
  const stmt = db.prepare(`
    INSERT INTO messages (id, mailbox_id, content, created_at)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(id, mailboxId, content, now);
  return id;
}

export function getMessageCount(db: Database.Database, mailboxId: string): number {
  const stmt = db.prepare('SELECT COUNT(*) as count FROM messages WHERE mailbox_id = ?');
  const row = stmt.get(mailboxId) as { count: number };
  return row.count;
}

export function getMessages(db: Database.Database, mailboxId: string): Message[] {
  const stmt = db.prepare('SELECT * FROM messages WHERE mailbox_id = ? ORDER BY created_at ASC');
  const rows = stmt.all(mailboxId) as any[];
  return rows.map(row => ({
    id: row.id,
    content: row.content,
    createdAt: row.created_at,
  }));
}

export function cleanupExpired(db: Database.Database): number {
  const now = Date.now();
  const stmt = db.prepare('DELETE FROM mailboxes WHERE expires_at < ?');
  const info = stmt.run(now);
  return info.changes;
}

export function deleteMailbox(db: Database.Database, id: string): boolean {
  const stmt = db.prepare('DELETE FROM mailboxes WHERE id = ?');
  const info = stmt.run(id);
  return info.changes > 0;
}
