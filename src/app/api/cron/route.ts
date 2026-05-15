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

const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const getSupabase = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = supabaseServiceRoleKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) return null
  return createClient(supabaseUrl, supabaseKey)
}

const vapidEmail = process.env.VAPID_EMAIL
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
const pushConfigured = Boolean(vapidEmail && vapidPublicKey && vapidPrivateKey)
const PUSH_TIMEOUT_MS = 8_000
const SUBSCRIPTION_PAGE_SIZE = 1000

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

function getDateStatus(daysLeft: number, reminderType?: string): ReminderStatus {
  const isVignette = String(reminderType || '').toLowerCase().includes('vinjet')
  if (daysLeft <= (isVignette ? 14 : 7)) return 'red'
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
    return currentHour === 8 && currentMinute < 20
  }

  const wantedTotal = wantedHour * 60 + wantedMinute
  const currentTotal = currentHour * 60 + currentMinute
  return currentTotal >= wantedTotal && currentTotal < wantedTotal + 20
}

async function sendPush(subscription: any, title: string, body: string) {
  await Promise.race([
    webpush.sendNotification(
      subscription,
      JSON.stringify({
        title,
        body,
        url: '/opomniki',
      })
    ),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('push_send_timeout')), PUSH_TIMEOUT_MS)
    }),
  ])
}

