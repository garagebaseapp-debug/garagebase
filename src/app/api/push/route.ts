import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { requireAdmin } from '@/lib/server-admin'
import { rateLimit } from '@/lib/server-rate-limit'

const vapidEmail = process.env.VAPID_EMAIL
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
const pushConfigured = Boolean(vapidEmail && vapidPublicKey && vapidPrivateKey)

if (pushConfigured) {
  webpush.setVapidDetails(vapidEmail!, vapidPublicKey!, vapidPrivateKey!)
}

const pushApiSecret = process.env.PUSH_API_SECRET || process.env.CRON_SECRET

const isAuthorized = async (req: NextRequest) => {
  const authHeader = req.headers.get('authorization') || ''
  const secretHeader = req.headers.get('x-garagebase-secret') || ''

  if (pushApiSecret && (authHeader === `Bearer ${pushApiSecret}` || secretHeader === pushApiSecret)) {
    return true
  }

  const admin = await requireAdmin(req)
  return !admin.error
}

export async function POST(req: NextRequest) {
  try {
    const limited = await rateLimit(req, 'push-test', 20, 60_000)
    if (limited) return limited

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
    return NextResponse.json({
      error: error.message,
      statusCode: error.statusCode,
      body: error.body,
    }, { status: error.statusCode || 500 })
  }
}
