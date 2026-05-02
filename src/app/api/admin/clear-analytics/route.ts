import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const rangeStart = (range: string) => {
  const now = Date.now()
  if (range === '24h') return new Date(now - 24 * 60 * 60 * 1000).toISOString()
  if (range === '7d') return new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()
  if (range === '30d') return new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()
  if (range === 'all') return '1970-01-01T00:00:00.000Z'
  return null
}

export async function POST(request: NextRequest) {
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return NextResponse.json({ error: 'missing_server_config' }, { status: 500 })
  }

  const authorization = request.headers.get('authorization') || ''
  const token = authorization.replace(/^Bearer\s+/i, '')
  if (!token) return NextResponse.json({ error: 'missing_token' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const range = String(body.range || '')
  const start = rangeStart(range)
  if (!start) return NextResponse.json({ error: 'invalid_range' }, { status: 400 })

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: { user }, error: userError } = await userClient.auth.getUser()
  if (userError || !user?.email) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createClient(supabaseUrl, serviceRoleKey)
  const { data: adminRow, error: adminError } = await admin
    .from('admin_users')
    .select('email')
    .eq('email', user.email.toLowerCase())
    .maybeSingle()

  if (adminError || !adminRow) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { error } = await admin
    .from('app_events')
    .delete()
    .gte('created_at', start)

  if (error) {
    return NextResponse.json({ error: 'delete_failed', details: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, range })
}
