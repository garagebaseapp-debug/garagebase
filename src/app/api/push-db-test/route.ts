import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { requireAdmin } from '@/lib/server-admin'
import { rateLimit } from '@/lib/server-rate-limit'

const vapidEmail = process.env.VAPID_EMAIL
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
const pushConfigured = Boolean(vapidEmail && vapidPublicKey && vapidPrivateKey)

type PushSubscriptionRow = {
  subscription?: Parameters<typeof webpush.sendNotification>[0] & {
    endpoint?: string
  }
}

function uniqueSubscriptions<T extends PushSubscriptionRow>(subs: T[]) {
  return Array.from(
    new Map(subs.map((sub) => [sub.subscription?.endpoint, sub])).values()
  )
}

function hasSubscription<T extends PushSubscriptionRow>(sub: T): sub is T & { subscription: NonNullable<T['subscription']> } {
  return Boolean(sub.subscription)
}

function pushErrorInfo(error: unknown) {
  const source = typeof error === 'object' && error ? error as Record<string, unknown> : {}
  return {
    message: error instanceof Error ? error.message : String(source.message || 'push_failed'),
    statusCode: Number(source.statusCode || 0),
    body: String(source.body || ''),
  }
}

if (pushConfigured) {
  webpush.setVapidDetails(vapidEmail!, vapidPublicKey!, vapidPrivateKey!)
}

export async function POST(req: NextRequest) {
  try {
    const limited = await rateLimit(req, 'push-db-test', 10, 60_000)
    if (limited) return limited

    const auth = await requireAdmin(req)
    if (auth.error) return auth.error

    if (!pushConfigured) {
      return NextResponse.json({ error: 'Push obvestila niso konfigurirana.' }, { status: 503 })
    }

    const dbClient = auth.admin
    const { title, body, url } = await req.json()
    const { data: subs, error: subsError } = await dbClient
      .from('push_subscriptions')
      .select('subscription')
      .eq('user_id', auth.user.id)

    if (subsError) throw subsError
    if (!subs || subs.length === 0) {
      return NextResponse.json({ error: 'V bazi ni shranjene push povezave za ta racun.' }, { status: 404 })
    }

    const uniqueSubs = uniqueSubscriptions((subs || []) as PushSubscriptionRow[]).filter(hasSubscription)

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
      } catch (error: unknown) {
        const info = pushErrorInfo(error)
        if (info.statusCode === 404 || info.statusCode === 410) expired++
        failed.push(info.body || info.message || 'neznana napaka')
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
  } catch (error: unknown) {
    const info = pushErrorInfo(error)
    console.error('Push DB test napaka:', error)
    return NextResponse.json({
      error: info.message,
      statusCode: info.statusCode,
      body: info.body,
    }, { status: info.statusCode || 500 })
  }
}
