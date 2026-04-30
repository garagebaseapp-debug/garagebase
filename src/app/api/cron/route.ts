import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
// @ts-ignore
import webpush from 'web-push'

type ReminderStatus = 'green' | 'yellow' | 'red'

type NotificationSettings = {
  enabled: boolean
  dateReminders: boolean
  kmReminders: boolean
  transitionAlerts: boolean
  dailyRedAlerts: boolean
  sendTime: string
}

type NotificationState = Record<string, {
  status?: ReminderStatus
  lastDailyDate?: string
}>

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const vapidEmail = process.env.VAPID_EMAIL
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
const pushConfigured = Boolean(vapidEmail && vapidPublicKey && vapidPrivateKey)

const defaultNotificationSettings: NotificationSettings = {
  enabled: true,
  dateReminders: true,
  kmReminders: true,
  transitionAlerts: true,
  dailyRedAlerts: true,
  sendTime: '08:00',
}

const tipNaziv: Record<string, string> = {
  registracija: 'Registracija',
  vinjeta: 'Vinjeta',
  tehnicni: 'Tehnicni pregled',
  servis: 'Servis',
  zavarovanje: 'Zavarovanje',
  homologacija: 'Homologacija',
}

if (pushConfigured) {
  webpush.setVapidDetails(vapidEmail!, vapidPublicKey!, vapidPrivateKey!)
}

function getDateStatus(daysLeft: number): ReminderStatus {
  if (daysLeft <= 7) return 'red'
  if (daysLeft <= 30) return 'yellow'
  return 'green'
}

function getKmStatus(kmLeft: number): ReminderStatus {
  if (kmLeft <= 500) return 'red'
  if (kmLeft <= 1500) return 'yellow'
  return 'green'
}

function isWorseStatus(previous?: ReminderStatus, current?: ReminderStatus) {
  const rank: Record<ReminderStatus, number> = { green: 1, yellow: 2, red: 3 }
  if (!previous || !current) return false
  return rank[current] > rank[previous]
}

function shouldRunForSendTime(sendTime: string) {
  const [wantedHour, wantedMinute] = (sendTime || '08:00').split(':').map(Number)
  const parts = new Intl.DateTimeFormat('sl-SI', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Europe/Ljubljana',
  }).formatToParts(new Date())
  const currentHour = Number(parts.find((part) => part.type === 'hour')?.value || 0)
  const currentMinute = Number(parts.find((part) => part.type === 'minute')?.value || 0)

  if (!Number.isFinite(wantedHour) || !Number.isFinite(wantedMinute)) {
    return currentHour === 8 && currentMinute < 5
  }

  const wantedTotal = wantedHour * 60 + wantedMinute
  const currentTotal = currentHour * 60 + currentMinute
  return currentTotal >= wantedTotal && currentTotal < wantedTotal + 5
}

