import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey

const vapidEmail = process.env.VAPID_EMAIL
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
const pushConfigured = Boolean(vapidEmail && vapidPublicKey && vapidPrivateKey)

if (pushConfigured) {
  webpush.setVapidDetails(vapidEmail!, vapidPublicKey!, vapidPrivateKey!)
}

export async function POST(req: NextRequest) {
  try {
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Supabase ni konfiguriran.' }, { status: 503 })
    }

    if (!pushConfigured) {
      return NextResponse.json({ error: 'Push obvestila niso konfigurirana.' }, { status: 503 })
    }

    const authHeader = req.headers.get('authorization') || ''
    const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    if (!jwt) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    })
    const { data: userData, error: userError } = await userClient.auth.getUser()
    if (userError || !userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey)
    const { title, body, url } = await req.json()
    const { data: subs, error: subsError } = await adminClient
      .from('push_subscriptions')
      .select('subscription')
      .eq('user_id', userData.user.id)

    if (subsError) throw subsError
    if (!subs || subs.length === 0) {
      return NextResponse.json({ error: 'V bazi ni shranjene push povezave za ta racun.' }, { status: 404 })
    }

    const uniqueSubs = Array.from(
      new Map(subs.map((sub: any) => [sub.subscription?.endpoint, sub])).values()
    )

    let sent = 0
    let expired = 0
    const failed: string[] = []

    for (const sub of uniqueSubs) {
      try {
        await webpush.sendNotification(
          sub.subscription,
          JSON.stringify({
            title: title || 'GarageBase test iz baze',
            body: body || 'Push povezava iz baze deluje.',
            url: url || '/nastavitve',
          })
        )
        sent++
      } catch (error: any) {
        if (error.statusCode === 404 || error.statusCode === 410) expired++
        failed.push(error.body || error.message || 'neznana napaka')
      }
    }

    const result = { success: sent > 0, found: subs.length, unique: uniqueSubs.length, sent, expired, failed }
    if (sent < 1) {
      return NextResponse.json({
        ...result,
        error: `Najdenih je ${subs.length} push povezav (${uniqueSubs.length} unikatnih), vendar ni bilo poslano nobeno obvestilo.`,
      }, { status: 502 })
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Push DB test napaka:', error)
    return NextResponse.json({
      error: error.message,
      statusCode: error.statusCode,
      body: error.body,
    }, { status: error.statusCode || 500 })
  }
}
