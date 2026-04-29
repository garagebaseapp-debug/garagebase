import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

const vapidEmail = process.env.VAPID_EMAIL
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
const pushConfigured = Boolean(vapidEmail && vapidPublicKey && vapidPrivateKey)

if (pushConfigured) {
  webpush.setVapidDetails(vapidEmail!, vapidPublicKey!, vapidPrivateKey!)
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const pushApiSecret = process.env.PUSH_API_SECRET || process.env.CRON_SECRET

const isAuthorized = async (req: NextRequest) => {
  const authHeader = req.headers.get('authorization') || ''
  const secretHeader = req.headers.get('x-garagebase-secret') || ''

  if (pushApiSecret && (authHeader === `Bearer ${pushApiSecret}` || secretHeader === pushApiSecret)) {
    return true
  }

  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!jwt || !supabaseUrl || !supabaseAnonKey) return false

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  })
  const { data, error } = await client.auth.getUser()
  return !error && !!data.user
}

export async function POST(req: NextRequest) {
  try {
    if (!(await isAuthorized(req))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!pushConfigured) {
      return NextResponse.json(
        { error: 'Push obvestila niso konfigurirana.' },
        { status: 503 }
      )
    }

    const { subscription, title, body, url } = await req.json()

    await webpush.sendNotification(
      subscription,
      JSON.stringify({ title, body, url })
    )

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Push napaka:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
