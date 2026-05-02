import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ipMap = new Map<string, { count: number; resetAt: number }>()

export function middleware(req: NextRequest) {
  const ip = req.ip || req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
  const max = parseInt(process.env.RATE_LIMIT_MAX || '10')
  const window = parseInt(process.env.RATE_LIMIT_WINDOW || '60000')
  const now = Date.now()

  const entry = ipMap.get(ip)
  if (!entry || now > entry.resetAt) {
    ipMap.set(ip, { count: 1, resetAt: now + window })
    return NextResponse.next()
  }
  if (entry.count >= max) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }
  entry.count++
  return NextResponse.next()
}

export const config = { matcher: '/api/:path*' }
