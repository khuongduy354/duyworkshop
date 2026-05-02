import { NextResponse } from 'next/server'
import { getMailbox, createMessage, getMessageCount, getMessages, config } from '../../../../../lib/db'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const { id } = params
  const url = new URL(req.url)
  const pin = url.searchParams.get('pin')

  const mailbox = await getMailbox(id)
  if (!mailbox) {
    return NextResponse.json({ error: 'Mailbox not found' }, { status: 404 })
  }

  if (mailbox.type === 'pin') {
    if (!pin || pin !== mailbox.pin) {
      return NextResponse.json({ error: 'Invalid or missing PIN' }, { status: 401 })
    }
  }

  const messages = await getMessages(id)
  return NextResponse.json({
    mailbox: { id: mailbox.id, type: mailbox.type, expiresAt: mailbox.expiresAt },
    messages,
  })
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { id } = params
  const body = await req.json().catch(() => ({}))
  const { content } = body as { content?: string }

  if (!content || typeof content !== 'string') {
    return NextResponse.json({ error: 'Content required' }, { status: 400 })
  }

  if (content.length > config.maxMessageLength) {
    return NextResponse.json({ error: `Message too long. Max ${config.maxMessageLength} characters` }, { status: 400 })
  }

  const mailbox = await getMailbox(id)
  if (!mailbox) {
    return NextResponse.json({ error: 'Mailbox not found' }, { status: 404 })
  }

  const msgCount = await getMessageCount(id)
  if (msgCount >= config.maxMessagesPerMailbox) {
    return NextResponse.json({ error: 'Mailbox full' }, { status: 503 })
  }

  const messageId = await createMessage(id, content)
  return NextResponse.json({
    id: messageId,
    createdAt: Date.now(),
  }, { status: 201 })
}
