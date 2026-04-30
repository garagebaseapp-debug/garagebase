'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BackButton } from '@/lib/nav'
import { useLanguage } from '@/lib/i18n'

type StatCard = {
  label: string
  value: string | number
  hint: string
  color: string
}

const statusLabel: Record<string, { sl: string; en: string }> = {
  new: { sl: 'Novo', en: 'New' },
  planned: { sl: 'Planirano', en: 'Planned' },
  done: { sl: 'Reseno', en: 'Done' },
  rejected: { sl: 'Zavrnjeno', en: 'Rejected' },
}

const pageName = (path?: string | null) => {
  if (!path) return '/'
  const clean = path.split('?')[0] || '/'
  const names: Record<string, string> = {
    '/': 'Landing',
    '/garaza': 'Garaza',
    '/dashboard': 'Dashboard',
    '/vnos-goriva': 'Vnos goriva',
    '/vnos-servisa': 'Vnos servisa',
    '/vnos-stroska': 'Vnos stroska',
    '/stroski': 'Stroski',
    '/report': 'PDF report',
    '/scan': 'QR scan',
    '/nastavitve': 'Nastavitve',
    '/pomocnik': 'Pomocnik',
    '/feedback': 'Feedback',
  }
  return names[clean] || clean.replace('/', '')
}

const eventName = (name: string) => {
  const names: Record<string, string> = {
    page_view: 'Ogled strani',
    settings_open: 'Nastavitve odprte',
    mode_lite_selected: 'Lite izbran',
    mode_full_selected: 'Full izbran',
    feedback_open: 'Feedback odprt',
    admin_open: 'Admin odprt',
    assistant_open: 'Pomocnik odprt',
    report_open: 'Report odprt',
    report_pdf_download: 'PDF prenos',
    qr_scan_open: 'QR scan odprt',
    qr_import_confirmed: 'QR uvoz potrjen',
    fuel_add_open: 'Vnos goriva odprt',
    receipt_scan_clicked: 'Scan racuna',
    receipt_scan_success: 'Racun prebran',
    receipt_scan_failed: 'Racun ni prebran',
    receipt_text_applied: 'Tekst racuna uporabljen',
    fuel_saved: 'Gorivo shranjeno',
    service_add_open: 'Vnos servisa odprt',
    service_saved: 'Servis shranjen',
    service_verification_set: 'Zaupanje servisa',
    expense_add_open: 'Vnos stroska odprt',
    expense_saved: 'Strosek shranjen',
  }
  return names[name] || name
}

const dayKey = (value: string) => new Date(value).toISOString().slice(0, 10)

const rangeLabel: Record<string, string> = {
  '24h': '24h',
  '7d': '7 dni',
  '30d': '30 dni',
  all: 'Vse',
}

const rangeStart = (range: string) => {
  const now = Date.now()
  if (range === '24h') return new Date(now - 24 * 60 * 60 * 1000).toISOString()
  if (range === '7d') return new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()
  if (range === '30d') return new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()
  return null
}

const settingTitle: Record<string, string> = {
  usageMode: 'Lite / Full',
  theme: 'Dark / White',
  garageDisplay: 'Prikaz garaze',
  language: 'Jezik',
  appLockEnabled: 'Biometrija',
  fontSize: 'Velikost pisave',
  desktopColumns: 'Avtov v vrstici web',
  mobileGridColumns: 'Avtov v vrstici app',
  cardFontPercent: 'Pisava na karticah',
  autocomplete: 'Predlagane besede',
  assistantUsage: 'AI pomocnik',
  dateReminder: 'Datumski opomniki',
  kmReminder: 'KM opomniki',
}

const valueLabel = (value: any) => {
  if (value === true) return 'Da'
  if (value === false) return 'Ne'
  if (value === 'temna') return 'Dark'
  if (value === 'svetla') return 'White'
  if (value === 'sl') return 'SLO'
  if (value === 'en') return 'ANG'
  if (value === 'malo') return 'Malo'
  if (value === 'srednje') return 'Srednje'
  if (value === 'veliko') return 'Veliko'
  if (value === 'normalna') return 'Normalna'
  if (value === undefined || value === null || value === '') return 'Neznano'
  return String(value)
}

const reminderChoice = (settings: any, prefix: 'opomnik' | 'opomnikKm') => {
  const red = settings?.[`${prefix}Rdeci`]
  const yellow = settings?.[`${prefix}Rumeni`]
  const green = settings?.[`${prefix}Zeleni`]
  if (red && yellow && green) return 'Nujni + kmalu + vsi'
  if (red && yellow) return 'Nujni + kmalu'
  if (red) return 'Nujni'
  if (yellow) return 'Kmalu'
  if (green) return 'Vsi'
  return 'Izklopljeno'
}

