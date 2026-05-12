import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server-admin'

const rangeStart = (range: string) => {
  const now = Date.now()
  if (range === '24h') return new Date(now - 24 * 60 * 60 * 1000).toISOString()
  if (range === '7d') return new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()
  if (range === '30d') return new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()
  if (range === 'all') return '1970-01-01T00:00:00.000Z'
  return null
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const range = String(body.range || '')
  const start = rangeStart(range)
  if (!start) return NextResponse.json({ error: 'invalid_range' }, { status: 400 })

  const auth = await requireAdmin(request)
  if (auth.error) return auth.error
  const { admin } = auth

  const { error } = await admin
    .from('app_events')
    .delete()
    .gte('created_at', start)

  if (error) {
    return NextResponse.json({ error: 'delete_failed', details: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, range })
}
