## Full MVP Plan + Extension Path

---

### What we're building

```
workshop/
├── apps/
│   └── mailbox/            ← your existing app + 1 new file
└── shell/                  ← new Next.js app, 5 files
```

---

### MVP — 4 steps

**Step 1: Add `workshop.adapter.ts` to mailbox** (only change to mailbox)

```ts
// apps/mailbox/workshop.adapter.ts
export const isInsideWorkshop = (): boolean => {
  try {
    return window.parent !== window &&
           (window.parent as any).__WORKSHOP_SHELL__ === true
  } catch { return false }
}

export const initWorkshop = (): void => {
  if (!isInsideWorkshop()) return
  window.parent.postMessage({ type: 'app:ready', appId: 'mailbox' }, '*')
}
```

Call it once in mailbox root layout:

```ts
// apps/mailbox/app/layout.tsx
'use client'
import { useEffect } from 'react'
import { initWorkshop } from '../workshop.adapter'

export default function Layout({ children }) {
  useEffect(() => { initWorkshop() }, [])
  return <>{children}</>
}
```

---

**Step 2: Shell file structure**

```
shell/
├── app/
│   ├── layout.tsx          ← sets __WORKSHOP_SHELL__ = true on window
│   └── page.tsx            ← renders desktop + taskbar
├── components/
│   ├── Window.tsx          ← draggable iframe wrapper (react-rnd)
│   ├── Taskbar.tsx         ← bottom bar, open/close apps
│   └── Desktop.tsx         ← holds open windows, manages state
├── registry.ts             ← list of known apps + their URLs
└── package.json
```

---

**Step 3: Key shell files**

```ts
// shell/registry.ts
export const apps = [
  {
    id: 'mailbox',
    name: 'Mailbox',
    icon: '📬',
    url: process.env.NEXT_PUBLIC_MAILBOX_URL!,
    defaultSize: { width: 720, height: 520 }
  }
]
```

```tsx
// shell/app/layout.tsx
'use client'
import { useEffect } from 'react'

export default function Layout({ children }) {
  useEffect(() => {
    (window as any).__WORKSHOP_SHELL__ = true
  }, [])
  return <>{children}</>
}
```

```tsx
// shell/components/Window.tsx
import { Rnd } from 'react-rnd'

export default function Window({ app, onClose }) {
  return (
    <Rnd default={{ x: 100, y: 80, ...app.defaultSize }} minWidth={400} minHeight={300}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', border: '1px solid #ccc', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ padding: '8px 12px', display: 'flex', justifyContent: 'space-between', background: '#f5f5f5' }}>
          <span>{app.icon} {app.name}</span>
          <button onClick={onClose}>✕</button>
        </div>
        <iframe
          src={app.url}
          style={{ flex: 1, border: 'none', width: '100%' }}
        />
      </div>
    </Rnd>
  )
}
```

```tsx
// shell/components/Desktop.tsx
'use client'
import { useState } from 'react'
import Window from './Window'
import Taskbar from './Taskbar'
import { apps } from '../registry'

export default function Desktop() {
  const [openApps, setOpenApps] = useState<string[]>([])

  const open = (id: string) => setOpenApps(prev => prev.includes(id) ? prev : [...prev, id])
  const close = (id: string) => setOpenApps(prev => prev.filter(a => a !== id))

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      {openApps.map(id => {
        const app = apps.find(a => a.id === id)!
        return <Window key={id} app={app} onClose={() => close(id)} />
      })}
      <Taskbar apps={apps} openApps={openApps} onOpen={open} />
    </div>
  )
}
```

```tsx
// shell/components/Taskbar.tsx
export default function Taskbar({ apps, openApps, onOpen }) {
  return (
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 52, background: '#1a1a1a', display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px' }}>
      {apps.map(app => (
        <button
          key={app.id}
          onClick={() => onOpen(app.id)}
          style={{ opacity: openApps.includes(app.id) ? 1 : 0.5 }}
        >
          {app.icon} {app.name}
        </button>
      ))}
    </div>
  )
}
```

