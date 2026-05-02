import type { Mailbox, Message } from './types';

export interface IDatabase {
  createMailbox(id: string, type: 'public' | 'pin', pin: string | undefined, maxMessages: number, ttl: number): Promise<string>;
  getMailbox(id: string): Promise<Mailbox | null>;
  getMailboxCount(): Promise<number>;
  createMessage(mailboxId: string, content: string): Promise<string>;
  getMessageCount(mailboxId: string): Promise<number>;
  getMessages(mailboxId: string): Promise<Message[]>;
  cleanupExpired(): Promise<number>;
  deleteMailbox(id: string): Promise<boolean>;
  close(): void;
}

class BetterSqliteDatabase implements IDatabase {
  private db: any;

  constructor(private dbPath: string) {
    const Database = require('better-sqlite3');
    const fs = require('fs');
    const path = require('path');

    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    this.db.exec(`
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
  }

  async createMailbox(id: string, type: 'public' | 'pin', pin: string | undefined, maxMessages: number, ttl: number): Promise<string> {
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO mailboxes (id, type, pin, max_messages, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, type, pin || null, maxMessages, now, now + ttl * 1000);
    return id;
  }

  async getMailbox(id: string): Promise<Mailbox | null> {
    const stmt = this.db.prepare('SELECT * FROM mailboxes WHERE id = ?');
    const row = stmt.get(id);
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

  async getMailboxCount(): Promise<number> {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM mailboxes');
    const row = stmt.get();
    return row.count;
  }

  async createMessage(mailboxId: string, content: string): Promise<string> {
    const id = Math.random().toString(36).substring(2);
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO messages (id, mailbox_id, content, created_at)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(id, mailboxId, content, now);
    return id;
  }

  async getMessageCount(mailboxId: string): Promise<number> {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM messages WHERE mailbox_id = ?');
    const row = stmt.get(mailboxId);
    return row.count;
  }

  async getMessages(mailboxId: string): Promise<Message[]> {
    const stmt = this.db.prepare('SELECT * FROM messages WHERE mailbox_id = ? ORDER BY created_at ASC');
    const rows = stmt.all(mailboxId);
    return rows.map((row: any) => ({
      id: row.id,
      content: row.content,
      createdAt: row.created_at,
    }));
  }

  async cleanupExpired(): Promise<number> {
    const now = Date.now();
    const stmt = this.db.prepare('DELETE FROM mailboxes WHERE expires_at < ?');
    const info = stmt.run(now);
    return info.changes;
  }

  async deleteMailbox(id: string): Promise<boolean> {
    const stmt = this.db.prepare('DELETE FROM mailboxes WHERE id = ?');
    const info = stmt.run(id);
    return info.changes > 0;
  }

  close(): void {
    this.db?.close();
  }
}

let dbInstance: IDatabase | null = null;

export function initDb(dbPath: string): IDatabase {
  if (!dbInstance) {
    dbInstance = new BetterSqliteDatabase(dbPath);

    const db = dbInstance as IDatabase;
    setInterval(async () => {
      const deleted = await db.cleanupExpired();
      if (deleted > 0) console.log(`[${new Date().toISOString()}] Cleaned up ${deleted} expired mailboxes`);
    }, parseInt(process.env.CLEANUP_INTERVAL || '3600000'));
  }
  return dbInstance as IDatabase;
}
