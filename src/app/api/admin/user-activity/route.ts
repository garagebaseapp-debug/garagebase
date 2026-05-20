import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server-admin'

const activityEventNames = new Set([
  'fuel_saved',
  'service_saved',
  'expense_saved',
  'report_open',
  'report_pdf_download',
  'qr_scan_open',
  'qr_import_confirmed',
  'feedback_open',
  'settings_saved',
  'settings_snapshot',
  'push_subscribed',
  'app_lock_enabled',
  'app_lock_pattern_enabled',
])

const sinceIso = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
const SESSION_GAP_MS = 30 * 60 * 1000
const SINGLE_EVENT_SESSION_MS = 60 * 1000

const countQuery = async (query: any) => {
  const { count, error } = await query
  if (error) throw error
  return count || 0
}

const eventLabel = (name: string) => {
  const labels: Record<string, string> = {
    page_view: 'Ogled strani',
    fuel_add_open: 'Odprl vnos goriva',
    fuel_saved: 'Shranil gorivo',
    service_add_open: 'Odprl vnos servisa',
    service_saved: 'Shranil servis',
    expense_add_open: 'Odprl vnos stroska',
    expense_saved: 'Shranil strosek',
    report_open: 'Odprl report',
    report_pdf_download: 'Prenesel PDF',
    qr_scan_open: 'Odprl QR scan',
    qr_import_confirmed: 'Potrdil QR uvoz',
    settings_saved: 'Shranil nastavitve',
    feedback_open: 'Odprl feedback',
    app_lock_enabled: 'Vklopil odklep',
    app_lock_pattern_enabled: 'Vklopil vzorec',
  }
  return labels[name] || name
}

const pageLabel = (path?: string | null) => {
  const clean = (path || '/').split('?')[0] || '/'
  const labels: Record<string, string> = {
    '/': 'Landing',
    '/domov': 'Domov',
    '/garaza': 'Garaza',
    '/dashboard': 'Vozilo',
    '/gorivo': 'Gorivo',
    '/vnos-goriva': 'Vnos goriva',
    '/servis': 'Servis',
    '/vnos-servisa': 'Vnos servisa',
    '/stroski': 'Stroski vozila',
    '/stroski-garaza': 'Stroski garaze',
    '/vnos-stroska': 'Vnos stroska',
    '/opomniki': 'Opomniki',
    '/report': 'PDF report',
    '/scan': 'QR scan',
    '/nastavitve': 'Nastavitve',
    '/vec': 'Vec',
  }
  return labels[clean] || clean
}