```tsx
// shell/app/page.tsx
import Desktop from '../components/Desktop'

export default function Page() {
  return <Desktop />
}
```

---

**Step 4: Run both together**

```yaml
# docker-compose.dev.yml
services:
  mailbox:
    build: ./apps/mailbox
    ports:
      - "3001:3000"

  shell:
    build: ./shell
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_MAILBOX_URL=http://localhost:3001
```

Or with pnpm workspaces:

```json
// package.json (root)
{
  "scripts": {
    "dev": "pnpm --parallel --filter './apps/*' --filter './shell' dev"
  }
}
```

MVP done. Shell loads, mailbox opens in a window, works standalone at `localhost:3001`.

---

### Extending — Sending a Message from the Desktop Shell

This is where the bus comes in, but kept minimal. Here's the exact pattern:

**How it works:**

```
Shell UI (compose form)
  → postMessage to mailbox iframe
    → mailbox catches it, calls its own API
      → done
```

**1. Mailbox listens for incoming compose events**

Add this to `workshop.adapter.ts` in the mailbox app:

```ts
// apps/mailbox/workshop.adapter.ts

export const initWorkshop = (): void => {
  if (!isInsideWorkshop()) return

  window.parent.postMessage({ type: 'app:ready', appId: 'mailbox' }, '*')

  // listen for shell commands
  window.addEventListener('message', async (e) => {
    if (e.origin !== process.env.NEXT_PUBLIC_SHELL_URL) return  // security

    if (e.data.type === 'mailbox:send') {
      const { mailboxId, content } = e.data.payload

      // call its own API — no coupling to shell's logic
      await fetch(`/api/mailbox/${mailboxId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      })

      // tell shell it's done
      window.parent.postMessage({ type: 'mailbox:sent', success: true }, '*')
    }
  })
}
```

**2. Shell sends the event from a compose widget**

```tsx
// shell/components/QuickCompose.tsx
'use client'
import { useRef, useState } from 'react'

export default function QuickCompose({ mailboxIframeRef }) {
  const [mailboxId, setMailboxId] = useState('')
  const [content, setContent] = useState('')

  const send = () => {
    // post into the mailbox iframe
    mailboxIframeRef.current?.contentWindow?.postMessage({
      type: 'mailbox:send',
      payload: { mailboxId, content }
    }, process.env.NEXT_PUBLIC_MAILBOX_URL)

    setContent('')
  }

  return (
    <div>
      <input value={mailboxId} onChange={e => setMailboxId(e.target.value)} placeholder="Mailbox ID" />
      <textarea value={content} onChange={e => setContent(e.target.value)} />
      <button onClick={send}>Send</button>
    </div>
  )
}
```

**3. Wire the iframe ref in Window.tsx**

```tsx
// shell/components/Window.tsx
import { useRef } from 'react'
import QuickCompose from './QuickCompose'

export default function Window({ app, onClose }) {
  const iframeRef = useRef(null)

  return (
    <Rnd ...>
      <div ...>
        <div ...>{/* title bar */}</div>

        {/* optional shell-level toolbar per app */}
        {app.id === 'mailbox' && (
          <QuickCompose mailboxIframeRef={iframeRef} />
        )}

        <iframe ref={iframeRef} src={app.url} ... />
      </div>
    </Rnd>
  )
}
```

---

### Extension Pattern Summary

Every future cross-shell interaction follows the same 3-step pattern:

```
1. Shell sends:    iframe.contentWindow.postMessage({ type: 'app:action', payload }, appUrl)
2. App handles:    window.addEventListener('message', ...) in workshop.adapter.ts
3. App responds:   window.parent.postMessage({ type: 'app:result', ... }, '*')
```

The mailbox app's core logic never changes. Only `workshop.adapter.ts` grows as you add more shell interactions. The app stays fully standalone because the adapter only activates when `isInsideWorkshop()` is true.
