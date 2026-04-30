import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const vapidEmail = process.env.VAPID_EMAIL
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
const pushConfigured = Boolean(vapidEmail && vapidPublicKey && vapidPrivateKey)

if (pushConfigured) {
  webpush.setVapidDetails(vapidEmail!, vapidPublicKey!, vapidPrivateKey!)
}

const tipNaziv: Record<string, string> = {
  registracija: 'Registracija',
  vinjeta: 'Vinjeta',
  tehnicni: 'Tehnicni pregled',
  servis: 'Servis',
  zavarovanje: 'Zavarovanje',
  homologacija: 'Homologacija',
}

function buildSummary(items: string[]) {
  const uniqueItems = Array.from(new Set(items))
  const shown = uniqueItems.slice(0, 4)
  const extra = uniqueItems.length - shown.length
  return `${shown.join(' | ')}${extra > 0 ? ` | +${extra} dodatnih` : ''}`
}

async function getUserClient(req: NextRequest) {
  if (!supabaseUrl || !supabaseAnonKey) return null
  const authHeader = req.headers.get('authorization') || ''
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!jwt) return null
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  })
}

export async function POST(req: NextRequest) {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Supabase ni konfiguriran.' }, { status: 503 })
    }
    if (!pushConfigured) {
      return NextResponse.json({ error: 'Push obvestila niso konfigurirana.' }, { status: 503 })
    }

    const userClient = await getUserClient(req)
    if (!userClient) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: userData, error: userError } = await userClient.auth.getUser()
    if (userError || !userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const dbClient = supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : userClient
    const { data: subs, error: subsError } = await dbClient
      .from('push_subscriptions')
      .select('subscription, notification_settings')
      .eq('user_id', userData.user.id)

    if (subsError) throw subsError
    if (!subs || subs.length === 0) {
      return NextResponse.json({ error: 'V bazi ni push povezave za ta racun.' }, { status: 404 })
    }

    const { data: reminders, error: remindersError } = await dbClient
      .from('reminders')
      .select('*, cars!inner(znamka, model, user_id, km_trenutni)')
      .eq('cars.user_id', userData.user.id)

    if (remindersError) throw remindersError

    const messages: string[] = []
    for (const op of reminders || []) {
      const avtoNaziv = `${op.cars?.znamka || ''} ${op.cars?.model || ''}`.trim()
      const naziv = tipNaziv[op.tip] || op.tip || 'Opomnik'

      if (op.datum) {
        const dniDo = Math.ceil(
          (new Date(op.datum).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
        )
        if (dniDo <= 7) {
          messages.push(dniDo < 0
            ? `${avtoNaziv} ${naziv}: poteklo ${Math.abs(dniDo)} dni`
            : `${avtoNaziv} ${naziv}: ${dniDo} dni`)
        }
      }

      const currentKm = Number(op.cars?.km_trenutni || 0)
      const reminderKm = Number(op.km_opomnik || 0)
      if (reminderKm > 0 && currentKm > 0) {
        const kmDo = reminderKm - currentKm
        if (kmDo <= 500) {
          messages.push(kmDo < 0
            ? `${avtoNaziv} ${naziv}: cez rok ${Math.abs(kmDo).toLocaleString('sl-SI')} km`
            : `${avtoNaziv} ${naziv}: ${kmDo.toLocaleString('sl-SI')} km`)
        }
      }
    }

    if (messages.length === 0) {
      return NextResponse.json({
        success: false,
        foundReminders: reminders?.length || 0,
        sent: 0,
        error: 'Ni rdecih opomnikov za poslati. Za test nastavi opomnik na datum v naslednjih 7 dneh ali km manj kot 500 km.',
      }, { status: 422 })
    }

    const uniqueSubs = Array.from(
      new Map(subs.map((sub: any) => [sub.subscription?.endpoint, sub])).values()
    )

    let sent = 0
    const failed: string[] = []
    for (const sub of uniqueSubs) {
      try {
        await webpush.sendNotification(
          sub.subscription,
          JSON.stringify({
            title: `GarageBase - ${messages.length} opomnikov`,
            body: buildSummary(messages),
            url: '/opomniki',
          })
        )
        sent++
      } catch (error: any) {
        failed.push(error.body || error.message || 'neznana napaka')
      }
    }

    return NextResponse.json({
      success: sent > 0,
      foundReminders: reminders?.length || 0,
      redReminders: messages.length,
      devices: uniqueSubs.length,
      sent,
      failed,
    })
  } catch (error: any) {
    console.error('Reminder test napaka:', error)
    return NextResponse.json({
      error: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    }, { status: 500 })
  }
}
