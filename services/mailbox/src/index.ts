import express from 'express';
import { initDb, cleanupExpired } from './db';
import { createRoutes } from './routes';
import { checkRateLimit, cleanupRateLimit } from './rate-limit';
import type { Config } from './types';

const config: Config = {
  port: parseInt(process.env.PORT || '3000'),
  dbPath: process.env.DB_PATH || './database/mailbox.db',
  cleanupInterval: parseInt(process.env.CLEANUP_INTERVAL || '3600000'),
  maxMailboxes: parseInt(process.env.MAX_MAILBOXES || '1000'),
  defaultTtl: parseInt(process.env.DEFAULT_TTL || '86400'),
  maxMessagesPerMailbox: parseInt(process.env.MAX_MESSAGES_PER_MAILBOX || '100'),
  maxMessageLength: parseInt(process.env.MAX_MESSAGE_LENGTH || '10000'),
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '10'),
  rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '60000'),
};

const db = initDb(config.dbPath);
const app = express();

app.use(express.json());

app.use((req, res, next) => {
  const ip = req.ip || 'unknown';
  if (!checkRateLimit(ip, config.rateLimitMax, config.rateLimitWindow)) {
    return res.status(429).json({ error: 'Rate limit exceeded', retryAfter: Math.floor(config.rateLimitWindow / 1000) });
  }
  next();
});

createRoutes(app, db, config);

setInterval(() => {
  const deleted = cleanupExpired(db);
  if (deleted > 0) console.log(`[${new Date().toISOString()}] Cleaned up ${deleted} expired mailboxes`);
}, config.cleanupInterval);

setInterval(() => {
  cleanupRateLimit();
}, config.rateLimitWindow);

app.listen(config.port, () => {
  console.log(`Mailbox service running on port ${config.port}`);
  console.log(`Database: ${config.dbPath}`);
  console.log(`Cleanup interval: ${config.cleanupInterval}ms`);
  console.log(`Rate limit: ${config.rateLimitMax} req/${config.rateLimitWindow}ms`);
});
