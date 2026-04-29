import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
// @ts-ignore
import webpush from 'web-push'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const vapidEmail = process.env.VAPID_EMAIL
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
const pushConfigured = Boolean(vapidEmail && vapidPublicKey && vapidPrivateKey)

if (pushConfigured) {
  webpush.setVapidDetails(vapidEmail!, vapidPublicKey!, vapidPrivateKey!)
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const { data: opomniki } = await supabase
      .from('reminders')
      .select('*, cars(znamka, model, user_id)')

    if (!opomniki) return NextResponse.json({ sent: 0 })

    let poslano = 0

    for (const op of opomniki) {
      if (!op.datum) continue

      const dniDo = Math.ceil(
        (new Date(op.datum).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      )

      if (![30, 14, 7, 1].includes(dniDo)) continue

      const tipNaziv: any = {
        registracija: 'Registracija',
        vinjeta: 'Vinjeta',
        tehnicni: 'Tehnični pregled',
        servis: 'Servis',
        zavarovanje: 'Zavarovanje'
      }

      const avtoNaziv = `${op.cars?.znamka} ${op.cars?.model}`
      const naziv = tipNaziv[op.tip] || op.tip

      const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('subscription')
        .eq('user_id', op.cars?.user_id)

      if (!pushConfigured || !subs || subs.length === 0) continue

      for (const sub of subs) {
        try {
          await webpush.sendNotification(
            sub.subscription,
            JSON.stringify({
              title: `⏰ ${naziv} — ${avtoNaziv}`,
              body: dniDo === 1
                ? `Jutri poteče ${naziv.toLowerCase()} za ${avtoNaziv}!`
                : `${naziv} za ${avtoNaziv} poteče čez ${dniDo} dni`,
              url: '/opomniki'
            })
          )
          poslano++
        } catch (e) {
          console.error('Napaka pri pošiljanju:', e)
        }
      }
    }

    return NextResponse.json({ success: true, poslano })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

