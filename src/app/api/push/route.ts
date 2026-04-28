import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'

const vapidEmail = process.env.VAPID_EMAIL
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
const pushConfigured = Boolean(vapidEmail && vapidPublicKey && vapidPrivateKey)

if (pushConfigured) {
  webpush.setVapidDetails(vapidEmail!, vapidPublicKey!, vapidPrivateKey!)
}

export async function POST(req: NextRequest) {
  try {
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