async function recordPushSuccess(supabase: any, userId: string, endpoint?: string) {
  if (!endpoint) return
  try {
    await supabase
      .from('push_subscriptions')
      .update({
        last_success_at: new Date().toISOString(),
        last_error_at: null,
        last_error: null,
        fail_count: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('subscription->>endpoint', endpoint)
  } catch {
    // Optional observability columns may not exist until the stability SQL is run.
  }
}

async function recordPushFailure(supabase: any, userId: string, endpoint: string | undefined, error: any) {
  if (!endpoint) return
  const statusCode = Number(error?.statusCode || 0)
  if (statusCode === 404 || statusCode === 410) {
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', userId)
      .eq('subscription->>endpoint', endpoint)
    return
  }

  try {
    await supabase
      .from('push_subscriptions')
      .update({
        last_error_at: new Date().toISOString(),
        last_error: String(error?.body || error?.message || 'push_send_failed').slice(0, 500),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('subscription->>endpoint', endpoint)
  } catch {
    // Optional observability columns may not exist until the stability SQL is run.
  }
}

function uniqueSubscriptions(subs: any[]) {
  return Array.from(
    new Map(subs.map((sub) => [sub.subscription?.endpoint, sub])).values()
  )
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

function buildSummary(items: string[]) {
  const uniqueItems = Array.from(new Set(items))
  const shown = uniqueItems.slice(0, 4)
  const extra = uniqueItems.length - shown.length
  return `${shown.join(' | ')}${extra > 0 ? ` | +${extra} dodatnih` : ''}`
}

async function loadDueSubscriptions(supabase: any) {
  const dueSubs: any[] = []
  let preskocenoCas = 0
  let preskocenoIzklopljeno = 0
  let from = 0

  while (true) {
    const to = from + SUBSCRIPTION_PAGE_SIZE - 1
    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('user_id, subscription, notification_settings, notification_state')
      .order('updated_at', { ascending: false })
      .range(from, to)

    if (error) throw error

    const page = data || []
    for (const sub of uniqueSubscriptions(page)) {
      const settings: NotificationSettings = {
        ...defaultNotificationSettings,
        ...(sub.notification_settings || {}),
      }
      if (!settings.enabled) {
        preskocenoIzklopljeno++
        continue
      }
      if (!shouldRunForSendTime(settings.sendTime)) {
        preskocenoCas++
        continue
      }
      dueSubs.push({ ...sub, notification_settings: settings })
    }

    if (page.length < SUBSCRIPTION_PAGE_SIZE) break
    from += SUBSCRIPTION_PAGE_SIZE
  }

  return {
    dueSubs: uniqueSubscriptions(dueSubs),
    preskocenoCas,
    preskocenoIzklopljeno,
  }
}

export async function GET(req: Request) {
  const supabase = getSupabase()
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    return NextResponse.json({ error: 'cron_secret_missing' }, { status: 500 })
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized', reason: 'bad_cron_secret' }, { status: 401 })
  }

  if (!pushConfigured) {
    return NextResponse.json({ success: true, poslano: 0, skipped: 'push_not_configured' })
  }

  if (!supabase || !supabaseServiceRoleKey) {
    return NextResponse.json(
      {
        success: false,
        poslano: 0,
        error: 'missing_supabase_service_role_key',
        message: 'SUPABASE_SERVICE_ROLE_KEY manjka. Cron za dnevna obvestila potrebuje service role key, ker nima prijavljenega uporabnika.',
      },
      { status: 500 }
    )
  }

  try {
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Ljubljana',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())
    let poslano = 0
    let pregledano = 0
    let uporabnikov = 0
    let naprav = 0
    let preskocenoCas = 0
    let preskocenoIzklopljeno = 0
    let napakePosiljanja = 0

    const dueResult = await loadDueSubscriptions(supabase)
    const dueSubs = dueResult.dueSubs
    preskocenoCas = dueResult.preskocenoCas
    preskocenoIzklopljeno = dueResult.preskocenoIzklopljeno

    const dueUserIds = Array.from(new Set(dueSubs.map((sub) => sub.user_id).filter(Boolean)))
    naprav = dueSubs.length

    if (dueUserIds.length === 0) {
      return NextResponse.json({
        success: true,
        poslano: 0,
        pregledano: 0,
        uporabnikov: 0,
        naprav,
        preskocenoCas,
        preskocenoIzklopljeno,
        napakePosiljanja: 0,
        timezone: 'Europe/Ljubljana',
      })
    }

    const opomniki: any[] = []
    for (const userIdBatch of chunkArray(dueUserIds, 200)) {
      const { data: reminderBatch, error: remindersError } = await supabase
        .from('reminders')
        .select('id, tip, datum, km_opomnik, cars!inner(znamka, model, user_id, km_trenutni)')
        .in('cars.user_id', userIdBatch)

      if (remindersError) throw remindersError
      opomniki.push(...(reminderBatch || []))
    }

    const userReminders = new Map<string, any[]>()
    for (const op of opomniki) {
      const userId = op.cars?.user_id
      if (!userId) continue
      userReminders.set(userId, [...(userReminders.get(userId) || []), op])
    }

    uporabnikov = userReminders.size
    if (uporabnikov === 0) {
      return NextResponse.json({
        success: true,
        poslano: 0,
        pregledano: 0,
        uporabnikov: 0,
        naprav,
        preskocenoCas,
        preskocenoIzklopljeno,
        napakePosiljanja: 0,
        timezone: 'Europe/Ljubljana',
      })
    }

    const subsByUser = new Map<string, any[]>()
    for (const sub of dueSubs) {
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

        const state: NotificationState = sub.notification_state || {}
        const messages: string[] = []
        let changedState = false
        let delivered = false

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
            const status = getDateStatus(dniDo, op.tip)
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
            await recordPushSuccess(supabase, userId, sub.subscription?.endpoint)
            poslano++
            delivered = true
          } catch (e) {
            console.error('Napaka pri posiljanju povzetka:', e)
            await recordPushFailure(supabase, userId, sub.subscription?.endpoint, e)
            napakePosiljanja++
          }
        }

        if (changedState && (messages.length === 0 || delivered)) {
          let updateQuery = supabase
            .from('push_subscriptions')
            .update({
              notification_state: state,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', userId)
          const endpoint = sub.subscription?.endpoint
          if (endpoint) updateQuery = updateQuery.eq('subscription->>endpoint', endpoint)
          await updateQuery
        }
      }
    }

    return NextResponse.json({
      success: true,
      poslano,
      pregledano,
      uporabnikov,
      naprav,
      preskocenoCas,
      preskocenoIzklopljeno,
      napakePosiljanja,
      timezone: 'Europe/Ljubljana',
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
