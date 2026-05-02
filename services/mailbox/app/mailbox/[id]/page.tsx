'use client'

import { useState, useEffect } from 'react'

interface Message {
  id: string
  content: string
  createdAt: number
}

interface MailboxData {
  mailbox: { id: string; type: string; expiresAt: number }
  messages: Message[]
}

export default function MailboxPage({ params }: { params: { id: string } }) {
  const [content, setContent] = useState('')
  const [pin, setPin] = useState('')
  const [mailboxData, setMailboxData] = useState<MailboxData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [isPinProtected, setIsPinProtected] = useState(false)
  const [hasEnteredPin, setHasEnteredPin] = useState(false)

  async function fetchMessages() {
    setError('')
    setLoading(true)

    try {
      const url = new URL(`${window.location.origin}/api/mailbox/${params.id}/messages`)
      if (isPinProtected) {
        url.searchParams.set('pin', pin)
      }

      const res = await fetch(url.toString())

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('Invalid PIN')
        }
        if (res.status === 404) {
          throw new Error('Mailbox not found')
        }
        throw new Error('Failed to fetch messages')
      }

      const data = await res.json()
      setMailboxData(data)
      setIsPinProtected(data.mailbox.type === 'pin')
      setHasEnteredPin(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  async function sendMessage() {
    if (!content.trim()) return

    setError('')

    try {
      const res = await fetch(`/api/mailbox/${params.id}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to send message')
      }

      setContent('')
      fetchMessages()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  async function deleteMailbox() {
    if (!confirm('Delete this mailbox? This cannot be undone.')) return

    try {
      const url = new URL(`${window.location.origin}/api/mailbox/${params.id}`)
      if (isPinProtected) {
        url.searchParams.set('pin', pin)
      }

      const res = await fetch(url.toString(), { method: 'DELETE' })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to delete mailbox')
      }

      window.location.href = '/'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  useEffect(() => {
    if (!isPinProtected || (isPinProtected && pin)) {
      fetchMessages()
    }
  }, [params.id, pin])

  const timeLeft = mailboxData
    ? Math.max(0, Math.floor((mailboxData.mailbox.expiresAt - Date.now()) / 1000 / 60))
    : 0

  if (loading && !mailboxData) {
    return <div className="container">Loading...</div>
  }

  if (isPinProtected && !hasEnteredPin && pin) {
    return (
      <div className="container">
        <h1>Enter PIN</h1>
        {error && <div className="error">{error}</div>}
        <div className="form-group">
          <label htmlFor="pin">PIN</label>
          <input
            id="pin"
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="Enter PIN to view messages"
          />
        </div>
        <button onClick={() => fetchMessages()}>View Messages</button>
      </div>
    )
  }

  return (
    <div className="container">
      <h1>Mailbox: {params.id}</h1>
      {error && <div className="error">{error}</div>}

      {mailboxData && (
        <div className="info">
          Type: {mailboxData.mailbox.type} | Expires in: ~{timeLeft} min
          <button
            onClick={deleteMailbox}
            style={{ float: 'right', padding: '0.5rem 1rem', background: '#ef4444', fontSize: '0.875rem' }}
          >
            Delete
          </button>
        </div>
      )}

      <div className="form-group">
        <label htmlFor="message">Send Message</label>
        <textarea
          id="message"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Type your message..."
          rows={3}
          maxLength={10000}
        />
      </div>
      <button onClick={sendMessage}>Send</button>

      {mailboxData?.messages && mailboxData.messages.length > 0 && (
        <div className="message-list">
          {mailboxData.messages.map((msg) => (
            <div key={msg.id} className="message">
              <div className="message-content">{msg.content}</div>
              <div className="message-time">
                {new Date(msg.createdAt).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}

      {mailboxData?.messages && mailboxData.messages.length === 0 && (
        <div style={{ marginTop: '1.5rem', color: '#94a3b8' }}>No messages yet</div>
      )}
    </div>
  )
}