const aggregateSetting = (events: any[], key: string, getter: (metadata: any) => any) => {
  const latestByUser = new Map<string, any>()
  for (const event of events) {
    const userKey = event.user_id || event.id || `${event.created_at}-${Math.random()}`
    const current = latestByUser.get(userKey)
    if (!current || new Date(event.created_at) > new Date(current.created_at)) latestByUser.set(userKey, event)
  }
  const counts = new Map<string, number>()
  for (const event of latestByUser.values()) {
    const raw = getter(event.metadata || {})
    const label = valueLabel(raw)
    counts.set(label, (counts.get(label) || 0) + 1)
  }
  const total = Math.max(1, Array.from(counts.values()).reduce((sum, count) => sum + count, 0))
  return {
    key,
    title: settingTitle[key] || key,
    total: total === 1 && counts.size === 0 ? 0 : total,
    values: Array.from(counts.entries())
      .map(([label, count]) => ({ label, count, percent: Math.round((count / total) * 100) }))
      .sort((a, b) => b.count - a.count),
  }
}

const topSuggestionTerms = (items: any[]) => {
  const stop = new Set(['app', 'aplikacija', 'funkcija', 'garagebase', 'lahko', 'mogoce', 'prosim', 'dodaj', 'dodal', 'uporabno', 'zato', 'ker', 'and', 'the', 'for'])
  const counts = new Map<string, number>()
  for (const item of items) {
    const text = `${item.feature_description || ''} ${item.usefulness_reason || ''} ${item.extra_context || ''}`.toLowerCase()
    const words = text
      .replace(/[^a-z0-9čšžćđ\s]/gi, ' ')
      .split(/\s+/)
      .map((word) => word.trim())
      .filter((word) => word.length > 3 && !stop.has(word))
    const unique = new Set(words)
    for (const word of unique) counts.set(word, (counts.get(word) || 0) + 1)
  }
  return Array.from(counts.entries())
    .map(([term, count]) => ({ term, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
}

export default function AdminPage() {
  const { language } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [message, setMessage] = useState('')
  const [stats, setStats] = useState<any>({
    cars: 0,
    users: 0,
    fuel: 0,
    services: 0,
    expenses: 0,
    push: 0,
    transfers: 0,
    archivedCars: 0,
    receiptAttachments: 0,
    strongServices: 0,
    feedback: 0,
    newFeedback: 0,
    events: 0,
    activeToday: 0,
    active7: 0,
    active30: 0,
    errors: 0,
  })
  const [recentFeedback, setRecentFeedback] = useState<any[]>([])
  const [recentCars, setRecentCars] = useState<any[]>([])
  const [topEvents, setTopEvents] = useState<any[]>([])
  const [topPages, setTopPages] = useState<any[]>([])
  const [dailyActivity, setDailyActivity] = useState<any[]>([])
  const [vehicleTypes, setVehicleTypes] = useState<any[]>([])
  const [topFeedbackTerms, setTopFeedbackTerms] = useState<any[]>([])
  const [recentErrors, setRecentErrors] = useState<any[]>([])
  const [plans, setPlans] = useState<any[]>([])
  const [planEmail, setPlanEmail] = useState('')
  const [planName, setPlanName] = useState('max')
  const [planNote, setPlanNote] = useState('')
  const [planSaving, setPlanSaving] = useState(false)
  const [settingsRange, setSettingsRange] = useState<'24h' | '7d' | '30d' | 'all'>('30d')
  const [settingsStats, setSettingsStats] = useState<any[]>([])

  const tx = (sl: string, en: string) => language === 'en' ? en : sl

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) {
        window.location.href = '/'
        return
      }

      const { data: adminRow, error: adminError } = await supabase
        .from('admin_users')
        .select('email')
        .eq('email', user.email)
        .maybeSingle()

      if (adminError || !adminRow) {
        setIsAdmin(false)
        setMessage(tx('Ta racun nima admin dostopa.', 'This account does not have admin access.'))
        setLoading(false)
        return
      }

      setIsAdmin(true)
      await loadAdminData()
      setLoading(false)
    }
    init()
  }, [settingsRange])

  const countTable = async (table: string) => {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
    if (error) throw error
    return count || 0
  }

  const loadAdminData = async () => {
    setMessage('')
    try {
      const now = Date.now()
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const since30 = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()
      const since7 = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()
      const settingsSince = rangeStart(settingsRange)
      const settingsQuery = supabase
        .from('app_events')
        .select('id,event_name,created_at,user_id,metadata')
        .in('event_name', ['settings_saved', 'settings_snapshot', 'assistant_page_open'])
        .order('created_at', { ascending: false })
        .limit(5000)
      const filteredSettingsQuery = settingsSince ? settingsQuery.gte('created_at', settingsSince) : settingsQuery

      const [
        carsCount,
        fuelCount,
        servicesCount,
        expensesCount,
        pushCount,
        transfersCount,
        feedbackCount,
        eventsCount,
        carsData,
        feedbackData,
        eventsData,
        errorsData,
        settingsData,
        plansData,
      ] = await Promise.all([
        countTable('cars'),
        countTable('fuel_logs'),
        countTable('service_logs'),
        countTable('expenses'),
        countTable('push_subscriptions'),
        countTable('vehicle_transfers'),
        countTable('feedback'),
        countTable('app_events'),
        supabase.from('cars').select('id,user_id,znamka,model,tip_vozila,arhivirano,created_at').order('created_at', { ascending: false }).limit(5000),
        supabase.from('feedback').select('*').order('created_at', { ascending: false }).limit(200),
        supabase.from('app_events').select('event_name,created_at,user_id,page_path,metadata').gte('created_at', since30).order('created_at', { ascending: false }).limit(5000),
        supabase.from('app_errors').select('*').order('created_at', { ascending: false }).limit(30),
        filteredSettingsQuery,
        supabase.from('user_plans').select('*').order('updated_at', { ascending: false }).limit(8),
      ])

      if (carsData.error) throw carsData.error
      if (feedbackData.error) throw feedbackData.error
      if (eventsData.error) throw eventsData.error
      if (settingsData.error) throw settingsData.error
      if (plansData.error) throw plansData.error

      const cars = carsData.data || []
      const events = eventsData.data || []
      const feedbackItems = feedbackData.data || []
      const archivedCars = cars.filter((car: any) => car.arhivirano === true).length
      const receiptAttachments = events.filter((event: any) => event.event_name === 'fuel_saved' || event.event_name === 'service_saved' || event.event_name === 'expense_saved')
        .filter((event: any) => event.metadata?.hasReceipt === true).length
      const strongServices = events.filter((event: any) => event.event_name === 'service_verification_set' && event.metadata?.verificationLevel === 'strong').length
      const settingsEvents = (settingsData.data || []).filter((event: any) => event.event_name === 'settings_saved' || event.event_name === 'settings_snapshot')
      const assistantUsers = new Set((settingsData.data || []).filter((event: any) => event.event_name === 'assistant_page_open').map((event: any) => event.user_id).filter(Boolean)).size
      const uniqueUsers = new Set([
        ...cars.map((car: any) => car.user_id).filter(Boolean),
        ...events.map((event: any) => event.user_id).filter(Boolean),
      ])
      const activeToday = new Set(events.filter((event: any) => new Date(event.created_at) >= todayStart).map((event: any) => event.user_id).filter(Boolean)).size
      const active7 = new Set(events.filter((event: any) => event.created_at >= since7).map((event: any) => event.user_id).filter(Boolean)).size
      const active30 = new Set(events.map((event: any) => event.user_id).filter(Boolean)).size
      const newFeedback = feedbackItems.filter((item: any) => item.status === 'new').length
      const eventCounts = new Map<string, { count: number; users: Set<string> }>()
      const pageCounts = new Map<string, { count: number; users: Set<string> }>()
      const dayCounts = new Map<string, { count: number; users: Set<string> }>()
      for (const event of events) {
        const current = eventCounts.get(event.event_name) || { count: 0, users: new Set<string>() }
        current.count += 1
        if (event.user_id) current.users.add(event.user_id)
        eventCounts.set(event.event_name, current)

        const page = pageName(event.page_path)
        const pageCurrent = pageCounts.get(page) || { count: 0, users: new Set<string>() }
        pageCurrent.count += 1
        if (event.user_id) pageCurrent.users.add(event.user_id)
        pageCounts.set(page, pageCurrent)

        const day = dayKey(event.created_at)
        const dayCurrent = dayCounts.get(day) || { count: 0, users: new Set<string>() }
        dayCurrent.count += 1
        if (event.user_id) dayCurrent.users.add(event.user_id)
        dayCounts.set(day, dayCurrent)
      }
      const top = Array.from(eventCounts.entries())
        .map(([name, value]) => ({ name, label: eventName(name), count: value.count, users: value.users.size }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
      const pages = Array.from(pageCounts.entries())
        .map(([name, value]) => ({ name, count: value.count, users: value.users.size }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8)
      const days = Array.from({ length: 14 }).map((_, index) => {
        const date = new Date(now - (13 - index) * 24 * 60 * 60 * 1000)
        const key = date.toISOString().slice(0, 10)
        const value = dayCounts.get(key)
        return { day: key.slice(5), count: value?.count || 0, users: value?.users.size || 0 }
      })
      const typeCounts = new Map<string, number>()
      for (const car of cars) {
        const type = car.tip_vozila || 'vozilo'
        typeCounts.set(type, (typeCounts.get(type) || 0) + 1)
      }
      const types = Array.from(typeCounts.entries())
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count)

      setStats({
        cars: carsCount,
        users: uniqueUsers.size,
        fuel: fuelCount,
        services: servicesCount,
        expenses: expensesCount,
        push: pushCount,
        transfers: transfersCount,
        archivedCars,
        receiptAttachments,
        strongServices,
        feedback: feedbackCount,
        events: eventsCount,
        newFeedback,
        activeToday,
        active7,
        active30,
        errors: errorsData.error ? 0 : (errorsData.data || []).filter((error: any) => error.status === 'new').length,
      })
      setRecentCars(cars.slice(0, 8))
      setRecentFeedback(feedbackItems.slice(0, 8))
      setTopEvents(top)
      setTopPages(pages)
      setDailyActivity(days)
      setVehicleTypes(types)
      setTopFeedbackTerms(topSuggestionTerms(feedbackItems))
      setRecentErrors(errorsData.error ? [] : (errorsData.data || []))
      setSettingsStats([
        aggregateSetting(settingsEvents, 'usageMode', (m) => m.usageMode),
        aggregateSetting(settingsEvents, 'theme', (m) => m.theme),
        aggregateSetting(settingsEvents, 'garageDisplay', (m) => m.garageDisplay),
        aggregateSetting(settingsEvents, 'language', (m) => m.language),
        aggregateSetting(settingsEvents, 'appLockEnabled', (m) => m.appLockEnabled),
        aggregateSetting(settingsEvents, 'fontSize', (m) => m.fontSize),
        aggregateSetting(settingsEvents, 'desktopColumns', (m) => m.desktopColumns),
        aggregateSetting(settingsEvents, 'mobileGridColumns', (m) => m.mobileGridColumns),
        aggregateSetting(settingsEvents, 'cardFontPercent', (m) => `${m.cardFontPercent || 100}%`),
        aggregateSetting(settingsEvents, 'dateReminder', (m) => reminderChoice(m.garageDisplay === 'grid' ? m.gridSettings : m.listSettings, 'opomnik')),
        aggregateSetting(settingsEvents, 'kmReminder', (m) => reminderChoice(m.garageDisplay === 'grid' ? m.gridSettings : m.listSettings, 'opomnikKm')),
        aggregateSetting(settingsEvents, 'autocomplete', (m) => m.autocomplete),
        {
          key: 'assistantUsage',
          title: settingTitle.assistantUsage,
          total: assistantUsers,
          values: assistantUsers > 0 ? [{ label: 'Odprt', count: assistantUsers, percent: 100 }] : [],
        },
      ])
      setPlans(plansData.data || [])
    } catch (error: any) {
      setMessage(tx(
        'Admin statistika se ni dostopna. Zazeni posodobljen SQL SUPABASE_MIGRACIJA_ADMIN_FEEDBACK.sql.',
        'Admin statistics are not available yet. Run the updated SUPABASE_MIGRACIJA_ADMIN_FEEDBACK.sql.'
      ) + ` ${error.message || ''}`)
    }
  }

  const statCards: StatCard[] = useMemo(() => [
    { label: tx('Aktivni danes', 'Active today'), value: stats.activeToday || 0, hint: tx('uporabniki danes', 'users today'), color: 'text-[#4ade80]' },
    { label: tx('Aktivni 7 dni', 'Active 7 days'), value: stats.active7 || 0, hint: tx('zadnji teden', 'last week'), color: 'text-[#3ecfcf]' },
    { label: tx('Aktivni 30 dni', 'Active 30 days'), value: stats.active30 || 0, hint: tx('zadnji mesec', 'last month'), color: 'text-[#a09aff]' },
    { label: tx('Vozila', 'Vehicles'), value: stats.cars, hint: tx('vsa vozila v sistemu', 'all vehicles in the system'), color: 'text-[#a09aff]' },
    { label: tx('Znani uporabniki', 'Known users'), value: stats.users, hint: tx('iz zadnjih vozil', 'from recent vehicles'), color: 'text-[#3ecfcf]' },
    { label: tx('Tankanja', 'Fill-ups'), value: stats.fuel, hint: tx('vnosi goriva', 'fuel entries'), color: 'text-[#3ecfcf]' },
    { label: tx('Servisi', 'Services'), value: stats.services, hint: tx('servisni vnosi', 'service entries'), color: 'text-[#f59e0b]' },
    { label: tx('Stroski', 'Expenses'), value: stats.expenses, hint: tx('dodatni stroski', 'additional expenses'), color: 'text-[#a09aff]' },
    { label: tx('Push naprave', 'Push devices'), value: stats.push, hint: tx('naročene naprave', 'subscribed devices'), color: 'text-[#4ade80]' },
    { label: tx('QR prenosi', 'QR transfers'), value: stats.transfers, hint: tx('ustvarjene QR kode', 'created QR codes'), color: 'text-[#fca5a5]' },
    { label: tx('Arhiv', 'Archive'), value: stats.archivedCars || 0, hint: tx('arhivirana vozila', 'archived vehicles'), color: 'text-[#3ecfcf]' },
    { label: tx('Racuni/slike', 'Receipts/photos'), value: stats.receiptAttachments || 0, hint: tx('vnosi s prilogami', 'entries with attachments'), color: 'text-[#4ade80]' },
    { label: tx('Strong zapisi', 'Strong records'), value: stats.strongServices || 0, hint: tx('servisi z dokazili', 'services with proof'), color: 'text-[#16a34a]' },
    { label: tx('Feedback', 'Feedback'), value: stats.feedback, hint: `${stats.newFeedback} ${tx('novih', 'new')}`, color: 'text-[#f59e0b]' },
    { label: tx('Dogodki', 'Events'), value: stats.events || 0, hint: tx('kliki in akcije', 'clicks and actions'), color: 'text-[#4ade80]' },
    { label: tx('Napake', 'Errors'), value: stats.errors || 0, hint: tx('nove napake', 'new errors'), color: 'text-[#fca5a5]' },
  ], [stats, language])

  const savePlan = async () => {
    const email = planEmail.trim().toLowerCase()
    if (!email) {
      setMessage(tx('Vnesi email uporabnika.', 'Enter the user email.'))
      return
    }
    setPlanSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('user_plans').upsert({
      email,
      plan: planName,
      note: planNote || null,
      updated_by: user?.id || null,
      updated_at: new Date().toISOString(),
    })
    if (error) {
      setMessage(tx('Paketa ni bilo mogoce shraniti.', 'Could not save the plan.') + ` ${error.message}`)
    } else {
      setMessage(tx('Paket je shranjen.', 'Plan saved.'))
      setPlanEmail('')
      setPlanNote('')
      await loadAdminData()
    }
    setPlanSaving(false)
  }

  const resolveError = async (id: string) => {
    const { error } = await supabase
      .from('app_errors')
      .update({ status: 'resolved' })
      .eq('id', id)
    if (error) {
      setMessage(tx('Napake ni bilo mogoce oznaciti kot resene.', 'Could not mark the error as resolved.') + ` ${error.message}`)
      return
    }
    setRecentErrors((prev) => prev.map((item) => item.id === id ? { ...item, status: 'resolved' } : item))
    setStats((prev: any) => ({ ...prev, errors: Math.max(0, (prev.errors || 0) - 1) }))
  }

  if (loading) return (
    <div className="min-h-screen bg-[#080810] flex items-center justify-center">
      <p className="text-[#5a5a80]">{tx('Nalaganje...', 'Loading...')}</p>
    </div>
  )

  if (!isAdmin) return (
    <div className="min-h-screen bg-[#080810] px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <BackButton href="/nastavitve" />
        <h1 className="text-xl font-bold text-white">Admin</h1>
      </div>
      <div className="rounded-2xl border border-[#ef444455] bg-[#ef444418] p-5 text-[#fca5a5]">
        {message}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#080810] px-4 py-6 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <BackButton href="/nastavitve" />
          <div>
            <h1 className="text-xl font-bold text-white">GarageBase Admin</h1>
            <p className="text-[#5a5a80] text-sm">{tx('Osnovni pregled sistema.', 'Basic system overview.')}</p>
          </div>
        </div>
        <button onClick={loadAdminData}
          className="rounded-xl border border-[#6c63ff66] bg-[#6c63ff22] px-4 py-2 text-sm font-semibold text-[#a09aff]">
          {tx('Osvezi', 'Refresh')}
        </button>
      </div>

      {message && (
        <div className="mb-4 rounded-xl border border-[#f59e0b55] bg-[#f59e0b18] p-4 text-sm text-[#f59e0b]">
          {message}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {statCards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-[#1e1e32] bg-[#0f0f1a] p-4">
            <p className="text-[#5a5a80] text-xs uppercase tracking-wider">{card.label}</p>
            <p className={`mt-2 text-3xl font-black ${card.color}`}>{card.value}</p>
            <p className="mt-1 text-xs text-[#5a5a80]">{card.hint}</p>
          </div>
        ))}
      </div>

      <div className="mb-4 rounded-3xl border border-[#1e1e32] bg-[#0f0f1a] p-5">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-white font-bold">{tx('Nastavitve uporabnikov', 'User settings')}</h2>
            <p className="text-[#5a5a80] text-xs">
              {tx('Pregled Lite/Full, teme, jezika, prikaza, biometrije in ostalih nastavitev.', 'Overview of Lite/Full, theme, language, display, biometrics and other settings.')}
            </p>
          </div>
          <div className="grid grid-cols-4 gap-2 rounded-2xl border border-[#1e1e32] bg-[#13131f] p-1">
            {(['24h', '7d', '30d', 'all'] as const).map((range) => (
              <button key={range} onClick={() => setSettingsRange(range)}
                className={`rounded-xl px-3 py-2 text-xs font-bold transition-all ${
                  settingsRange === range
                    ? 'bg-[#6c63ff] text-white'
                    : 'text-[#5a5a80] hover:bg-[#6c63ff11] hover:text-[#a09aff]'
                }`}>
                {rangeLabel[range]}
              </button>
            ))}
          </div>
        </div>

        {settingsStats.every((item) => item.values.length === 0) ? (
          <div className="rounded-2xl border border-[#f59e0b55] bg-[#f59e0b18] p-4">
            <p className="font-bold text-[#f59e0b]">{tx('Podatki se bodo zaceli zbirati od zdaj naprej.', 'Data will start collecting from now on.')}</p>
            <p className="mt-1 text-sm text-[#fbbf24]">
              {tx('Ko uporabnik shrani nastavitve, se v adminu pokazejo stevilke in procenti.', 'When a user saves settings, numbers and percentages will show here.')}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {settingsStats.map((item) => (
              <div key={item.key} className="rounded-2xl border border-[#1e1e32] bg-[#13131f] p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-bold text-white">{item.title}</h3>
                  <span className="rounded-full bg-[#6c63ff22] px-3 py-1 text-xs font-bold text-[#a09aff]">
                    {item.total} {tx('up.', 'users')}
                  </span>
                </div>
                <div className="flex flex-col gap-3">
                  {item.values.length === 0 ? (
                    <p className="text-xs text-[#5a5a80]">{tx('Ni podatkov.', 'No data.')}</p>
                  ) : item.values.map((value: any) => (
                    <div key={value.label}>
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-white">{value.label}</span>
                        <span className="text-xs font-bold text-[#3ecfcf]">{value.count} / {value.percent}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[#0f0f1a]">
                        <div className="h-full rounded-full bg-gradient-to-r from-[#6c63ff] to-[#3ecfcf]" style={{ width: `${value.percent}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr] mb-4">
        <div className="rounded-2xl border border-[#1e1e32] bg-[#0f0f1a] p-5">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-white font-bold">{tx('Aktivnost zadnjih 14 dni', 'Activity over 14 days')}</h2>
              <p className="text-[#5a5a80] text-xs">{tx('Vsak stolpec prikaze stevilo akcij v appu.', 'Each bar shows app actions.')}</p>
            </div>
            <p className="text-xs text-[#5a5a80]">{tx('Uporabniki + kliki', 'Users + clicks')}</p>
          </div>
          <div className="flex h-44 items-end gap-2">
            {dailyActivity.map((day) => {
              const max = Math.max(...dailyActivity.map((item) => item.count), 1)
              const height = Math.max(10, Math.round((day.count / max) * 100))
              return (
                <div key={day.day} className="flex flex-1 flex-col items-center gap-2">
                  <div className="flex h-32 w-full items-end rounded-xl bg-[#13131f] px-1">
                    <div className="w-full rounded-lg bg-gradient-to-t from-[#6c63ff] to-[#3ecfcf]" style={{ height: `${height}%` }} />
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-[#5a5a80]">{day.day}</p>
                    <p className="text-[10px] font-bold text-white">{day.count}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-[#1e1e32] bg-[#0f0f1a] p-5">
          <h2 className="text-white font-bold">{tx('Napake v sistemu', 'System errors')}</h2>
          <p className="mb-4 text-[#5a5a80] text-xs">{tx('Zadnje napake iz brskalnika uporabnikov.', 'Latest browser errors from users.')}</p>
          <button onClick={() => window.location.href = '/admin-napake'}
            className="mb-4 w-full rounded-xl border border-[#ef444455] bg-[#ef444418] px-3 py-2 text-xs font-bold text-[#fca5a5]">
            {tx('Odpri prijave napak uporabnikov', 'Open user bug reports')}
          </button>
          <div className="flex flex-col gap-2">
            {recentErrors.length === 0 ? (
              <p className="rounded-xl bg-[#13131f] p-4 text-sm text-[#5a5a80]">
                {tx('Za zdaj ni zabelezenih napak.', 'No recorded errors yet.')}
              </p>
            ) : recentErrors.slice(0, 6).map((error) => (
              <div key={error.id} className="rounded-xl border border-[#ef444433] bg-[#ef444411] p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-bold text-[#fca5a5]">{error.error_name}</p>
                  <span className="rounded-full bg-[#ef444422] px-2 py-1 text-[10px] font-bold text-[#fca5a5]">{error.status}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-[#fca5a5]">{error.message || '-'}</p>
                <p className="mt-1 text-[11px] text-[#5a5a80]">{pageName(error.page_path)} · {new Date(error.created_at).toLocaleString(language === 'en' ? 'en-US' : 'sl-SI')}</p>
                {error.status !== 'resolved' && (
                  <button onClick={() => resolveError(error.id)}
                    className="mt-3 rounded-lg border border-[#4ade8055] bg-[#4ade8018] px-3 py-2 text-xs font-bold text-[#4ade80]">
                    {tx('Oznaci kot reseno', 'Mark resolved')}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <div className="rounded-2xl border border-[#1e1e32] bg-[#0f0f1a] p-5">
          <h2 className="text-white font-bold">{tx('Najbolj uporabljene funkcije', 'Most used features')}</h2>
          <p className="mb-4 text-[#5a5a80] text-xs">{tx('Zadnjih 30 dni, za odlocanje o paketih.', 'Last 30 days, useful for package decisions.')}</p>
          <div className="flex flex-col gap-2">
            {topEvents.length === 0 ? (
              <p className="rounded-xl bg-[#13131f] p-4 text-sm text-[#5a5a80]">{tx('Ni zabelezenih dogodkov.', 'No tracked events yet.')}</p>
            ) : topEvents.map((event, index) => (
              <div key={event.name} className="rounded-xl bg-[#13131f] p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-white text-sm font-semibold">{index + 1}. {event.label}</p>
                  <p className="text-[#3ecfcf] font-black">{event.count}</p>
                </div>
                <p className="mt-1 text-xs text-[#5a5a80]">{event.users} {tx('uporabnikov', 'users')}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 border-t border-[#1e1e32] pt-4">
            <h3 className="text-sm font-bold text-white">{tx('Najbolj obiskane strani', 'Most visited pages')}</h3>
            <div className="mt-3 flex flex-col gap-2">
              {topPages.length === 0 ? (
                <p className="rounded-xl bg-[#13131f] p-3 text-xs text-[#5a5a80]">{tx('Ni podatkov o straneh.', 'No page data yet.')}</p>
              ) : topPages.map((page) => (
                <div key={page.name} className="flex items-center justify-between rounded-xl bg-[#13131f] p-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{page.name}</p>
                    <p className="text-xs text-[#5a5a80]">{page.users} {tx('uporabnikov', 'users')}</p>
                  </div>
                  <p className="text-lg font-black text-[#a09aff]">{page.count}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#1e1e32] bg-[#0f0f1a] p-5">
          <h2 className="text-white font-bold">{tx('Paketi uporabnikov', 'User packages')}</h2>
          <p className="mb-4 text-[#5a5a80] text-xs">{tx('Za prvih 6 mesecev lahko vsem pustis max, posameznikom pa rocno nastavis paket.', 'For the first 6 months you can keep max open, while manually assigning plans to individuals.')}</p>
          <div className="grid gap-2 mb-4">
            <input value={planEmail} onChange={(e) => setPlanEmail(e.target.value)} placeholder="email@example.com"
              className="rounded-xl border border-[#1e1e32] bg-[#13131f] px-4 py-3 text-white outline-none focus:border-[#6c63ff]" />
            <select value={planName} onChange={(e) => setPlanName(e.target.value)}
              className="rounded-xl border border-[#1e1e32] bg-[#13131f] px-4 py-3 text-white outline-none focus:border-[#6c63ff]">
              <option value="free">free</option>
              <option value="pro">pro</option>
              <option value="max">max</option>
              <option value="business">business</option>
            </select>
            <input value={planNote} onChange={(e) => setPlanNote(e.target.value)} placeholder={tx('Opomba, npr. prijatelj testira', 'Note, e.g. friend testing')}
              className="rounded-xl border border-[#1e1e32] bg-[#13131f] px-4 py-3 text-white outline-none focus:border-[#6c63ff]" />
            <button onClick={savePlan} disabled={planSaving}
              className="rounded-xl bg-[#6c63ff] py-3 font-semibold text-white disabled:opacity-60">
              {planSaving ? tx('Shranjujem...', 'Saving...') : tx('Shrani paket', 'Save plan')}
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {plans.length === 0 ? (
              <p className="rounded-xl bg-[#13131f] p-4 text-sm text-[#5a5a80]">{tx('Ni rocno nastavljenih paketov.', 'No manually assigned plans.')}</p>
            ) : plans.map((plan) => (
              <div key={plan.email} className="flex items-center justify-between gap-3 rounded-xl bg-[#13131f] p-3">
                <div>
                  <p className="text-white text-sm font-semibold">{plan.email}</p>
                  <p className="text-[#5a5a80] text-xs">{plan.note || '-'}</p>
                </div>
                <span className="rounded-full bg-[#3ecfcf22] px-3 py-1 text-xs font-black text-[#3ecfcf]">{plan.plan}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-[#1e1e32] bg-[#0f0f1a] p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-white font-bold">{tx('Zadnji predlogi', 'Recent suggestions')}</h2>
              <p className="text-[#5a5a80] text-xs">{tx('Hiter pogled na feedback.', 'Quick look at feedback.')}</p>
            </div>
            <button onClick={() => window.location.href = '/admin-feedback'}
              className="rounded-xl bg-[#6c63ff] px-3 py-2 text-xs font-semibold text-white">
              {tx('Odpri vse', 'Open all')}
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {recentFeedback.length === 0 ? (
              <p className="rounded-xl bg-[#13131f] p-4 text-sm text-[#5a5a80]">{tx('Ni predlogov.', 'No suggestions.')}</p>
            ) : recentFeedback.map((item) => (
              <div key={item.id} className="rounded-xl bg-[#13131f] p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-white text-sm font-semibold">{item.feature_description}</p>
                  <span className="shrink-0 rounded-full bg-[#6c63ff22] px-2 py-1 text-[10px] font-bold text-[#a09aff]">
                    {statusLabel[item.status]?.[language] || item.status}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-[#5a5a80]">{item.usefulness_reason}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 border-t border-[#1e1e32] pt-4">
            <h3 className="text-sm font-bold text-white">{tx('Top 3 ponavljajoce teme', 'Top 3 repeated topics')}</h3>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {topFeedbackTerms.length === 0 ? (
                <p className="col-span-3 rounded-xl bg-[#13131f] p-3 text-xs text-[#5a5a80]">{tx('Ni dovolj predlogov za trend.', 'Not enough suggestions for a trend.')}</p>
              ) : topFeedbackTerms.map((item) => (
                <div key={item.term} className="rounded-xl bg-[#f59e0b18] p-3 text-center">
                  <p className="text-sm font-black text-[#f59e0b]">{item.term}</p>
                  <p className="text-xs text-[#5a5a80]">{item.count}x</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#1e1e32] bg-[#0f0f1a] p-5">
          <h2 className="text-white font-bold">{tx('Zadnja vozila', 'Recent vehicles')}</h2>
          <p className="mb-4 text-[#5a5a80] text-xs">{tx('Zadnja dodana vozila v sistemu.', 'Latest vehicles added to the system.')}</p>
          <div className="flex flex-col gap-3">
            {recentCars.length === 0 ? (
              <p className="rounded-xl bg-[#13131f] p-4 text-sm text-[#5a5a80]">{tx('Ni vozil.', 'No vehicles.')}</p>
            ) : recentCars.map((car) => (
              <div key={car.id} className="flex items-center justify-between rounded-xl bg-[#13131f] p-3">
                <div>
                  <p className="text-white text-sm font-semibold">{car.znamka} {car.model}</p>
                  <p className="text-[#5a5a80] text-xs">{car.tip_vozila || tx('Vozilo', 'Vehicle')}</p>
                </div>
                <p className="text-right text-[11px] text-[#5a5a80]">
                  {car.created_at ? new Date(car.created_at).toLocaleDateString(language === 'en' ? 'en-US' : 'sl-SI') : '-'}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-5 border-t border-[#1e1e32] pt-4">
            <h3 className="text-sm font-bold text-white">{tx('Tipi vozil', 'Vehicle types')}</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {vehicleTypes.length === 0 ? (
                <p className="rounded-xl bg-[#13131f] p-3 text-xs text-[#5a5a80]">{tx('Ni podatkov o tipih.', 'No type data yet.')}</p>
              ) : vehicleTypes.map((item) => (
                <span key={item.type} className="rounded-full bg-[#3ecfcf18] px-3 py-2 text-xs font-bold text-[#3ecfcf]">
                  {item.type}: {item.count}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
