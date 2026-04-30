import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

async function getUserClientFromRequest(req: NextRequest) {
  if (!supabaseUrl || !supabaseAnonKey) return null
  const authHeader = req.headers.get('authorization') || ''
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!jwt) return null

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  })
}

async function getUserFromRequest(req: NextRequest) {
  const client = await getUserClientFromRequest(req)
  if (!client) return null
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) return null
  return { user: data.user, client }
}

export async function POST(req: NextRequest) {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Supabase ni konfiguriran.' }, { status: 503 })
    }

    const auth = await getUserFromRequest(req)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { subscription, notificationSettings } = await req.json()
    const endpoint = subscription?.endpoint
    if (!endpoint) {
      return NextResponse.json({ error: 'Manjka push endpoint naprave.' }, { status: 400 })
    }

    const dbClient = supabaseServiceKey
      ? createClient(supabaseUrl, supabaseServiceKey)
      : auth.client

    await dbClient
      .from('push_subscriptions')
      .delete()
      .eq('user_id', auth.user.id)
      .eq('subscription->>endpoint', endpoint)

    const { error } = await dbClient
      .from('push_subscriptions')
      .insert({
        user_id: auth.user.id,
        subscription,
        notification_settings: notificationSettings,
        notification_state: {},
        updated_at: new Date().toISOString(),
      })

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Shranjevanje push subscription:', error)
    return NextResponse.json({
      error: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    }, { status: 500 })
  }
}
