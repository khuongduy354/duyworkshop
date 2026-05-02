import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Mailbox Service',
  description: 'Temporary message passing service',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
