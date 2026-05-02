import { NextResponse } from 'next/server'
import { getMailbox, deleteMailbox } from '@/lib/db'

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
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

  const deleted = await deleteMailbox(id)
  if (deleted) {
    return NextResponse.json({ message: 'Mailbox deleted' })
  } else {
    return NextResponse.json({ error: 'Failed to delete mailbox' }, { status: 500 })
  }
}