const sessionStats = (events: any[]) => {
  const sorted = [...events]
    .map((event) => ({ ...event, time: new Date(event.created_at).getTime() }))
    .filter((event) => Number.isFinite(event.time))
    .sort((a, b) => a.time - b.time)

  if (sorted.length === 0) {
    return {
      sessions: 0,
      totalActiveMinutes: 0,
      averageSessionMinutes: 0,
      longestSessionMinutes: 0,
      lastSessionMinutes: 0,
    }
  }

  const sessions: Array<{ start: number; end: number; events: number }> = []
  let current = { start: sorted[0].time, end: sorted[0].time, events: 1 }

  for (const event of sorted.slice(1)) {
    if (event.time - current.end > SESSION_GAP_MS) {
      sessions.push(current)
      current = { start: event.time, end: event.time, events: 1 }
    } else {
      current.end = event.time
      current.events += 1
    }
  }
  sessions.push(current)

  const durations = sessions.map((session) => {
    const duration = session.end - session.start
    return Math.max(duration, session.events === 1 ? SINGLE_EVENT_SESSION_MS : 0)
  })
  const totalMs = durations.reduce((sum, duration) => sum + duration, 0)
  const minutes = (ms: number) => Math.round(ms / 60000)

  return {
    sessions: sessions.length,
    totalActiveMinutes: minutes(totalMs),
    averageSessionMinutes: minutes(totalMs / Math.max(1, sessions.length)),
    longestSessionMinutes: minutes(Math.max(...durations)),
    lastSessionMinutes: minutes(durations[durations.length - 1] || 0),
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (auth.error) return auth.error
  const { admin, user: adminUser } = auth

  const userId = (request.nextUrl.searchParams.get('userId') || '').trim()
  const email = (request.nextUrl.searchParams.get('email') || '').trim().toLowerCase()
  if (!userId && !email) return NextResponse.json({ error: 'missing_user' }, { status: 400 })

  let targetUser: any = null
  if (userId) {
    const getter = (admin.auth.admin as any).getUserById
    if (typeof getter === 'function') {
      const { data, error } = await getter.call(admin.auth.admin, userId)
      if (!error) targetUser = data?.user || null
    }
  }

  if (!targetUser && email) {
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (error) return NextResponse.json({ error: 'auth_users_failed', details: error.message }, { status: 500 })
    targetUser = data.users.find((item: any) => String(item.email || '').toLowerCase() === email) || null
  }

  const targetUserId = targetUser?.id || userId
  const targetEmail = String(targetUser?.email || email || '').toLowerCase()
  if (!targetUserId) return NextResponse.json({ error: 'user_not_found' }, { status: 404 })

  const since30 = sinceIso(30)
  const since7 = sinceIso(7)
  const since1 = sinceIso(1)

  const { data: cars, error: carsError } = await admin
    .from('cars')
    .select('id,created_at')
    .eq('user_id', targetUserId)
  if (carsError) return NextResponse.json({ error: 'cars_failed', details: carsError.message }, { status: 500 })

  const carIds = (cars || []).map((car: any) => car.id).filter(Boolean)
  const carFilter = (query: any) => carIds.length > 0 ? query.in('car_id', carIds) : null
  const maybeCount = async (query: any) => query ? countQuery(query) : 0

  const [
    fuelCount,
    serviceCount,
    expenseCount,
    reminderCount,
    eventCount,
    eventCount30,
    eventCount7,
    eventCount24,
    errorCount,
    pushCount,
    allEventsData,
    eventsData,
    errorsData,
  ] = await Promise.all([
    maybeCount(carFilter(admin.from('fuel_logs').select('id', { count: 'exact', head: true }))),
    maybeCount(carFilter(admin.from('service_logs').select('id', { count: 'exact', head: true }))),
    maybeCount(carFilter(admin.from('expenses').select('id', { count: 'exact', head: true }).neq('kategorija', 'km_sprememba'))),
    maybeCount(carFilter(admin.from('reminders').select('id', { count: 'exact', head: true }))),
    countQuery(admin.from('app_events').select('id', { count: 'exact', head: true }).eq('user_id', targetUserId)),
    countQuery(admin.from('app_events').select('id', { count: 'exact', head: true }).eq('user_id', targetUserId).gte('created_at', since30)),
    countQuery(admin.from('app_events').select('id', { count: 'exact', head: true }).eq('user_id', targetUserId).gte('created_at', since7)),
    countQuery(admin.from('app_events').select('id', { count: 'exact', head: true }).eq('user_id', targetUserId).gte('created_at', since1)),
    countQuery(admin.from('app_errors').select('id', { count: 'exact', head: true }).eq('user_id', targetUserId)),
    countQuery(admin.from('push_subscriptions').select('id', { count: 'exact', head: true }).eq('user_id', targetUserId)),
    admin.from('app_events')
      .select('id,event_name,page_path,created_at')
      .eq('user_id', targetUserId)
      .order('created_at', { ascending: false })
      .limit(2000),
    admin.from('app_events')
      .select('id,event_name,page_path,created_at,metadata')
      .eq('user_id', targetUserId)
      .gte('created_at', since30)
      .order('created_at', { ascending: false })
      .limit(300),
    admin.from('app_errors')
      .select('id,error_name,page_path,message,status,created_at,app_version,release_channel')
      .eq('user_id', targetUserId)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  if (allEventsData.error) return NextResponse.json({ error: 'all_events_failed', details: allEventsData.error.message }, { status: 500 })
  if (eventsData.error) return NextResponse.json({ error: 'events_failed', details: eventsData.error.message }, { status: 500 })
  if (errorsData.error) return NextResponse.json({ error: 'errors_failed', details: errorsData.error.message }, { status: 500 })

  const events = eventsData.data || []
  const allEvents = allEventsData.data || []
  const sessions = sessionStats(allEvents)
  const meaningfulEvents = events.filter((event: any) => activityEventNames.has(event.event_name)).length
  const firstEvent = events.length > 0 ? events[events.length - 1] : null
  const lastEvent = events[0] || null
  const eventCounts = new Map<string, number>()
  const pageCounts = new Map<string, number>()
  const dayCounts = new Map<string, number>()

  for (const event of events) {
    eventCounts.set(event.event_name, (eventCounts.get(event.event_name) || 0) + 1)
    const page = pageLabel(event.page_path)
    pageCounts.set(page, (pageCounts.get(page) || 0) + 1)
    const day = new Date(event.created_at).toISOString().slice(0, 10)
    dayCounts.set(day, (dayCounts.get(day) || 0) + 1)
  }

  await admin.from('app_events').insert({
    user_id: adminUser.id,
    event_name: 'admin_user_activity_viewed',
    page_path: '/admin',
    metadata: {
      targetUserId,
      targetEmail,
    },
  })

  return NextResponse.json({
    user: {
      id: targetUserId,
      email: targetEmail,
      created_at: targetUser?.created_at || null,
      last_sign_in_at: targetUser?.last_sign_in_at || null,
    },
    summary: {
      cars: (cars || []).length,
      fuel: fuelCount,
      services: serviceCount,
      expenses: expenseCount,
      reminders: reminderCount,
      pushDevices: pushCount,
      events: eventCount,
      events30: eventCount30,
      events7: eventCount7,
      events24: eventCount24,
      meaningfulEvents30: meaningfulEvents,
      errors: errorCount,
      firstEventAt: firstEvent?.created_at || null,
      lastEventAt: lastEvent?.created_at || null,
      sessions: sessions.sessions,
      totalActiveMinutes: sessions.totalActiveMinutes,
      averageSessionMinutes: sessions.averageSessionMinutes,
      longestSessionMinutes: sessions.longestSessionMinutes,
      lastSessionMinutes: sessions.lastSessionMinutes,
      sessionEstimateNote: 'Seje so ocenjene iz dogodkov. Nova seja se zacne po 30 minutah brez aktivnosti.',
      testerSignal: meaningfulEvents >= 3 || fuelCount + serviceCount + expenseCount > 0
        ? 'active'
        : eventCount30 > 0
          ? 'opened'
          : 'silent',
    },
    topEvents: Array.from(eventCounts.entries())
      .map(([name, count]) => ({ name, label: eventLabel(name), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12),
    topPages: Array.from(pageCounts.entries())
      .map(([page, count]) => ({ page, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    daily: Array.from(dayCounts.entries())
      .map(([day, count]) => ({ day, count }))
      .sort((a, b) => a.day.localeCompare(b.day)),
    recentEvents: events.slice(0, 30).map((event: any) => ({
      id: event.id,
      name: event.event_name,
      label: eventLabel(event.event_name),
      page: pageLabel(event.page_path),
      created_at: event.created_at,
    })),
    recentErrors: (errorsData.data || []).map((error: any) => ({
      id: error.id,
      name: error.error_name,
      page: pageLabel(error.page_path),
      message: error.message,
      status: error.status,
      created_at: error.created_at,
      app_version: error.app_version,
      release_channel: error.release_channel,
    })),
  })
}
