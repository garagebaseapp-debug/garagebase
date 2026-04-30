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
  lastDailySlot?: string
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

function uniqueSubscriptions(subs: any[]) {
  return Array.from(
    new Map(subs.map((sub) => [sub.subscription?.endpoint, sub])).values()
  )
}

function buildSummary(items: string[]) {
  const uniqueItems = Array.from(new Set(items))
  const shown = uniqueItems.slice(0, 4)
  const extra = uniqueItems.length - shown.length
  return `${shown.join(' | ')}${extra > 0 ? ` | +${extra} dodatnih` : ''}`
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const userAgent = req.headers.get('user-agent') || ''
  const cronSecret = process.env.CRON_SECRET
  const isVercelCron = userAgent.includes('vercel-cron/1.0')

  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && !isVercelCron) {
    return NextResponse.json({ error: 'Unauthorized', reason: 'bad_cron_secret' }, { status: 401 })
  }

  if (!cronSecret && !isVercelCron) {
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

    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Ljubljana',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())
    let poslano = 0
    let pregledano = 0

    const userReminders = new Map<string, any[]>()
    for (const op of opomniki) {
      const userId = op.cars?.user_id
      if (!userId) continue
      userReminders.set(userId, [...(userReminders.get(userId) || []), op])
    }

    const userIds = Array.from(userReminders.keys())
    if (userIds.length === 0) return NextResponse.json({ success: true, poslano: 0, pregledano: 0 })

    const { data: allSubs, error: subsError } = await supabase
      .from('push_subscriptions')
      .select('user_id, subscription, notification_settings, notification_state')
      .in('user_id', userIds)

    if (subsError) throw subsError

    const subsByUser = new Map<string, any[]>()
    for (const sub of allSubs || []) {
      subsByUser.set(sub.user_id, [...(subsByUser.get(sub.user_id) || []), sub])
    }

    for (const [userId, reminders] of userReminders.entries()) {
      const subs = uniqueSubscriptions(subsByUser.get(userId) || [])
      if (subs.length === 0) continue

      for (const sub of subs) {
        const settings: NotificationSettings = {
          ...defaultNotificationSettings,
          ...(sub.notification_settings || {}),
        }
        if (!settings.enabled || !shouldRunForSendTime(settings.sendTime)) continue

        const state: NotificationState = sub.notification_state || {}
        const messages: string[] = []
        let changedState = false

        for (const op of reminders) {
          const avtoNaziv = `${op.cars?.znamka || ''} ${op.cars?.model || ''}`.trim()
          const naziv = tipNaziv[op.tip] || op.tip || 'Opomnik'

          const checks: Array<{
            key: string
            enabledSetting: keyof Pick<NotificationSettings, 'dateReminders' | 'kmReminders'>
            status: ReminderStatus
            transitionText: string
            dailyText: string
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
              transitionText: `${avtoNaziv} ${naziv}: ${status === 'red' ? 'nujno' : 'kmalu'} (${Math.max(dniDo, 0)} dni)`,
              dailyText: dniDo < 0
                ? `${avtoNaziv} ${naziv}: poteklo ${Math.abs(dniDo)} dni`
                : `${avtoNaziv} ${naziv}: ${dniDo} dni`,
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
              transitionText: `${avtoNaziv} ${naziv}: ${status === 'red' ? 'nujno' : 'kmalu'} (${Math.max(kmDo, 0).toLocaleString('sl-SI')} km)`,
              dailyText: kmDo < 0
                ? `${avtoNaziv} ${naziv}: cez rok ${Math.abs(kmDo).toLocaleString('sl-SI')} km`
                : `${avtoNaziv} ${naziv}: ${kmDo.toLocaleString('sl-SI')} km`,
            })
          }

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

            const slot = `${today}:${settings.sendTime}`
            const sendDailyRed =
              settings.dailyRedAlerts &&
              check.status === 'red' &&
              previous?.lastDailySlot !== slot

            if (sendTransition) messages.push(check.transitionText)

            if (sendDailyRed) {
              messages.push(check.dailyText)
              nextState.lastDailyDate = today
              nextState.lastDailySlot = slot
            }

            state[check.key] = nextState
            changedState = true
          }
        }

        if (messages.length > 0) {
          try {
            await sendPush(
              sub.subscription,
              `GarageBase - ${messages.length} opomnikov`,
              buildSummary(messages)
            )
            poslano++
          } catch (e) {
            console.error('Napaka pri posiljanju povzetka:', e)
          }
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
