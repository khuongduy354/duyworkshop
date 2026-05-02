'use client'

import { useState } from 'react'

export default function Home() {
  const [type, setType] = useState<'public' | 'pin'>('public')
  const [pin, setPin] = useState('')
  const [ttl, setTtl] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mailboxId, setMailboxId] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    setMailboxId('')

    try {
      const res = await fetch('/api/mailbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, pin: type === 'pin' ? pin : undefined, ttl: ttl || undefined }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to create mailbox')
      }

      const data = await res.json()
      setMailboxId(data.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container">
      <h1>Create Mailbox</h1>
      {error && <div className="error">{error}</div>}
      {mailboxId && (
        <div className="info">
          Mailbox created!{' '}
          <a href={`/mailbox/${mailboxId}`} style={{ color: '#93c5fd', textDecoration: 'underline' }}>
            Open mailbox
          </a>
        </div>
      )}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Type</label>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="radio"
                name="type"
                checked={type === 'public'}
                onChange={() => setType('public')}
              />
              Public (anyone can read)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="radio"
                name="type"
                checked={type === 'pin'}
                onChange={() => setType('pin')}
              />
              PIN-protected
            </label>
          </div>
        </div>

        {type === 'pin' && (
          <div className="form-group">
            <label htmlFor="pin">PIN</label>
            <input
              id="pin"
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="At least 4 characters"
              required
            />
          </div>
        )}

        <div className="form-group">
          <label htmlFor="ttl">TTL (seconds, optional, max 604800)</label>
          <input
            id="ttl"
            type="number"
            value={ttl}
            onChange={(e) => setTtl(e.target.value)}
            placeholder="Default: 86400 (24 hours)"
            min="60"
            max="604800"
          />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? 'Creating...' : 'Create Mailbox'}
        </button>
      </form>
    </div>
  )
}
