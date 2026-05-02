import { NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import { createMailbox, getMailboxCount, config } from '@/lib/db'

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const { type, pin, ttl } = body as { type?: string; pin?: string; ttl?: string }

  if (type !== 'public' && type !== 'pin') {
    return NextResponse.json({ error: 'Invalid type. Must be "public" or "pin"' }, { status: 400 })
  }

  if (type === 'pin' && !pin) {
    return NextResponse.json({ error: 'PIN required for pin-protected mailbox' }, { status: 400 })
  }

  if (type === 'pin' && pin && pin.length < 4) {
    return NextResponse.json({ error: 'PIN must be at least 4 characters' }, { status: 400 })
  }

  const mailboxTtl = ttl ? Math.min(Math.max(parseInt(ttl), 60), 86400 * 7) : config.defaultTtl

  const currentCount = await getMailboxCount()
  if (currentCount >= config.maxMailboxes) {
    return NextResponse.json({ error: 'Maximum mailboxes reached' }, { status: 503 })
  }

  const id = nanoid(8)
  await createMailbox(id, type, pin, config.maxMessagesPerMailbox, mailboxTtl)

  return NextResponse.json({
    id,
    type,
    expiresAt: Date.now() + mailboxTtl * 1000,
  }, { status: 201 })
}
