import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
// @ts-ignore
import webpush from 'web-push'

// Supabase admin klient
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// VAPID nastavitve
webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export async function GET(req: Request) {
  // Varnostni ključ — debug vrstica da vidimo kaj se dogaja
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  console.log('Auth header:', authHeader)
  console.log('CRON_SECRET:', cronSecret)

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized', debug: { authHeader, cronSecret } }, { status: 401 })
  }

  try {
    // Vzemi vse opomnike
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

      // Pošlji notifikacijo če je 30, 14, 7 ali 1 dan pred potekom
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

      // Vzemi subscription tega uporabnika
      const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('subscription')
        .eq('user_id', op.cars?.user_id)

      if (!subs || subs.length === 0) continue

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