async function sendPush(subscription: any, title: string, body: string) {
  await webpush.sendNotification(
    subscription,
    JSON.stringify({
      title,
      body,
      url: '/opomniki',
    })
  )
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!pushConfigured) {
    return NextResponse.json({ success: true, poslano: 0, skipped: 'push_not_configured' })
  }

  try {
    const { data: opomniki, error: remindersError } = await supabase
      .from('reminders')
      .select('*, cars(znamka, model, user_id, km_trenutni)')

    if (remindersError) throw remindersError
    if (!opomniki) return NextResponse.json({ success: true, poslano: 0 })

    const today = new Date().toISOString().slice(0, 10)
    let poslano = 0
    let pregledano = 0

    for (const op of opomniki) {
      const userId = op.cars?.user_id
      if (!userId) continue

      const avtoNaziv = `${op.cars?.znamka || ''} ${op.cars?.model || ''}`.trim()
      const naziv = tipNaziv[op.tip] || op.tip || 'Opomnik'

      const { data: subs, error: subsError } = await supabase
        .from('push_subscriptions')
        .select('subscription, notification_settings, notification_state')
        .eq('user_id', userId)

      if (subsError) throw subsError
      if (!subs || subs.length === 0) continue

      const checks: Array<{
        key: string
        enabledSetting: keyof Pick<NotificationSettings, 'dateReminders' | 'kmReminders'>
        status: ReminderStatus
        transitionBody: string
        dailyBody: string
      }> = []

      if (op.datum) {
        const dniDo = Math.ceil(
          (new Date(op.datum).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
        )
        const status = getDateStatus(dniDo)
        checks.push({
          key: `${op.id}:date`,
          enabledSetting: 'dateReminders',
          status,
          transitionBody: status === 'red'
            ? `${naziv} za ${avtoNaziv} je postal nujen. Se ${Math.max(dniDo, 0)} dni.`
            : `${naziv} za ${avtoNaziv} je zdaj v rumenem obmocju. Se ${dniDo} dni.`,
          dailyBody: dniDo < 0
            ? `${naziv} za ${avtoNaziv} je potekel pred ${Math.abs(dniDo)} dnevi.`
            : `${naziv} za ${avtoNaziv}: se ${dniDo} dni.`,
        })
      }

      const currentKm = Number(op.cars?.km_trenutni || 0)
      const reminderKm = Number(op.km_opomnik || 0)
      if (reminderKm > 0 && currentKm > 0) {
        const kmDo = reminderKm - currentKm
        const status = getKmStatus(kmDo)
        checks.push({
          key: `${op.id}:km`,
          enabledSetting: 'kmReminders',
          status,
          transitionBody: status === 'red'
            ? `${naziv} za ${avtoNaziv} je postal nujen. Se ${Math.max(kmDo, 0).toLocaleString('sl-SI')} km.`
            : `${naziv} za ${avtoNaziv} je zdaj v rumenem obmocju. Se ${kmDo.toLocaleString('sl-SI')} km.`,
          dailyBody: kmDo < 0
            ? `${naziv} za ${avtoNaziv}: prekoraceno za ${Math.abs(kmDo).toLocaleString('sl-SI')} km.`
            : `${naziv} za ${avtoNaziv}: se ${kmDo.toLocaleString('sl-SI')} km.`,
        })
      }

      if (checks.length === 0) continue

      for (const sub of subs) {
        const settings: NotificationSettings = {
          ...defaultNotificationSettings,
          ...(sub.notification_settings || {}),
        }
        if (!settings.enabled || !shouldRunForSendTime(settings.sendTime)) continue

        const state: NotificationState = sub.notification_state || {}
        let changedState = false

        for (const check of checks) {
          if (!settings[check.enabledSetting]) continue

          const previous = state[check.key]
          const previousStatus = previous?.status
          const nextState = {
            ...previous,
            status: check.status,
          }

          pregledano++

          const sendTransition =
            settings.transitionAlerts &&
            isWorseStatus(previousStatus, check.status) &&
            (check.status === 'yellow' || check.status === 'red')

          const sendDailyRed =
            settings.dailyRedAlerts &&
            check.status === 'red' &&
            previous?.lastDailyDate !== today

          if (sendTransition) {
            try {
              await sendPush(sub.subscription, `GarageBase - ${naziv}`, check.transitionBody)
              poslano++
            } catch (e) {
              console.error('Napaka pri posiljanju prehoda:', e)
            }
          }

          if (sendDailyRed) {
            try {
              await sendPush(sub.subscription, `Nujno - ${naziv}`, check.dailyBody)
              poslano++
              nextState.lastDailyDate = today
            } catch (e) {
              console.error('Napaka pri dnevnem rdecem opomniku:', e)
            }
          }

          state[check.key] = nextState
          changedState = true
        }

        if (changedState) {
          await supabase
            .from('push_subscriptions')
            .update({
              notification_state: state,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', userId)
        }
      }
    }

    return NextResponse.json({ success: true, poslano, pregledano })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
