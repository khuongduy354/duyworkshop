# Mailbox Service Implementation Plan

## Context

Implement a message passing service for free hosting on Render.com. Two mailbox types:
1. **Public**: anyone can read and write (no auth)
2. **PIN-protected**: anyone can write, but reading requires correct PIN

Key constraints: SQLite, TypeScript/Node.js, auto-cleanup, resource limits via env vars.

## Assumptions

- Rate limiting added (10 req/min per IP) to prevent spam
- Using nanoid for readable mailbox IDs
- Interval-based cleanup (every hour by default)
- Render's IaC blueprint uses `render.yaml` format
- No frontend needed - API only
- In-memory rate limiting (resets on server restart - acceptable for free tier)

## Success Criteria

1. `npm run dev` starts server without errors
2. POST `/mailbox` creates a public or PIN mailbox
3. POST `/mailbox/:id/message` accepts messages
4. GET `/mailbox/:id/messages` returns messages (with PIN check for protected boxes)
5. Expired mailboxes auto-delete (verify with DB query after TTL)
6. `render.yaml` deploys to Render successfully
7. Rate limiting blocks excessive requests

## Implementation

### File Structure (simplified)

```
duyworkshop/
├── src/
│   ├── index.ts          # Express app, entry point
│   ├── db.ts             # SQLite setup + schema
│   ├── types.ts          # TypeScript interfaces
│   ├── rate-limit.ts     # In-memory rate limiting
│   └── routes.ts         # All API handlers
├── database/             # SQLite created at runtime
├── package.json
├── tsconfig.json
├── render.yaml
└── .env.example
```

Rationale: Single-file modules reduce complexity. Only split when justified.

### Critical Files

**1. `src/types.ts`** - All interfaces
```typescript
export type MailboxType = 'public' | 'pin';

export interface Mailbox {
  id: string;
  type: MailboxType;
  pin?: string;  // undefined for public
  expiresAt: number;
}

export interface Message {
  id: string;
  content: string;
  createdAt: number;
}
```

**2. `src/rate-limit.ts`** - Simple in-memory rate limiting
```typescript
const ipMap = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(ip: string, max: number = 10, window: number = 60000): boolean {
  const now = Date.now();
  const entry = ipMap.get(ip);

  if (!entry || now > entry.resetAt) {
    ipMap.set(ip, { count: 1, resetAt: now + window });
    return true;
  }

  if (entry.count >= max) return false;
  entry.count++;
  return true;
}
```

**3. `src/db.ts`** - Database connection + schema + operations
```typescript
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

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

// All DB operations as simple functions - no classes
export function createMailbox(db: Database, data: any): string { /* ... */ }
export function getMailbox(db: Database, id: string): any { /* ... */ }
export function createMessage(db: Database, mailboxId: string, content: string): string { /* ... */ }
export function getMessages(db: Database, mailboxId: string): Message[] { /* ... */ }
export function cleanupExpired(db: Database): number { /* ... */ }
```

**4. `src/routes.ts`** - Express route handlers
```typescript
import express, { Request, Response } from 'express';
import { nanoid } from 'nanoid';
import * as db from './db';

export function createRoutes(app: express.Application, db: Database.Database, config: any) {
  // POST /mailbox
  app.post('/mailbox', (req: Request, res: Response) => {
    const { type, pin, ttl } = req.body;
    // Validation, then create
  });

  // GET /mailbox/:id/messages
  app.get('/mailbox/:id/messages', (req: Request, res: Response) => {
    // PIN check if needed, return messages
  });

  // POST /mailbox/:id/message
  app.post('/mailbox/:id/message', (req: Request, res: Response) => {
    // Validate mailbox, create message
  });
}
```

**5. `src/index.ts`** - Entry point with cleanup interval
```typescript
import express from 'express';
import { initDb, cleanupExpired } from './db';
import { createRoutes } from './routes';
import { checkRateLimit } from './rate-limit';

const config = {
  port: parseInt(process.env.PORT || '3000'),
  dbPath: process.env.DB_PATH || './database/mailbox.db',
  cleanupInterval: parseInt(process.env.CLEANUP_INTERVAL || '3600000'),
  maxMailboxes: parseInt(process.env.MAX_MAILBOXES || '1000'),
  defaultTtl: parseInt(process.env.DEFAULT_TTL || '86400'),
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '10'),
  rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '60000'),
};

const db = initDb(config.dbPath);
const app = express();
app.use(express.json());

// Rate limiting middleware
app.use((req, res, next) => {
  const ip = req.ip || 'unknown';
  if (!checkRateLimit(ip, config.rateLimitMax, config.rateLimitWindow)) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }
  next();
});

createRoutes(app, db, config);

// Cleanup interval
setInterval(() => {
  const deleted = cleanupExpired(db);
  if (deleted > 0) console.log(`Cleaned up ${deleted} expired mailboxes`);
}, config.cleanupInterval);

app.listen(config.port, () => {
  console.log(`Server on port ${config.port}`);
});
```

**6. `render.yaml`** - Render.com blueprint
```yaml
services:
  - type: web
    name: mailbox-service
    env: node
    plan: free
    buildCommand: npm install && npm run build
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 3000
      - key: DB_PATH
        value: /opt/render/project/database/mailbox.db
      - key: DEFAULT_TTL
        value: 86400
      - key: RATE_LIMIT_MAX
        value: 10
      - key: RATE_LIMIT_WINDOW
        value: 60000
    disk:
      name: mailbox-data
      mountPath: /opt/render/project/database
      sizeGB: 1
```

**7. `package.json`**
```json
{
  "name": "mailbox-service",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "ts-node src/index.ts"
  },
  "dependencies": {
    "better-sqlite3": "^9.0.0",
    "express": "^4.18.2",
    "nanoid": "^5.0.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.0",
    "@types/express": "^4.17.0",
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0",
    "ts-node": "^10.9.0"
  }
}
```

### Environment Variables (.env.example)
```
PORT=3000
DB_PATH=./database/mailbox.db
CLEANUP_INTERVAL=3600000
MAX_MAILBOXES=1000
DEFAULT_TTL=86400
RATE_LIMIT_MAX=10
RATE_LIMIT_WINDOW=60000
```

## Implementation Steps

1. Create `package.json` → verify: `npm install` works
2. Create `tsconfig.json` → verify: `tsc --init` settings
3. Create `src/types.ts` → verify: type checks pass
4. Create `src/rate-limit.ts` → verify: function compiles
5. Create `src/db.ts` with schema → verify: database creates on first run
6. Create `src/routes.ts` with handlers → verify: endpoints compile
7. Create `src/index.ts` with server + cleanup → verify: server starts, cleanup runs
8. Create `render.yaml` → verify: Render blueprint syntax valid
9. Test API manually → verify: all endpoints work as expected

## Testing Checklist

- Create public mailbox → GET messages works without PIN
- Create PIN mailbox → GET messages fails without PIN, succeeds with correct PIN
- POST message to existing mailbox → message appears in GET
- Wait for TTL → mailbox deleted, GET returns 404
- Try creating > MAX_MAILBOXES → returns error
- Long message > limit → returns validation error
- Rate limit → 10+ rapid requests return 429
