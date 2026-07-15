import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'
import { getRequestUser } from '@/lib/server-admin'
import { rateLimit } from '@/lib/server-rate-limit'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const vapidEmail = process.env.VAPID_EMAIL
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
const pushConfigured = Boolean(vapidEmail && vapidPublicKey && vapidPrivateKey)

type PushSubscriptionPayload = Parameters<typeof webpush.sendNotification>[0] & {
  endpoint?: string
}

type PushSubscriptionRow = {
  user_id?: string | null
  subscription?: PushSubscriptionPayload | null
}

type AdminAuthUser = {
  id: string
  email?: string | null
}

if (pushConfigured) {
  webpush.setVapidDetails(vapidEmail!, vapidPublicKey!, vapidPrivateKey!)
}

function notificationCopy(kind: string) {
  if (kind === 'bug_report') {
    return {
      title: 'GarageBase: nova prijava napake',
      body: 'Uporabnik je poslal novo prijavo napake. Odpri admin pregled.',
      url: '/admin?tab=inbox',
    }
  }
  if (kind === 'feedback') {
    return {
      title: 'GarageBase: nov predlog',
      body: 'Uporabnik je poslal nov predlog. Odpri admin pregled.',
      url: '/admin?tab=inbox',
    }
  }
  return {
    title: 'GarageBase: nova sistemska napaka',
    body: 'Aplikacija je zabeležila novo sistemsko napako. Odpri admin pregled.',
    url: '/admin?tab=inbox',
  }
}

function uniqueSubscriptions(subs: PushSubscriptionRow[]) {
  return Array.from(
    new Map(subs.filter((sub) => sub.subscription?.endpoint).map((sub) => [sub.subscription?.endpoint, sub])).values()
  )
}

function pushErrorInfo(error: unknown) {
  const source = typeof error === 'object' && error ? error as Record<string, unknown> : {}
  return {
    message: error instanceof Error ? error.message : String(source.message || 'push_failed'),
    statusCode: Number(source.statusCode || 0),
  }
}

export async function POST(request: NextRequest) {
  try {
    const limited = await rateLimit(request, 'admin-notify', 30, 60_000)
    if (limited) return limited

    const auth = await getRequestUser(request)
    if (auth.error) return auth.error

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'missing_server_config' }, { status: 500 })
    }
    if (!pushConfigured) {
      return NextResponse.json({ sent: 0, reason: 'push_not_configured' })
    }

    const body = await request.json().catch(() => ({}))
    const kind = String(body.kind || 'app_error')
    if (!['app_error', 'bug_report', 'feedback'].includes(kind)) {
      return NextResponse.json({ error: 'invalid_kind' }, { status: 400 })
    }

    const admin = createClient(supabaseUrl, serviceRoleKey)
    const { data: adminRows, error: adminRowsError } = await admin.from('admin_users').select('email')
    if (adminRowsError) throw adminRowsError

    const adminEmails = new Set((adminRows || []).map((row) => String(row.email || '').toLowerCase()).filter(Boolean))
    if (adminEmails.size === 0) return NextResponse.json({ sent: 0, reason: 'no_admins' })

    const { data: usersData, error: usersError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (usersError) throw usersError

    const adminIds = (usersData.users as AdminAuthUser[])
      .filter((user) => adminEmails.has(String(user.email || '').toLowerCase()))
      .map((user) => user.id)

    if (adminIds.length === 0) return NextResponse.json({ sent: 0, reason: 'no_admin_auth_users' })

    const { data: subs, error: subsError } = await admin
      .from('push_subscriptions')
      .select('user_id,subscription')
      .in('user_id', adminIds)
    if (subsError) throw subsError

    const uniqueSubs = uniqueSubscriptions((subs || []) as PushSubscriptionRow[])
    if (uniqueSubs.length === 0) return NextResponse.json({ sent: 0, reason: 'no_admin_push_subscriptions' })

    const copy = notificationCopy(kind)
    let sent = 0
    let expired = 0

    for (const sub of uniqueSubs) {
      if (!sub.subscription) continue
      try {
        await webpush.sendNotification(sub.subscription, JSON.stringify(copy))
        sent++
      } catch (error: unknown) {
        const info = pushErrorInfo(error)
        if (info.statusCode === 404 || info.statusCode === 410) expired++
      }
    }

    return NextResponse.json({ sent, expired, found: uniqueSubs.length })
  } catch (error: unknown) {
    const info = pushErrorInfo(error)
    console.error('Admin notify failed:', error)
    return NextResponse.json({ error: info.message, statusCode: info.statusCode }, { status: info.statusCode || 500 })
  }
}
