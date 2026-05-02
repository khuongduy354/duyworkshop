import express, { Request, Response } from 'express';
import { nanoid } from 'nanoid';
import type { Config } from './types';
import * as db from './db';

export function createRoutes(app: express.Application, database: any, config: Config) {
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  app.post('/mailbox', (req: Request, res: Response) => {
    const { type, pin, ttl } = req.body;

    if (type !== 'public' && type !== 'pin') {
      return res.status(400).json({ error: 'Invalid type. Must be "public" or "pin"' });
    }

    if (type === 'pin' && !pin) {
      return res.status(400).json({ error: 'PIN required for pin-protected mailbox' });
    }

    if (type === 'pin' && pin && pin.length < 4) {
      return res.status(400).json({ error: 'PIN must be at least 4 characters' });
    }

    const mailboxTtl = ttl ? Math.min(Math.max(parseInt(ttl), 60), 86400 * 7) : config.defaultTtl;

    const currentCount = db.getMailboxCount(database);
    if (currentCount >= config.maxMailboxes) {
      return res.status(503).json({ error: 'Maximum mailboxes reached' });
    }

    const id = nanoid(8);
    db.createMailbox(database, id, type, pin, config.maxMessagesPerMailbox, mailboxTtl);

    res.status(201).json({
      id,
      type,
      expiresAt: Date.now() + mailboxTtl * 1000,
    });
  });

  app.post('/mailbox/:id/message', (req: Request, res: Response) => {
    const { id } = req.params;
    const { content } = req.body;

    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'Content required' });
    }

    if (content.length > config.maxMessageLength) {
      return res.status(400).json({ error: `Message too long. Max ${config.maxMessageLength} characters` });
    }

    const mailbox = db.getMailbox(database, id);
    if (!mailbox) {
      return res.status(404).json({ error: 'Mailbox not found' });
    }

    const msgCount = db.getMessageCount(database, id);
    if (msgCount >= config.maxMessagesPerMailbox) {
      return res.status(503).json({ error: 'Mailbox full' });
    }

    const messageId = db.createMessage(database, id, content);
    res.status(201).json({
      id: messageId,
      createdAt: Date.now(),
    });
  });

  app.get('/mailbox/:id/messages', (req: Request, res: Response) => {
    const { id } = req.params;
    const { pin } = req.query;

    const mailbox = db.getMailbox(database, id);
    if (!mailbox) {
      return res.status(404).json({ error: 'Mailbox not found' });
    }

    if (mailbox.type === 'pin') {
      if (!pin || pin !== mailbox.pin) {
        return res.status(401).json({ error: 'Invalid or missing PIN' });
      }
    }

    const messages = db.getMessages(database, id);
    res.json({
      mailbox: { id: mailbox.id, type: mailbox.type, expiresAt: mailbox.expiresAt },
      messages,
    });
  });

  app.delete('/mailbox/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const { pin } = req.query;

    const mailbox = db.getMailbox(database, id);
    if (!mailbox) {
      return res.status(404).json({ error: 'Mailbox not found' });
    }

    if (mailbox.type === 'pin') {
      if (!pin || pin !== mailbox.pin) {
        return res.status(401).json({ error: 'Invalid or missing PIN' });
      }
    }

    const deleted = db.deleteMailbox(database, id);
    if (deleted) {
      res.json({ message: 'Mailbox deleted' });
    } else {
      res.status(500).json({ error: 'Failed to delete mailbox' });
    }
  });
}
