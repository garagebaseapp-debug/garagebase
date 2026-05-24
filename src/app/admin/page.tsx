'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BackButton } from '@/lib/nav'
import { useLanguage } from '@/lib/i18n'
import { checkCurrentUserAdmin } from '@/lib/admin-access'

type StatCard = {
  label: string
  value: string | number
  hint: string
  color: string
}

type AdminUser = {
  id: string
  email: string
  created_at?: string
  last_sign_in_at?: string | null
  plan?: any
}

type AdminTab = 'overview' | 'analytics' | 'users' | 'inbox' | 'errors' | 'plans' | 'settings'

type TesterActivity = {
  user: AdminUser
  summary: Record<string, any>
  topEvents: Array<{ name: string; label: string; count: number }>
  topPages: Array<{ page: string; count: number }>
  daily: Array<{ day: string; count: number }>
  recentEvents: Array<{ id: string; label: string; page: string; created_at: string }>
  recentErrors: Array<{ id: string; name: string; page: string; message?: string; status?: string; created_at: string }>
}

type UserControlLimits = {
  readOnly: boolean
  blockReports: boolean
  blockQrTransfer: boolean
  blockUploads: boolean
  blockPush: boolean
  maxCars: number
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
  currency: 'Valuta',
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
  if (value === 'EUR') return 'EUR / €'
  if (value === 'USD') return 'USD / $'
  if (value === 'malo') return 'Malo'
  if (value === 'srednje') return 'Srednje'
  if (value === 'veliko') return 'Veliko'
  if (value === 'normalna') return 'Normalna'
  if (value === undefined || value === null || value === '') return 'Neznano'
  return String(value)
}

const numberValue = (value: unknown) => {
  const parsed = Number(String(value ?? '').replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : 0
}

const moneyText = (value: number) =>
  `${Math.round(value).toLocaleString('sl-SI')} €`

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
    totalRevenue: 0,
    avgCarsPerUser: 0,
    eventsPerActiveUser: 0,
    receiptRate: 0,
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
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([])
  const [userSearch, setUserSearch] = useState('')
  const [usersLoading, setUsersLoading] = useState(false)
  const [planEmail, setPlanEmail] = useState('')
  const [planName, setPlanName] = useState('max')
  const [planNote, setPlanNote] = useState('')
  const [planSource, setPlanSource] = useState('manual')
  const [billingStatus, setBillingStatus] = useState('free_open')
  const [paidConfirm, setPaidConfirm] = useState('')
  const [planSaving, setPlanSaving] = useState(false)
  const [settingsRange, setSettingsRange] = useState<'24h' | '7d' | '30d' | 'all'>('30d')
  const [activeAdminTab, setActiveAdminTab] = useState<AdminTab>('overview')
  const [settingsStats, setSettingsStats] = useState<any[]>([])
  const [clearLoading, setClearLoading] = useState('')
  const [funnelStats, setFunnelStats] = useState<any[]>([])
  const [retentionStats, setRetentionStats] = useState<any[]>([])
  const [userActivity, setUserActivity] = useState<any[]>([])
  const [adminAlerts, setAdminAlerts] = useState<any[]>([])
  const [planSimulation, setPlanSimulation] = useState<any[]>([])
  const [recordMix, setRecordMix] = useState<any[]>([])
  const [costMix, setCostMix] = useState<any[]>([])
  const [conversionStats, setConversionStats] = useState<any[]>([])
  const [errorStatusStats, setErrorStatusStats] = useState<any[]>([])
  const [testerSearch, setTesterSearch] = useState('')
  const [testerCandidates, setTesterCandidates] = useState<AdminUser[]>([])
  const [testerSearchLoading, setTesterSearchLoading] = useState(false)
  const [testerLoading, setTesterLoading] = useState(false)
  const [selectedTester, setSelectedTester] = useState<AdminUser | null>(null)
  const [testerActivity, setTesterActivity] = useState<TesterActivity | null>(null)
  const [controlStatus, setControlStatus] = useState('normal')
  const [controlReason, setControlReason] = useState('')
  const [controlInternalNote, setControlInternalNote] = useState('')
  const [controlBlockedUntil, setControlBlockedUntil] = useState('')
  const [controlPlan, setControlPlan] = useState('')
  const [controlPlanNote, setControlPlanNote] = useState('')
  const [controlLimits, setControlLimits] = useState<UserControlLimits>({
    readOnly: false,
    blockReports: false,
    blockQrTransfer: false,
    blockUploads: false,
    blockPush: false,
    maxCars: 0,
  })
  const [controlSaving, setControlSaving] = useState(false)
  const [adminInboxNotice, setAdminInboxNotice] = useState('')

  const tx = (sl: string, en: string) => language === 'en' ? en : sl
  const adminUserById = useMemo(() => new Map(adminUsers.map((user) => [user.id, user])), [adminUsers])
  const userDisplayName = (user: any) => adminUserById.get(user.userId)?.email || `U-${user.label}`
  const minuteText = (value: any) => `${Number(value || 0)} ${tx('min', 'min')}`
  const toLocalDateInput = (value?: string | null) => {
    if (!value) return ''
    const date = new Date(value)
    if (!Number.isFinite(date.getTime())) return ''
    const offset = date.getTimezoneOffset() * 60000
    return new Date(date.getTime() - offset).toISOString().slice(0, 16)
  }
  const setLimitValue = (key: keyof UserControlLimits, value: boolean | number) => {
    setControlLimits((current) => ({ ...current, [key]: value }))
  }

  const openAdminTab = (tab: AdminTab) => {
    setActiveAdminTab(tab)
    if (tab === 'inbox') {
      try {
        localStorage.setItem('garagebase_admin_inbox_seen_at', String(Date.now()))
        setAdminInboxNotice('')
      } catch {}
    }
    try { window.scrollTo({ top: 0, behavior: 'smooth' }) } catch {}
  }

  useEffect(() => {
    const init = async () => {
      const adminCheck = await checkCurrentUserAdmin()
      if (!adminCheck.user?.email) {
        window.location.href = '/'
        return
      }

      if (!adminCheck.isAdmin) {
        setIsAdmin(false)
        setMessage(tx('Ta racun nima admin dostopa.', 'This account does not have admin access.'))
        setLoading(false)
        return
      }

      setIsAdmin(true)
      await loadAdminData()
      setLoading(false)
      loadAdminUsers()
    }
    init()
  }, [settingsRange])

  useEffect(() => {
    if (!isAdmin) return
    if (activeAdminTab !== 'users') return
    const query = testerSearch.trim()
    if (query.length < 2) {
      setTesterCandidates([])
      return
    }

    const timer = window.setTimeout(() => {
      loadTesterCandidates(query)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [testerSearch, isAdmin, activeAdminTab])

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
        fuelMoneyData,
        serviceMoneyData,
        expenseMoneyData,
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
        supabase.from('fuel_logs').select('car_id,cena_skupaj,receipt_url,created_at').limit(5000),
        supabase.from('service_logs').select('car_id,cena,foto_url,created_at').limit(5000),
        supabase.from('expenses').select('car_id,znesek,receipt_url,kategorija,created_at').neq('kategorija', 'km_sprememba').limit(5000),
      ])

      if (carsData.error) throw carsData.error
      if (feedbackData.error) throw feedbackData.error
      if (eventsData.error) throw eventsData.error
      if (settingsData.error) throw settingsData.error
      if (plansData.error) throw plansData.error
      if (fuelMoneyData.error) throw fuelMoneyData.error
      if (serviceMoneyData.error) throw serviceMoneyData.error
      if (expenseMoneyData.error) throw expenseMoneyData.error

      const cars = carsData.data || []
      const events = eventsData.data || []
      const feedbackItems = feedbackData.data || []
      const fuelMoney = fuelMoneyData.data || []
      const serviceMoney = serviceMoneyData.data || []
      const expenseMoney = expenseMoneyData.data || []
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
      const newFeedbackItems = feedbackItems.filter((item: any) => item.status === 'new')
      const newFeedback = newFeedbackItems.length
      const totalRevenue =
        fuelMoney.reduce((sum: number, row: any) => sum + numberValue(row.cena_skupaj), 0) +
        serviceMoney.reduce((sum: number, row: any) => sum + numberValue(row.cena), 0) +
        expenseMoney.reduce((sum: number, row: any) => sum + numberValue(row.znesek), 0)
      const receiptRows =
        fuelMoney.filter((row: any) => row.receipt_url).length +
        serviceMoney.filter((row: any) => row.foto_url).length +
        expenseMoney.filter((row: any) => row.receipt_url).length
      const totalManualRows = Math.max(1, fuelMoney.length + serviceMoney.length + expenseMoney.length)
      const carOwner = new Map<string, string>(
        cars
          .filter((car: any) => car.id && car.user_id)
          .map((car: any) => [String(car.id), String(car.user_id)] as [string, string])
      )
      const userCarCounts = new Map<string, number>()
      for (const car of cars) {
        if (!car.user_id) continue
        userCarCounts.set(car.user_id, (userCarCounts.get(car.user_id) || 0) + 1)
      }
      const ownerFromRow = (row: any) => carOwner.get(row.car_id)
      const fuelUsers = new Set(fuelMoney.map(ownerFromRow).filter(Boolean))
      const serviceUsers = new Set(serviceMoney.map(ownerFromRow).filter(Boolean))
      const expenseUsers = new Set(expenseMoney.map(ownerFromRow).filter(Boolean))
      const entryUsers = new Set([...fuelUsers, ...serviceUsers, ...expenseUsers])
      const reportUsers = new Set(events.filter((event: any) => String(event.event_name).includes('report')).map((event: any) => event.user_id).filter(Boolean))
      const qrUsers = new Set(events.filter((event: any) => String(event.event_name).includes('qr') || String(event.event_name).includes('transfer')).map((event: any) => event.user_id).filter(Boolean))
      const baseUsersCount = Math.max(1, uniqueUsers.size)
      const funnel = [
        { label: tx('Znani uporabniki', 'Known users'), value: uniqueUsers.size, hint: tx('vozila ali dogodki', 'vehicles or events') },
        { label: tx('Dodali vozilo', 'Added vehicle'), value: userCarCounts.size, hint: tx('vsaj eno vozilo', 'at least one vehicle') },
        { label: tx('Prvi vnos', 'First entry'), value: entryUsers.size, hint: tx('gorivo, servis ali strošek', 'fuel, service or expense') },
        { label: tx('Odprli report', 'Opened report'), value: reportUsers.size, hint: tx('PDF/report zanimanje', 'PDF/report interest') },
        { label: tx('QR/prenos', 'QR/transfer'), value: qrUsers.size, hint: tx('prenos zgodovine', 'history transfer') },
      ].map((item) => ({ ...item, percent: Math.round((item.value / baseUsersCount) * 100) }))
      const firstSeen = new Map<string, number>()
      const lastSeen = new Map<string, number>()
      const eventCountByUser = new Map<string, number>()
      for (const event of events) {
        if (!event.user_id) continue
        const time = new Date(event.created_at).getTime()
        firstSeen.set(event.user_id, Math.min(firstSeen.get(event.user_id) || time, time))
        lastSeen.set(event.user_id, Math.max(lastSeen.get(event.user_id) || time, time))
        eventCountByUser.set(event.user_id, (eventCountByUser.get(event.user_id) || 0) + 1)
      }
      const retained = (daysAfter: number) => {
        let count = 0
        for (const [userId, first] of firstSeen.entries()) {
          const last = lastSeen.get(userId) || first
          if (last - first >= daysAfter * 24 * 60 * 60 * 1000) count += 1
        }
        return count
      }
      const retentionBase = Math.max(1, firstSeen.size)
      const retention = [
        { label: 'Day 1', value: retained(1) },
        { label: 'Day 7', value: retained(7) },
        { label: 'Day 30', value: retained(30) },
      ].map((item) => ({ ...item, percent: Math.round((item.value / retentionBase) * 100) }))
      const errorsByUser = new Map<string, number>()
      for (const error of (errorsData.data || [])) {
        if (!error.user_id) continue
        errorsByUser.set(error.user_id, (errorsByUser.get(error.user_id) || 0) + 1)
      }
      const entriesByUser = new Map<string, number>()
      for (const row of [...fuelMoney, ...serviceMoney, ...expenseMoney]) {
        const owner = ownerFromRow(row)
        if (!owner) continue
        entriesByUser.set(owner, (entriesByUser.get(owner) || 0) + 1)
      }
      const userRows = Array.from(uniqueUsers).map((userId: any) => ({
        userId,
        label: String(userId).slice(0, 8),
        cars: userCarCounts.get(userId) || 0,
        entries: entriesByUser.get(userId) || 0,
        events: eventCountByUser.get(userId) || 0,
        errors: errorsByUser.get(userId) || 0,
        lastSeen: lastSeen.get(userId) || 0,
      })).sort((a, b) => b.events - a.events).slice(0, 8)
      const planBuckets = [
        { label: 'Free', range: tx('0-1 vozilo', '0-1 vehicle'), count: 0, color: 'bg-[#3ecfcf]' },
        { label: 'Basic', range: tx('2-3 vozila', '2-3 vehicles'), count: 0, color: 'bg-[#6c63ff]' },
        { label: 'Pro', range: tx('4-10 vozil', '4-10 vehicles'), count: 0, color: 'bg-[#a855f7]' },
        { label: 'Business', range: tx('10+ / flota', '10+ / fleet'), count: 0, color: 'bg-[#f59e0b]' },
      ]
      for (const count of userCarCounts.values()) {
        if (count <= 1) planBuckets[0].count += 1
        else if (count <= 3) planBuckets[1].count += 1
        else if (count <= 10) planBuckets[2].count += 1
        else planBuckets[3].count += 1
      }
      const maxPlanCount = Math.max(1, ...planBuckets.map((item) => item.count))
      const newErrorItems = errorsData.error ? [] : (errorsData.data || []).filter((error: any) => error.status === 'new')
      const newErrorsCount = newErrorItems.length
      const latestInboxTime = Math.max(
        0,
        ...newFeedbackItems.map((item: any) => new Date(item.created_at).getTime()).filter(Number.isFinite),
        ...newErrorItems.map((item: any) => new Date(item.created_at).getTime()).filter(Number.isFinite)
      )
      try {
        const seenAt = Number(localStorage.getItem('garagebase_admin_inbox_seen_at') || 0)
        const remindedAt = Number(localStorage.getItem('garagebase_admin_inbox_reminded_at') || 0)
        const twelveHours = 12 * 60 * 60 * 1000
        if (latestInboxTime > seenAt && latestInboxTime > 0 && Date.now() - remindedAt > twelveHours) {
          const totalInbox = newFeedback + newErrorsCount
          setAdminInboxNotice(tx(
            `Imaš ${totalInbox} novih predlogov ali napak. Odpri zavihek Predlogi / napake.`,
            `You have ${totalInbox} new suggestions or errors. Open the Suggestions / errors tab.`
          ))
          localStorage.setItem('garagebase_admin_inbox_reminded_at', String(Date.now()))
        } else {
          setAdminInboxNotice('')
        }
      } catch {}
      const recordTotal = Math.max(1, fuelMoney.length + serviceMoney.length + expenseMoney.length)
      const recordItems = [
        { label: tx('Gorivo', 'Fuel'), value: fuelMoney.length, color: 'bg-[#6c63ff]' },
        { label: tx('Servisi', 'Services'), value: serviceMoney.length, color: 'bg-[#3ecfcf]' },
        { label: tx('Stroski', 'Costs'), value: expenseMoney.length, color: 'bg-[#f59e0b]' },
      ].map((item) => ({ ...item, percent: Math.round((item.value / recordTotal) * 100) }))
      const fuelCost = fuelMoney.reduce((sum: number, row: any) => sum + numberValue(row.cena_skupaj), 0)
      const serviceCost = serviceMoney.reduce((sum: number, row: any) => sum + numberValue(row.cena), 0)
      const expenseCost = expenseMoney.reduce((sum: number, row: any) => sum + numberValue(row.znesek), 0)
      const costTotal = Math.max(1, fuelCost + serviceCost + expenseCost)
      const costItems = [
        { label: tx('Gorivo', 'Fuel'), value: fuelCost, color: 'bg-[#6c63ff]' },
        { label: tx('Servisi', 'Services'), value: serviceCost, color: 'bg-[#3ecfcf]' },
        { label: tx('Stroski', 'Costs'), value: expenseCost, color: 'bg-[#f59e0b]' },
      ].map((item) => ({ ...item, percent: Math.round((item.value / costTotal) * 100) }))
      const eventCount = (name: string) => events.filter((event: any) => event.event_name === name).length
      const eventIncludesCount = (needle: string) => events.filter((event: any) => String(event.event_name).includes(needle)).length
      const ocrClicks = eventCount('receipt_scan_clicked')
      const ocrSuccess = eventCount('receipt_scan_success')
      const reportOpen = eventIncludesCount('report')
      const qrTransfer = events.filter((event: any) => String(event.event_name).includes('qr') || String(event.event_name).includes('transfer')).length
      const saveOpens = eventCount('fuel_add_open') + eventCount('service_add_open') + eventCount('expense_add_open')
      const saves = eventCount('fuel_saved') + eventCount('service_saved') + eventCount('expense_saved')
      const conversionItems = [
        { label: tx('Vnos odprt -> shranjen', 'Entry opened -> saved'), value: saveOpens ? Math.round((saves / saveOpens) * 100) : 0, detail: `${saves}/${saveOpens}` },
        { label: tx('OCR klik -> uspeh', 'OCR click -> success'), value: ocrClicks ? Math.round((ocrSuccess / ocrClicks) * 100) : 0, detail: `${ocrSuccess}/${ocrClicks}` },
        { label: tx('Report -> QR/prenos', 'Report -> QR/transfer'), value: reportOpen ? Math.round((qrTransfer / reportOpen) * 100) : 0, detail: `${qrTransfer}/${reportOpen}` },
        { label: tx('Napake na 100 dogodkov', 'Errors per 100 events'), value: events.length ? Math.round((newErrorsCount / events.length) * 100) : 0, detail: `${newErrorsCount}/${events.length}` },
      ]
      const errorStatusCounts = new Map<string, number>()
      for (const error of (errorsData.data || [])) {
        const key = error.status || 'new'
        errorStatusCounts.set(key, (errorStatusCounts.get(key) || 0) + 1)
      }
      const errorStatusTotal = Math.max(1, Array.from(errorStatusCounts.values()).reduce((sum, count) => sum + count, 0))
      const errorStatuses = Array.from(errorStatusCounts.entries())
        .map(([label, count]) => ({ label, count, percent: Math.round((count / errorStatusTotal) * 100) }))
        .sort((a, b) => b.count - a.count)
      const alerts = [
        ...(newFeedback > 0 ? [{ tone: 'purple', title: tx('Novi predlogi', 'New suggestions'), text: tx(`${newFeedback} novih predlogov čaka pregled.`, `${newFeedback} new suggestions need review.`) }] : []),
        ...(newErrorsCount > 0 ? [{ tone: 'red', title: tx('Nove napake', 'New errors'), text: tx(`${newErrorsCount} novih napak čaka pregled.`, `${newErrorsCount} new errors need review.`) }] : []),
        ...(receiptRows / totalManualRows < 0.25 ? [{ tone: 'yellow', title: tx('Malo dokazil', 'Low proof rate'), text: tx('Manj kot 25% vnosov ima priložen račun.', 'Less than 25% of entries have attached receipts.') }] : []),
        ...(Array.from(userCarCounts.values()).some((count) => count >= 10) ? [{ tone: 'purple', title: tx('Limit vozil', 'Vehicle limit'), text: tx('Nekateri uporabniki so blizu limita 10 vozil.', 'Some users are close to the 10 vehicle limit.') }] : []),
        ...(active30 === 0 ? [{ tone: 'yellow', title: tx('Ni aktivnosti', 'No activity'), text: tx('V zadnjih 30 dneh ni zabeleženih aktivnih uporabnikov.', 'No active users recorded in the last 30 days.') }] : []),
      ]
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
        totalRevenue,
        avgCarsPerUser: uniqueUsers.size > 0 ? carsCount / uniqueUsers.size : 0,
        eventsPerActiveUser: active30 > 0 ? events.length / active30 : 0,
        receiptRate: Math.round((receiptRows / totalManualRows) * 100),
        errors: newErrorsCount,
      })
      setRecentCars(cars.slice(0, 8))
      setRecentFeedback(feedbackItems.slice(0, 8))
      setTopEvents(top)
      setTopPages(pages)
      setDailyActivity(days)
      setVehicleTypes(types)
      setTopFeedbackTerms(topSuggestionTerms(feedbackItems))
      setRecentErrors(errorsData.error ? [] : (errorsData.data || []))
      setFunnelStats(funnel)
      setRetentionStats(retention)
      setUserActivity(userRows)
      setPlanSimulation(planBuckets.map((item) => ({ ...item, percent: Math.round((item.count / maxPlanCount) * 100) })))
      setAdminAlerts(alerts)
      setRecordMix(recordItems)
      setCostMix(costItems)
      setConversionStats(conversionItems)
      setErrorStatusStats(errorStatuses)
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
        aggregateSetting(settingsEvents, 'currency', (m) => m.currency),
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

  const loadAdminUsers = async (search = userSearch) => {
    setUsersLoading(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      const response = await fetch(`/api/admin/users?search=${encodeURIComponent(search.trim())}`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        cache: 'no-store',
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.details || result.error || 'users_failed')
      setAdminUsers(result.users || [])
      if (Array.isArray(result.plans)) setPlans(result.plans.slice(0, 8))
    } catch (error: any) {
      setMessage(tx('Uporabnikov ni bilo mogoce naloziti.', 'Could not load users.') + ` ${error.message || ''}`)
    } finally {
      setUsersLoading(false)
    }
  }

  const selectAdminUser = (user: AdminUser) => {
    setPlanEmail(user.email)
    setPlanName(user.plan?.plan || 'max')
    setPlanNote(user.plan?.note || '')
    setPlanSource(user.plan?.source || 'manual')
    setBillingStatus(user.plan?.billing_status || 'free_open')
    setPaidConfirm('')
  }

  const loadTesterCandidates = async (search = testerSearch) => {
    const query = search.trim()
    if (query.length < 2) return
    setTesterSearchLoading(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      const response = await fetch(`/api/admin/users?search=${encodeURIComponent(query)}&perPage=12`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        cache: 'no-store',
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.details || result.error || 'tester_search_failed')
      setTesterCandidates(result.users || [])
    } catch (error: any) {
      setMessage(tx('Testerjev ni bilo mogoce poiskati.', 'Could not search testers.') + ` ${error.message || ''}`)
    } finally {
      setTesterSearchLoading(false)
    }
  }

  const loadTesterActivity = async (user: AdminUser) => {
    setSelectedTester(user)
    setTesterActivity(null)
    setControlPlan('')
    setControlPlanNote('')
    setTesterLoading(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      const params = new URLSearchParams({ userId: user.id, email: user.email })
      const response = await fetch(`/api/admin/user-activity?${params.toString()}`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        cache: 'no-store',
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.details || result.error || 'tester_activity_failed')
      setTesterActivity(result)
      const controlsResponse = await fetch(`/api/admin/user-controls?${params.toString()}`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        cache: 'no-store',
      })
      const controlsResult = await controlsResponse.json().catch(() => ({}))
      if (controlsResponse.ok) {
        const controls = controlsResult.controls || {}
        const limits = controls.feature_limits || {}
        setControlStatus(controls.status || 'normal')
        setControlReason(controls.reason || '')
        setControlInternalNote(controls.internal_note || '')
        setControlBlockedUntil(toLocalDateInput(controls.blocked_until))
        setControlLimits({
          readOnly: Boolean(limits.readOnly),
          blockReports: Boolean(limits.blockReports),
          blockQrTransfer: Boolean(limits.blockQrTransfer),
          blockUploads: Boolean(limits.blockUploads),
          blockPush: Boolean(limits.blockPush),
          maxCars: Number(limits.maxCars || 0) || 0,
        })
      }
    } catch (error: any) {
      setMessage(tx('Aktivnosti testerja ni bilo mogoce naloziti.', 'Could not load tester activity.') + ` ${error.message || ''}`)
    } finally {
      setTesterLoading(false)
    }
  }

  const saveTesterControls = async () => {
    if (!selectedTester) return
    setControlSaving(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      const response = await fetch('/api/admin/user-controls', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          userId: selectedTester.id,
          email: selectedTester.email,
          status: controlStatus,
          reason: controlReason,
          internalNote: controlInternalNote,
          blockedUntil: controlBlockedUntil || null,
          featureLimits: controlLimits,
          plan: controlPlan || undefined,
          planNote: controlPlanNote,
        }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.details || result.error || 'controls_save_failed')
      setMessage(tx('Omejitve in paket so shranjeni.', 'Limits and package are saved.'))
      await loadAdminData()
    } catch (error: any) {
      setMessage(tx('Omejitev ni bilo mogoce shraniti.', 'Could not save limits.') + ` ${error.message || ''}`)
    } finally {
      setControlSaving(false)
    }
  }

  const statCards: StatCard[] = useMemo(() => [
    { label: tx('Aktivni danes', 'Active today'), value: stats.activeToday || 0, hint: tx('uporabniki danes', 'users today'), color: 'text-[#4ade80]' },
    { label: tx('Aktivni 7 dni', 'Active 7 days'), value: stats.active7 || 0, hint: tx('zadnji teden', 'last week'), color: 'text-[#3ecfcf]' },
    { label: tx('Aktivni 30 dni', 'Active 30 days'), value: stats.active30 || 0, hint: tx('zadnji mesec', 'last month'), color: 'text-[#a09aff]' },
    { label: tx('Evidentirani stroški', 'Recorded costs'), value: moneyText(stats.totalRevenue || 0), hint: tx('gorivo + servisi + stroški', 'fuel + services + expenses'), color: 'text-[#f59e0b]' },
    { label: tx('Vozila', 'Vehicles'), value: stats.cars, hint: tx('vsa vozila v sistemu', 'all vehicles in the system'), color: 'text-[#a09aff]' },
    { label: tx('Znani uporabniki', 'Known users'), value: stats.users, hint: tx('iz zadnjih vozil', 'from recent vehicles'), color: 'text-[#3ecfcf]' },
    { label: tx('Vozil/uporabnika', 'Vehicles/user'), value: (stats.avgCarsPerUser || 0).toFixed(1), hint: tx('povprečje za paketne limite', 'average for plan limits'), color: 'text-[#a09aff]' },
    { label: tx('Računi pri vnosih', 'Receipts on entries'), value: `${stats.receiptRate || 0}%`, hint: tx('delež vnosov z dokazilom', 'share with proof'), color: 'text-[#4ade80]' },
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
    const existing = plans.find((plan) => String(plan.email).toLowerCase() === email)
    const protectedPaid = existing && (existing.locked === true || existing.source === 'paid' || existing.billing_status === 'paid_active')
    if (protectedPaid && paidConfirm.trim().toUpperCase() !== 'PLACILO') {
      setMessage(tx('Za placljivega uporabnika najprej vpisi PLACILO v potrditveno polje.', 'For a paid user, type PLACILO in the confirmation field first.'))
      return
    }
    setPlanSaving(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          email,
          plan: planName,
          note: planNote,
          source: planSource,
          billingStatus,
          confirmPaidChange: paidConfirm.trim().toUpperCase() === 'PLACILO',
        }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.details || result.error || 'plan_save_failed')
      setMessage(tx('Paket je shranjen.', 'Plan saved.'))
      setPlanEmail('')
      setPlanNote('')
      setPaidConfirm('')
      await Promise.all([loadAdminData(), loadAdminUsers()])
    } catch (error: any) {
      setMessage(tx('Paketa ni bilo mogoce shraniti.', 'Could not save the plan.') + ` ${error.message || ''}`)
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

  const updateFeedbackStatus = async (id: string, status: string) => {
    const previous = recentFeedback
    setRecentFeedback((prev) => prev.map((item) => item.id === id ? { ...item, status } : item))
    const { error } = await supabase.from('feedback').update({ status }).eq('id', id)
    if (error) {
      setRecentFeedback(previous)
      setMessage(tx('Statusa predloga ni bilo mogoče shraniti.', 'Could not save the suggestion status.') + ` ${error.message}`)
      return
    }
    if (status !== 'new') {
      setStats((prev: any) => ({ ...prev, newFeedback: Math.max(0, (prev.newFeedback || 0) - 1) }))
    }
  }

  const clearAnalyticsHistory = async (range: '24h' | '7d' | '30d' | 'all') => {
    const confirmedRange = window.confirm(range === 'all'
      ? tx(
        'POZOR: to bo izbrisalo celotno zgodovino klikov in analitike od zacetka. Tega ni mogoce razveljaviti. Res zelis nadaljevati?',
        'WARNING: this will delete the entire click and analytics history from the beginning. This cannot be undone. Do you really want to continue?'
      )
      : tx(
        `POZOR: izbrisal bos zgodovino analitike za obdobje ${rangeLabel[range]}. Tega ni mogoce razveljaviti. Nadaljujem?`,
        `WARNING: you are deleting analytics history for ${rangeLabel[range]}. This cannot be undone. Continue?`
      ))
    if (!confirmedRange) return
    if (range === 'all') {
      const confirmed = window.confirm(tx(
        'To bo izbrisalo celotno zgodovino klikov in analitike od začetka. Tega ni mogoče razveljaviti. Res želiš nadaljevati?',
        'This will delete the entire click and analytics history from the beginning. This cannot be undone. Do you really want to continue?'
      ))
      if (!confirmed) return
    }

    setClearLoading(range)
    setMessage('')
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      const response = await fetch('/api/admin/clear-analytics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ range }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.details || result.error || 'delete_failed')
      setMessage(tx('Zgodovina analitike je počiščena.', 'Analytics history has been cleared.'))
      await loadAdminData()
    } catch (error: any) {
      setMessage(tx('Zgodovine ni bilo mogoče počistiti.', 'Could not clear history.') + ` ${error.message || ''}`)
    }
    setClearLoading('')
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
    <div className="min-h-screen bg-[#080810] px-4 py-6 pb-24 xl:px-8">
      <div className="mx-auto max-w-7xl">
      <div className="mb-6 rounded-[28px] border border-[#1e1e32] bg-[radial-gradient(circle_at_top_right,rgba(108,99,255,0.22),transparent_38%),#0f0f1a] p-5 shadow-2xl shadow-black/20">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BackButton href="/nastavitve" />
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-[#6c63ff]">GB GarageBase</p>
            <h1 className="mt-2 text-2xl font-black text-white md:text-4xl">{tx('Globalna analitika in uporabniški insights', 'Global analytics and user insights')}</h1>
            <p className="mt-2 text-[#8a8aa8] text-sm">{tx('Pregled uporabnikov, dogodkov, stroškov, napak, paketov in nastavitev.', 'Overview of users, events, costs, errors, plans and settings.')}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={loadAdminData}
            className="rounded-xl border border-[#6c63ff66] bg-[#6c63ff22] px-4 py-2 text-sm font-semibold text-[#a09aff]">
            {tx('Osveži podatke', 'Refresh data')}
          </button>
          <button onClick={() => window.location.href = '/admin-napake'}
            className="rounded-xl border border-[#ef444466] bg-[#ef444418] px-4 py-2 text-sm font-semibold text-[#fca5a5]">
            {tx('Napake', 'Errors')}
          </button>
          <button onClick={() => window.location.href = '/admin-feedback'}
            className="rounded-xl border border-[#3ecfcf66] bg-[#3ecfcf18] px-4 py-2 text-sm font-semibold text-[#3ecfcf]">
            Feedback
          </button>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2 md:grid-cols-7">
        {[
          { label: tx('Pregled', 'Overview'), tab: 'overview' as AdminTab },
          { label: tx('Analitika', 'Analytics'), tab: 'analytics' as AdminTab },
          { label: tx('Uporabniki', 'Users'), tab: 'users' as AdminTab },
          { label: tx('Predlogi / napake', 'Suggestions / errors'), tab: 'inbox' as AdminTab, badge: (stats.newFeedback || 0) + (stats.errors || 0) },
          { label: tx('Napake', 'Errors'), tab: 'errors' as AdminTab },
          { label: tx('Monetizacija', 'Monetization'), tab: 'plans' as AdminTab },
          { label: tx('Nastavitve', 'Settings'), tab: 'settings' as AdminTab },
        ].map((item) => (
          <button
            key={item.tab}
            onClick={() => openAdminTab(item.tab)}
            className={`rounded-2xl border px-4 py-3 text-center text-sm font-black transition-all ${
              activeAdminTab === item.tab
                ? 'border-[#a855f7] bg-[#7c3aed] !text-white shadow-lg shadow-[#7c3aed55]'
                : 'border-[#1e1e32] bg-[#13131f] text-[#d8d8e8] hover:border-[#6c63ff66] hover:text-white'
            }`}
          >
            <span>{item.label}</span>
            {Boolean((item as any).badge) && (
              <span className="ml-2 inline-flex min-w-6 items-center justify-center rounded-full bg-[#ef4444] px-2 py-0.5 text-[11px] font-black !text-white">
                {(item as any).badge}
              </span>
            )}
          </button>
        ))}
      </div>
      </div>

      {message && (
        <div className="mb-4 rounded-xl border border-[#f59e0b55] bg-[#f59e0b18] p-4 text-sm text-[#f59e0b]">
          {message}
        </div>
      )}

      {adminInboxNotice && (
        <button
          onClick={() => openAdminTab('inbox')}
          className="mb-4 w-full rounded-2xl border-2 border-[#6c63ff] bg-[#6c63ff22] p-4 text-left text-sm font-black text-[#ded9ff] shadow-lg shadow-[#6c63ff22]"
        >
          {adminInboxNotice}
        </button>
      )}

      {stats.errors > 0 && (
        <div className="mb-4 rounded-2xl border-2 border-[#ef4444] bg-[#ef44441f] p-4 text-sm font-bold text-[#fecaca] shadow-lg shadow-[#ef444422]">
          {tx(`Pozor: ${stats.errors} novih napak v aplikaciji.`, `Attention: ${stats.errors} new app errors.`)}
        </div>
      )}

      <div className="mb-5 rounded-[28px] border border-[#2b2b45] bg-[#0f0f1a] p-5 shadow-2xl shadow-black/20">
        {activeAdminTab === 'overview' && (
          <>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-[#6c63ff]">{tx('Pregled', 'Overview')}</p>
                <h2 className="mt-1 text-2xl font-black text-white">{tx('Stanje aplikacije', 'Application status')}</h2>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-black ${stats.errors > 0 ? 'bg-[#ef444422] text-[#fca5a5]' : 'bg-[#16a34a22] text-[#4ade80]'}`}>
                {stats.errors > 0 ? tx('Preveri napake', 'Check errors') : tx('Stabilno', 'Stable')}
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              {statCards.slice(0, 4).map((card) => (
                <div key={card.label} className="rounded-2xl border border-[#1e1e32] bg-[#13131f] p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#8a8aa8]">{card.label}</p>
                  <p className={`mt-2 text-2xl font-black ${card.color}`}>{card.value}</p>
                  <p className="mt-1 text-xs text-[#5a5a80]">{card.hint}</p>
                </div>
              ))}
            </div>
          </>
        )}
        {activeAdminTab === 'analytics' && (
          <>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[#6c63ff]">{tx('Analitika', 'Analytics')}</p>
            <h2 className="mt-1 text-2xl font-black text-white">{tx('Uporaba in tokovi', 'Usage and flows')}</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {conversionStats.slice(0, 3).map((item) => (
                <div key={item.label} className="rounded-2xl border border-[#1e1e32] bg-[#13131f] p-4">
                  <p className="text-sm font-black text-white">{item.label}</p>
                  <p className="mt-2 text-3xl font-black text-[#3ecfcf]">{item.value}%</p>
                  <p className="mt-1 text-xs text-[#8a8aa8]">{item.detail}</p>
                </div>
              ))}
            </div>
          </>
        )}
        {activeAdminTab === 'users' && (
          <>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[#6c63ff]">{tx('Uporabniki', 'Users')}</p>
            <h2 className="mt-1 text-2xl font-black text-white">{tx('Najbolj aktivni testerji', 'Most active testers')}</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {userActivity.slice(0, 6).map((user) => (
                <div key={user.userId} className="rounded-2xl border border-[#1e1e32] bg-[#13131f] p-4">
                  <p className="truncate text-sm font-black text-white">{userDisplayName(user)}</p>
                  <p className="mt-2 text-xs text-[#8a8aa8]">{user.cars} {tx('vozil', 'vehicles')} · {user.entries} {tx('vnosov', 'entries')}</p>
                </div>
              ))}
              {userActivity.length === 0 && <p className="rounded-2xl border border-[#1e1e32] bg-[#13131f] p-4 text-sm text-[#8a8aa8]">{tx('Ni uporabniške aktivnosti.', 'No user activity.')}</p>}
            </div>
          </>
        )}
        {activeAdminTab === 'inbox' && (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-[#3ecfcf]">{tx('Predlogi / napake', 'Suggestions / errors')}</p>
                <h2 className="mt-1 text-2xl font-black text-white">{tx('Novo, kar čaka pregled', 'New items waiting for review')}</h2>
                <p className="mt-2 text-sm font-semibold text-[#8a8aa8]">
                  {tx('Ta zavihek jasno loči predloge uporabnikov in tehnične napake.', 'This tab clearly separates user suggestions and technical errors.')}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => window.location.href = '/admin-feedback'} className="rounded-xl bg-[#6c63ff] px-4 py-2 text-xs font-black !text-white">
                  {tx('Odpri predloge', 'Open suggestions')}
                </button>
                <button onClick={() => window.location.href = '/admin-napake'} className="rounded-xl border border-[#ef444466] bg-[#ef444418] px-4 py-2 text-xs font-black text-[#ef4444]">
                  {tx('Odpri napake', 'Open errors')}
                </button>
              </div>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-[#3ecfcf55] bg-[#3ecfcf10] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-lg font-black text-white">{tx('Predlogi', 'Suggestions')}</h3>
                  <span className="rounded-full bg-[#3ecfcf22] px-3 py-1 text-xs font-black text-[#3ecfcf]">{stats.newFeedback || 0}</span>
                </div>
                <div className="space-y-3">
                  {recentFeedback.filter((item) => item.status === 'new').length === 0 ? (
                    <p className="rounded-xl bg-[#13131f] p-4 text-sm font-semibold text-[#8a8aa8]">{tx('Ni novih predlogov.', 'No new suggestions.')}</p>
                  ) : recentFeedback.filter((item) => item.status === 'new').map((item) => (
                    <div key={item.id} className="rounded-2xl border border-[#1e1e32] bg-[#0f0f1a] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-black text-white">{item.feature_description}</p>
                          <p className="mt-1 text-[11px] font-semibold text-[#8a8aa8]">
                            {item.created_at ? new Date(item.created_at).toLocaleString(language === 'en' ? 'en-US' : 'sl-SI') : '-'}
                          </p>
                        </div>
                        <span className="rounded-full bg-[#3ecfcf22] px-2 py-1 text-[10px] font-black text-[#3ecfcf]">{tx('Novo', 'New')}</span>
                      </div>
                      <p className="mt-3 line-clamp-3 rounded-xl bg-[#13131f] p-3 text-xs font-semibold leading-relaxed text-white">{item.usefulness_reason}</p>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <button onClick={() => updateFeedbackStatus(item.id, 'planned')} className="rounded-xl border border-[#6c63ff55] bg-[#6c63ff18] px-2 py-2 text-xs font-black text-[#6c63ff]">{tx('Planirano', 'Planned')}</button>
                        <button onClick={() => updateFeedbackStatus(item.id, 'done')} className="rounded-xl border border-[#22c55e55] bg-[#22c55e18] px-2 py-2 text-xs font-black text-[#16a34a]">{tx('Rešeno', 'Done')}</button>
                        <button onClick={() => updateFeedbackStatus(item.id, 'rejected')} className="rounded-xl border border-[#ef444455] bg-[#ef444418] px-2 py-2 text-xs font-black text-[#ef4444]">{tx('Zavrnjeno', 'Rejected')}</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-[#ef444455] bg-[#ef444410] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-lg font-black text-white">{tx('Napake', 'Errors')}</h3>
                  <span className="rounded-full bg-[#ef444422] px-3 py-1 text-xs font-black text-[#ef4444]">{stats.errors || 0}</span>
                </div>
                <div className="space-y-3">
                  {recentErrors.filter((item) => (item.status || 'new') === 'new').length === 0 ? (
                    <p className="rounded-xl bg-[#13131f] p-4 text-sm font-semibold text-[#8a8aa8]">{tx('Ni novih napak.', 'No new errors.')}</p>
                  ) : recentErrors.filter((item) => (item.status || 'new') === 'new').map((item) => (
                    <div key={item.id} className="rounded-2xl border border-[#1e1e32] bg-[#0f0f1a] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-black text-white">{item.name || item.message || 'Error'}</p>
                          <p className="mt-1 text-[11px] font-semibold text-[#8a8aa8]">
                            {item.created_at ? new Date(item.created_at).toLocaleString(language === 'en' ? 'en-US' : 'sl-SI') : '-'}
                          </p>
                        </div>
                        <button onClick={() => resolveError(item.id)} className="rounded-xl bg-[#22c55e] px-3 py-2 text-[11px] font-black !text-[#071112]">
                          {tx('Rešeno', 'Resolved')}
                        </button>
                      </div>
                      <p className="mt-3 break-words rounded-xl bg-[#13131f] p-3 text-xs font-semibold leading-relaxed text-white">{item.page_path || item.page || '-'}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
        {activeAdminTab === 'errors' && (
          <>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[#ef4444]">{tx('Napake', 'Errors')}</p>
            <h2 className="mt-1 text-2xl font-black text-white">{tx('Sistemske napake in prijave', 'System errors and reports')}</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <button onClick={() => window.location.href = '/admin-napake'} className="rounded-2xl border border-[#ef444455] bg-[#ef444418] p-4 text-left text-[#fca5a5]">
                <p className="text-sm font-black">{tx('Odpri napake', 'Open errors')}</p>
                <p className="mt-2 text-3xl font-black">{stats.errors || 0}</p>
              </button>
              {errorStatusStats.slice(0, 2).map((item) => (
                <div key={item.label} className="rounded-2xl border border-[#1e1e32] bg-[#13131f] p-4">
                  <p className="text-sm font-black text-white">{item.label}</p>
                  <p className="mt-2 text-2xl font-black text-[#fca5a5]">{item.count}</p>
                </div>
              ))}
            </div>
          </>
        )}
        {activeAdminTab === 'plans' && (
          <>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[#6c63ff]">{tx('Monetizacija', 'Monetization')}</p>
            <h2 className="mt-1 text-2xl font-black text-white">{tx('Paketi in 2027 simulacija', 'Plans and 2027 simulation')}</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              {planSimulation.map((plan) => (
                <div key={plan.label} className="rounded-2xl border border-[#1e1e32] bg-[#13131f] p-4">
                  <p className="text-sm font-black text-white">{plan.label}</p>
                  <p className="mt-2 text-2xl font-black text-[#a09aff]">{plan.count}</p>
                  <p className="text-xs text-[#8a8aa8]">{plan.range}</p>
                </div>
              ))}
            </div>
          </>
        )}
        {activeAdminTab === 'settings' && (
          <>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[#fca5a5]">{tx('Nastavitve', 'Settings')}</p>
            <h2 className="mt-1 text-2xl font-black text-white">{tx('Varno čiščenje in nastavitve', 'Safe clearing and settings')}</h2>
            <div className="mt-4 rounded-2xl border-2 border-[#ef4444] bg-[#2a0710] p-4">
              <p className="text-sm font-black text-[#fecaca]">{tx('Nevarno območje: brisanje analitike', 'Danger zone: analytics deletion')}</p>
              <p className="mt-1 text-xs text-[#fca5a5]">{tx('Vsaka tipka pred brisanjem pokaže potrditveno opozorilo.', 'Every button shows a confirmation warning before deleting.')}</p>
              <div className="mt-3 grid grid-cols-4 gap-2">
                {(['24h', '7d', '30d', 'all'] as const).map((range) => (
                  <button key={range} onClick={() => clearAnalyticsHistory(range)} disabled={!!clearLoading}
                    className={`rounded-xl border px-3 py-2 text-xs font-black disabled:opacity-50 ${range === 'all' ? 'border-[#fecaca] bg-[#ef4444] text-white' : 'border-[#f97316] bg-[#f9731622] text-[#fdba74]'}`}>
                    {clearLoading === range ? tx('Brišem...', 'Deleting...') : range === 'all' ? tx('Vse', 'All') : rangeLabel[range]}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {activeAdminTab === 'users' && (
        <div className="mb-5 grid gap-4 xl:grid-cols-[0.9fr_1.4fr]">
          <div className="rounded-2xl border border-[#1e1e32] bg-[#0f0f1a] p-5">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#6c63ff]">{tx('Testerji', 'Testers')}</p>
            <h2 className="mt-1 text-xl font-black text-white">{tx('Poišči testerja po e-mailu', 'Find tester by email')}</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#8a8aa8]">
              {tx('Za testiranje spremljaj agregate, zadnje akcije in napake. Osebnih slik in dokumentov tukaj ne prikazujemo.', 'For testing, review aggregates, latest actions and errors. Personal photos and documents are not shown here.')}
            </p>
            <div className="mt-4 flex gap-2">
              <input value={testerSearch} onChange={(e) => setTesterSearch(e.target.value)} placeholder={tx('Vpiši vsaj 2 črki e-maila', 'Type at least 2 email letters')}
                className="min-w-0 flex-1 rounded-xl border border-[#1e1e32] bg-[#13131f] px-4 py-3 text-sm text-white outline-none focus:border-[#6c63ff]" />
              <button onClick={() => loadTesterCandidates(testerSearch)} disabled={testerSearchLoading || testerSearch.trim().length < 2}
                className="rounded-xl bg-[#3ecfcf] px-4 py-3 text-xs font-black text-[#071112] disabled:opacity-50">
                {testerSearchLoading ? tx('Iščem...', 'Searching...') : tx('Išči', 'Search')}
              </button>
            </div>
            <div className="mt-3 max-h-72 space-y-2 overflow-auto">
              {testerCandidates.length === 0 ? (
                <p className="rounded-xl bg-[#13131f] p-3 text-xs text-[#8a8aa8]">
                  {testerSearch.trim().length < 2
                    ? tx('Začni tipkati e-mail testerja.', 'Start typing the tester email.')
                    : tx('Ni najdenih uporabnikov.', 'No users found.')}
                </p>
              ) : testerCandidates.map((user) => (
                <button key={user.id} onClick={() => loadTesterActivity(user)}
                  className={`w-full rounded-xl border p-3 text-left transition-colors ${selectedTester?.id === user.id ? 'border-[#6c63ff] bg-[#6c63ff22]' : 'border-[#1e1e32] bg-[#13131f] hover:border-[#6c63ff66]'}`}>
                  <p className="truncate text-sm font-black text-white">{user.email}</p>
                  <p className="mt-1 text-[11px] text-[#8a8aa8]">
                    {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString(language === 'en' ? 'en-US' : 'sl-SI') : tx('Brez prijave', 'No sign-in')}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[#1e1e32] bg-[#0f0f1a] p-5">
            {!selectedTester ? (
              <div className="flex min-h-72 items-center justify-center rounded-2xl border border-dashed border-[#2a2a44] bg-[#13131f] p-6 text-center">
                <div>
                  <p className="text-lg font-black text-white">{tx('Izberi testerja', 'Select a tester')}</p>
                  <p className="mt-2 max-w-md text-sm text-[#8a8aa8]">{tx('Ko izbereš uporabnika, vidiš ali je samo odprl aplikacijo ali jo dejansko uporablja.', 'After selecting a user, you can see whether they only opened the app or actually use it.')}</p>
                </div>
              </div>
            ) : testerLoading ? (
              <div className="flex min-h-72 items-center justify-center text-sm font-bold text-[#8a8aa8]">{tx('Nalaganje aktivnosti...', 'Loading activity...')}</div>
            ) : testerActivity ? (
              <div>
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="truncate text-lg font-black text-white">{testerActivity.user.email}</p>
                    <p className="mt-1 text-xs text-[#8a8aa8]">
                      {tx('Zadnja prijava', 'Last sign-in')}: {testerActivity.user.last_sign_in_at ? new Date(testerActivity.user.last_sign_in_at).toLocaleString(language === 'en' ? 'en-US' : 'sl-SI') : '-'}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-2 text-xs font-black ${
                    testerActivity.summary.testerSignal === 'active'
                      ? 'bg-[#22c55e22] text-[#4ade80]'
                      : testerActivity.summary.testerSignal === 'opened'
                        ? 'bg-[#f59e0b22] text-[#fbbf24]'
                        : 'bg-[#ef444422] text-[#fca5a5]'
                  }`}>
                    {testerActivity.summary.testerSignal === 'active'
                      ? tx('Dejansko testira', 'Actively testing')
                      : testerActivity.summary.testerSignal === 'opened'
                        ? tx('Samo odprl/a', 'Only opened')
                        : tx('Brez signala', 'No signal')}
                  </span>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    { label: tx('Dogodki 30 dni', 'Events 30 days'), value: testerActivity.summary.events30 },
                    { label: tx('Akcije 30 dni', 'Actions 30 days'), value: testerActivity.summary.meaningfulEvents30 },
                    { label: tx('Seje skupaj', 'Total sessions'), value: testerActivity.summary.sessions },
                    { label: tx('Aktivni čas', 'Active time'), value: minuteText(testerActivity.summary.totalActiveMinutes) },
                    { label: tx('Povprečna seja', 'Average session'), value: minuteText(testerActivity.summary.averageSessionMinutes) },
                    { label: tx('Najdaljša seja', 'Longest session'), value: minuteText(testerActivity.summary.longestSessionMinutes) },
                    { label: tx('Vozila', 'Vehicles'), value: testerActivity.summary.cars },
                    { label: tx('Vnosi', 'Entries'), value: testerActivity.summary.fuel + testerActivity.summary.services + testerActivity.summary.expenses },
                    { label: tx('Opomniki', 'Reminders'), value: testerActivity.summary.reminders },
                    { label: tx('Push naprave', 'Push devices'), value: testerActivity.summary.pushDevices },
                    { label: tx('Napake', 'Errors'), value: testerActivity.summary.errors },
                    { label: tx('Zadnjih 24h', 'Last 24h'), value: testerActivity.summary.events24 },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl border border-[#1e1e32] bg-[#13131f] p-3">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-[#8a8aa8]">{item.label}</p>
                      <p className="mt-1 text-2xl font-black text-[#3ecfcf]">{item.value || 0}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-[#8a8aa8]">
                  {tx('Čas je ocena iz zabeleženih akcij. Nova seja se šteje po 30 minutah brez aktivnosti.', 'Time is estimated from tracked actions. A new session starts after 30 minutes without activity.')}
                </p>

                <div className="mt-4 rounded-2xl border border-[#6c63ff44] bg-[#13131f] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-black text-white">{tx('Ročne omejitve in paket', 'Manual limits and package')}</h3>
                      <p className="mt-1 text-xs leading-relaxed text-[#8a8aa8]">
                        {tx('Za testerje lahko hitro nastaviš opazovanje, omejitve ali ročni paket. Spremembe se zapisujejo v admin dnevnik.', 'For testers you can quickly set monitoring, limits or a manual plan. Changes are written to the admin log.')}
                      </p>
                    </div>
                    <button onClick={saveTesterControls} disabled={controlSaving}
                      className="rounded-xl bg-[#6c63ff] px-4 py-3 text-xs font-black text-white shadow-lg shadow-[#6c63ff33] disabled:opacity-50">
                      {controlSaving ? tx('Shranjujem...', 'Saving...') : tx('Shrani nadzor', 'Save controls')}
                    </button>
                  </div>

                  <div className="mt-4 grid gap-3 lg:grid-cols-3">
                    <label className="text-xs font-bold text-[#c7c7d8]">
                      {tx('Status računa', 'Account status')}
                      <select value={controlStatus} onChange={(e) => setControlStatus(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-[#2a2a44] bg-[#0f0f1a] px-3 py-2 text-sm text-white outline-none focus:border-[#6c63ff]">
                        <option value="normal">{tx('Normalno', 'Normal')}</option>
                        <option value="tester">{tx('Tester', 'Tester')}</option>
                        <option value="watch">{tx('Spremljaj', 'Watch')}</option>
                        <option value="limited">{tx('Omejeno', 'Limited')}</option>
                        <option value="blocked">{tx('Blokirano', 'Blocked')}</option>
                      </select>
                    </label>
                    <label className="text-xs font-bold text-[#c7c7d8]">
                      {tx('Blokirano do', 'Blocked until')}
                      <input type="datetime-local" value={controlBlockedUntil} onChange={(e) => setControlBlockedUntil(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-[#2a2a44] bg-[#0f0f1a] px-3 py-2 text-sm text-white outline-none focus:border-[#6c63ff]" />
                    </label>
                    <label className="text-xs font-bold text-[#c7c7d8]">
                      {tx('Ročni paket', 'Manual plan')}
                      <select value={controlPlan} onChange={(e) => setControlPlan(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-[#2a2a44] bg-[#0f0f1a] px-3 py-2 text-sm text-white outline-none focus:border-[#6c63ff]">
                        <option value="">{tx('Ne spreminjaj paketa', 'Do not change plan')}</option>
                        <option value="free">Free</option>
                        <option value="pro">Pro</option>
                        <option value="max">Max</option>
                        <option value="business">Business</option>
                      </select>
                    </label>
                  </div>

                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    <label className="text-xs font-bold text-[#c7c7d8]">
                      {tx('Razlog za uporabnika', 'User-facing reason')}
                      <input value={controlReason} onChange={(e) => setControlReason(e.target.value)}
                        placeholder={tx('npr. Testni premium dostop do 31. 12. 2026', 'e.g. Test premium access until Dec 31, 2026')}
                        className="mt-1 w-full rounded-xl border border-[#2a2a44] bg-[#0f0f1a] px-3 py-2 text-sm text-white outline-none focus:border-[#6c63ff]" />
                    </label>
                    <label className="text-xs font-bold text-[#c7c7d8]">
                      {tx('Interna opomba', 'Internal note')}
                      <input value={controlInternalNote} onChange={(e) => setControlInternalNote(e.target.value)}
                        placeholder={tx('npr. Kolega tester, ročen paket', 'e.g. Friend tester, manual plan')}
                        className="mt-1 w-full rounded-xl border border-[#2a2a44] bg-[#0f0f1a] px-3 py-2 text-sm text-white outline-none focus:border-[#6c63ff]" />
                    </label>
                  </div>

                  {controlPlan && (
                    <label className="mt-3 block text-xs font-bold text-[#c7c7d8]">
                      {tx('Opomba paketa', 'Plan note')}
                      <input value={controlPlanNote} onChange={(e) => setControlPlanNote(e.target.value)}
                        placeholder={tx('npr. Brezplačen tester/promo dostop', 'e.g. Free tester/promo access')}
                        className="mt-1 w-full rounded-xl border border-[#2a2a44] bg-[#0f0f1a] px-3 py-2 text-sm text-white outline-none focus:border-[#6c63ff]" />
                    </label>
                  )}

                  <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {[
                      ['readOnly', tx('Samo branje', 'Read only')],
                      ['blockReports', tx('Blokiraj PDF/report', 'Block PDF/report')],
                      ['blockQrTransfer', tx('Blokiraj QR/prenos', 'Block QR/transfer')],
                      ['blockUploads', tx('Pripravi blokado uploadov', 'Prepare upload block')],
                      ['blockPush', tx('Blokiraj push/opomnike', 'Block push/reminders')],
                    ].map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2 rounded-xl border border-[#2a2a44] bg-[#0f0f1a] p-3 text-xs font-bold text-white">
                        <input type="checkbox" checked={Boolean(controlLimits[key as keyof UserControlLimits])}
                          onChange={(e) => setLimitValue(key as keyof UserControlLimits, e.target.checked)}
                          className="h-4 w-4 accent-[#6c63ff]" />
                        {label}
                      </label>
                    ))}
                    <label className="rounded-xl border border-[#2a2a44] bg-[#0f0f1a] p-3 text-xs font-bold text-white">
                      {tx('Limit vozil (0 = brez)', 'Vehicle limit (0 = none)')}
                      <input type="number" min="0" max="100" value={controlLimits.maxCars}
                        onChange={(e) => setLimitValue('maxCars', Math.max(0, Math.min(100, Number(e.target.value || 0))))}
                        className="mt-1 w-full rounded-lg border border-[#2a2a44] bg-[#13131f] px-2 py-1 text-sm text-white outline-none focus:border-[#6c63ff]" />
                    </label>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-[#1e1e32] bg-[#13131f] p-4">
                    <h3 className="text-sm font-black text-white">{tx('Najpogostejše akcije', 'Most common actions')}</h3>
                    <div className="mt-3 space-y-2">
                      {testerActivity.topEvents.length === 0 ? (
                        <p className="text-xs text-[#8a8aa8]">{tx('Ni dogodkov.', 'No events.')}</p>
                      ) : testerActivity.topEvents.slice(0, 6).map((event) => (
                        <div key={event.name} className="flex items-center justify-between gap-3 rounded-xl bg-[#0f0f1a] p-2">
                          <span className="text-xs font-bold text-white">{event.label}</span>
                          <span className="text-xs font-black text-[#a09aff]">{event.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-[#1e1e32] bg-[#13131f] p-4">
                    <h3 className="text-sm font-black text-white">{tx('Najbolj obiskane strani', 'Most visited pages')}</h3>
                    <div className="mt-3 space-y-2">
                      {testerActivity.topPages.length === 0 ? (
                        <p className="text-xs text-[#8a8aa8]">{tx('Ni ogledov strani.', 'No page views.')}</p>
                      ) : testerActivity.topPages.slice(0, 6).map((page) => (
                        <div key={page.page} className="flex items-center justify-between gap-3 rounded-xl bg-[#0f0f1a] p-2">
                          <span className="text-xs font-bold text-white">{page.page}</span>
                          <span className="text-xs font-black text-[#a09aff]">{page.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-[#1e1e32] bg-[#13131f] p-4">
                    <h3 className="text-sm font-black text-white">{tx('Zadnje akcije', 'Latest actions')}</h3>
                    <div className="mt-3 max-h-72 space-y-2 overflow-auto">
                      {testerActivity.recentEvents.length === 0 ? (
                        <p className="text-xs text-[#8a8aa8]">{tx('Ni zadnjih akcij.', 'No recent actions.')}</p>
                      ) : testerActivity.recentEvents.map((event) => (
                        <div key={event.id} className="rounded-xl bg-[#0f0f1a] p-2">
                          <p className="text-xs font-black text-white">{event.label}</p>
                          <p className="mt-1 text-[11px] text-[#8a8aa8]">{event.page} - {new Date(event.created_at).toLocaleString(language === 'en' ? 'en-US' : 'sl-SI')}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-[#1e1e32] bg-[#13131f] p-4">
                    <h3 className="text-sm font-black text-white">{tx('Napake testerja', 'Tester errors')}</h3>
                    <div className="mt-3 max-h-72 space-y-2 overflow-auto">
                      {testerActivity.recentErrors.length === 0 ? (
                        <p className="text-xs text-[#8a8aa8]">{tx('Ni napak za tega uporabnika.', 'No errors for this user.')}</p>
                      ) : testerActivity.recentErrors.map((error) => (
                        <div key={error.id} className="rounded-xl border border-[#ef444433] bg-[#ef444411] p-2">
                          <p className="text-xs font-black text-[#fca5a5]">{error.name}</p>
                          <p className="mt-1 line-clamp-2 text-[11px] text-[#fca5a5]">{error.message || '-'}</p>
                          <p className="mt-1 text-[11px] text-[#8a8aa8]">{error.page} - {new Date(error.created_at).toLocaleString(language === 'en' ? 'en-US' : 'sl-SI')}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="rounded-xl bg-[#13131f] p-4 text-sm text-[#8a8aa8]">{tx('Izberi testerja za pregled.', 'Select a tester to inspect.')}</p>
            )}
          </div>
        </div>
      )}

      <div id="admin-overview" className="grid scroll-mt-6 grid-cols-2 gap-3 mb-5 lg:grid-cols-4">
        {statCards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-[#1e1e32] bg-[#0f0f1a] p-4">
            <p className="text-[#5a5a80] text-xs uppercase tracking-wider">{card.label}</p>
            <p className={`mt-2 text-3xl font-black ${card.color}`}>{card.value}</p>
            <p className="mt-1 text-xs text-[#5a5a80]">{card.hint}</p>
          </div>
        ))}
      </div>

      <div id="admin-analytics" className="mb-4 grid scroll-mt-6 gap-4 xl:grid-cols-[0.85fr_0.85fr_1.3fr]">
        <div className="rounded-2xl border border-[#1e1e32] bg-[#0f0f1a] p-5">
          <h2 className="text-white font-bold">{tx('Miks zapisov', 'Record mix')}</h2>
          <p className="mb-4 text-[#5a5a80] text-xs">{tx('Razmerje med gorivom, servisi in stroski.', 'Split between fuel, services and expenses.')}</p>
          <div className="space-y-3">
            {recordMix.map((item) => (
              <div key={item.label}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-black text-white">{item.label}</span>
                  <span className="text-xs font-bold text-[#8a8aa8]">{item.value} / {item.percent}%</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-[#13131f]">
                  <div className={`h-full rounded-full ${item.color}`} style={{ width: `${Math.max(4, item.percent)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[#1e1e32] bg-[#0f0f1a] p-5">
          <h2 className="text-white font-bold">{tx('Stroskovni miks', 'Cost mix')}</h2>
          <p className="mb-4 text-[#5a5a80] text-xs">{tx('Kje uporabniki beležijo najvec denarja.', 'Where users record the most money.')}</p>
          <div className="space-y-3">
            {costMix.map((item) => (
              <div key={item.label}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-black text-white">{item.label}</span>
                  <span className="text-xs font-bold text-[#8a8aa8]">{moneyText(item.value)} / {item.percent}%</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-[#13131f]">
                  <div className={`h-full rounded-full ${item.color}`} style={{ width: `${Math.max(4, item.percent)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[#1e1e32] bg-[#0f0f1a] p-5">
          <h2 className="text-white font-bold">{tx('Kriticni tokovi', 'Critical flows')}</h2>
          <p className="mb-4 text-[#5a5a80] text-xs">{tx('Formule za shranjevanje, OCR, report in napake.', 'Formulas for saving, OCR, report and errors.')}</p>
          <div className="grid gap-3 md:grid-cols-2">
            {conversionStats.map((item) => (
              <div key={item.label} className="rounded-2xl border border-[#1e1e32] bg-[#13131f] p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-black text-white">{item.label}</p>
                  <p className="text-2xl font-black text-[#3ecfcf]">{item.value}%</p>
                </div>
                <p className="mt-1 text-xs text-[#8a8aa8]">{item.detail}</p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#0f0f1a]">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#6c63ff] to-[#3ecfcf]" style={{ width: `${Math.min(100, Math.max(3, item.value))}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-[#1e1e32] bg-[#0f0f1a] p-5">
          <h2 className="text-white font-bold">{tx('Ključni insighti', 'Key insights')}</h2>
          <p className="mt-3 text-sm leading-relaxed text-[#8a8aa8]">
            {tx('Povprečje vozil na uporabnika pomaga določiti Free/Basic/Pro omejitve. Delež računov pokaže, koliko uporabnikov gradi verodostojno zgodovino.', 'Average vehicles per user helps define Free/Basic/Pro limits. Receipt share shows how many users build trustworthy history.')}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-[#13131f] p-3">
              <p className="text-xs text-[#8a8aa8]">{tx('Vozil/up.', 'Vehicles/user')}</p>
              <p className="mt-1 text-2xl font-black text-[#a09aff]">{(stats.avgCarsPerUser || 0).toFixed(1)}</p>
            </div>
            <div className="rounded-xl bg-[#13131f] p-3">
              <p className="text-xs text-[#8a8aa8]">{tx('Dokazila', 'Proof')}</p>
              <p className="mt-1 text-2xl font-black text-[#4ade80]">{stats.receiptRate || 0}%</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-[#1e1e32] bg-[#0f0f1a] p-5">
          <h2 className="text-white font-bold">{tx('Monetizacija', 'Monetization')}</h2>
          <p className="mt-3 text-sm leading-relaxed text-[#8a8aa8]">
            {tx('Za 2027 spremljaj vozila na uporabnika, uporabo PDF/QR, AI/OCR klike, dokazila in aktivnost 30 dni.', 'For 2027 watch vehicles per user, PDF/QR usage, AI/OCR clicks, proof uploads and 30-day activity.')}
          </p>
          <p className="mt-4 text-3xl font-black text-[#f59e0b]">{moneyText(stats.totalRevenue || 0)}</p>
          <p className="text-xs text-[#8a8aa8]">{tx('evidentirani stroški uporabnikov', 'recorded user costs')}</p>
        </div>
        <div className="rounded-2xl border border-[#1e1e32] bg-[#0f0f1a] p-5">
          <h2 className="text-white font-bold">{tx('Zdravje sistema', 'System health')}</h2>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between rounded-xl bg-[#13131f] p-3">
              <span className="text-sm font-bold text-white">{tx('Nove napake', 'New errors')}</span>
              <span className="text-lg font-black text-[#fca5a5]">{stats.errors || 0}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-[#13131f] p-3">
              <span className="text-sm font-bold text-white">{tx('Aktivni 30 dni', 'Active 30 days')}</span>
              <span className="text-lg font-black text-[#3ecfcf]">{stats.active30 || 0}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-4 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-2xl border border-[#1e1e32] bg-[#0f0f1a] p-5">
          <div className="mb-5 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-white font-bold">{tx('Uporabniški funnel', 'User funnel')}</h2>
              <p className="text-[#5a5a80] text-xs">{tx('Registracija/aktivnost do reporta in QR prenosa.', 'From registration/activity to report and QR transfer.')}</p>
            </div>
            <span className="rounded-full bg-[#6c63ff22] px-3 py-1 text-xs font-black text-[#a09aff]">30d</span>
          </div>
          <div className="space-y-3">
            {funnelStats.map((item, index) => (
              <div key={item.label} className="rounded-2xl border border-[#1e1e32] bg-[#13131f] p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-white">{index + 1}. {item.label}</p>
                    <p className="text-xs text-[#8a8aa8]">{item.hint}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black text-[#3ecfcf]">{item.value}</p>
                    <p className="text-xs text-[#8a8aa8]">{item.percent}%</p>
                  </div>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#0f0f1a]">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#6c63ff] to-[#3ecfcf]" style={{ width: `${Math.min(100, item.percent)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[#1e1e32] bg-[#0f0f1a] p-5">
          <h2 className="text-white font-bold">{tx('Retention krivulja', 'Retention curve')}</h2>
          <p className="mb-5 text-[#5a5a80] text-xs">{tx('Ocena iz prvih in zadnjih dogodkov uporabnika v zadnjih 30 dneh.', 'Estimate from first and last user events in the last 30 days.')}</p>
          <div className="grid grid-cols-3 gap-3">
            {retentionStats.map((item) => (
              <div key={item.label} className="rounded-2xl border border-[#1e1e32] bg-[#13131f] p-4 text-center">
                <p className="text-xs font-black text-[#8a8aa8]">{item.label}</p>
                <p className="mt-2 text-3xl font-black text-[#a09aff]">{item.percent}%</p>
                <p className="mt-1 text-xs text-[#8a8aa8]">{item.value} {tx('up.', 'users')}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 h-24 rounded-2xl border border-[#1e1e32] bg-[#13131f] p-3">
            <div className="flex h-full items-end gap-3">
              {retentionStats.map((item) => (
                <div key={item.label} className="flex flex-1 flex-col items-center gap-2">
                  <div className="w-full rounded-xl bg-[#6c63ff]" style={{ height: `${Math.max(8, item.percent)}%` }} />
                  <p className="text-[10px] font-bold text-[#8a8aa8]">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mb-4 grid gap-4 xl:grid-cols-[1fr_1fr_0.9fr]">
        <div id="admin-users" className="scroll-mt-6 rounded-2xl border border-[#1e1e32] bg-[#0f0f1a] p-5">
          <h2 className="text-white font-bold">{tx('Uporabniki za pregled', 'Users to inspect')}</h2>
          <p className="mb-4 text-[#5a5a80] text-xs">{tx('Najbolj aktivni uporabniki iz dogodkov in vozil. Če je e-mail na voljo, je prikazan namesto anonimne oznake.', 'Most active users from events and vehicles. If email is available, it is shown instead of an anonymous label.')}</p>
          <div className="space-y-2">
            {userActivity.length === 0 ? (
              <p className="rounded-xl bg-[#13131f] p-3 text-xs text-[#5a5a80]">{tx('Ni uporabniške aktivnosti.', 'No user activity.')}</p>
            ) : userActivity.map((user) => (
              <div key={user.userId} className="rounded-xl border border-[#1e1e32] bg-[#13131f] p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-black text-white">{userDisplayName(user)}</p>
                  <p className="text-xs font-bold text-[#3ecfcf]">{user.events} {tx('dog.', 'events')}</p>
                </div>
                <p className="mt-2 text-xs text-[#8a8aa8]">
                  {user.cars} {tx('vozil', 'vehicles')} · {user.entries} {tx('vnosov', 'entries')} · {user.errors} {tx('napak', 'errors')}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[#1e1e32] bg-[#0f0f1a] p-5">
          <h2 className="text-white font-bold">{tx('Simulacija paketov 2027', '2027 plan simulation')}</h2>
          <p className="mb-4 text-[#5a5a80] text-xs">{tx('Osnutek segmentacije po številu vozil.', 'Draft segmentation by vehicle count.')}</p>
          <div className="space-y-3">
            {planSimulation.map((plan) => (
              <div key={plan.label}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-black text-white">{plan.label}</span>
                  <span className="text-xs font-bold text-[#8a8aa8]">{plan.count} · {plan.range}</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-[#13131f]">
                  <div className={`h-full rounded-full ${plan.color}`} style={{ width: `${Math.max(4, plan.percent)}%` }} />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 rounded-xl border border-[#6c63ff44] bg-[#6c63ff14] p-3 text-xs leading-relaxed text-[#a09aff]">
            {tx('To je samo simulacija za odločanje. Prave pakete veži še na PDF/QR, slike, AI/OCR in podporo.', 'This is only a decision simulation. Real plans should also account for PDF/QR, images, AI/OCR and support.')}
          </p>
        </div>

        <div className="rounded-2xl border border-[#1e1e32] bg-[#0f0f1a] p-5">
          <h2 className="text-white font-bold">{tx('Admin opozorila', 'Admin alerts')}</h2>
          <p className="mb-4 text-[#5a5a80] text-xs">{tx('Stvari, ki jih je dobro preveriti pred rastjo.', 'Things worth checking before growth.')}</p>
          <div className="space-y-3">
            {adminAlerts.length === 0 ? (
              <div className="rounded-xl border border-[#16a34a44] bg-[#16a34a14] p-4 text-sm font-bold text-[#4ade80]">
                {tx('Ni nujnih opozoril.', 'No urgent alerts.')}
              </div>
            ) : adminAlerts.map((alert) => (
              <div key={alert.title} className={`rounded-xl border p-3 ${alert.tone === 'red' ? 'border-[#ef444455] bg-[#ef444418] text-[#fca5a5]' : alert.tone === 'yellow' ? 'border-[#f59e0b55] bg-[#f59e0b18] text-[#fbbf24]' : 'border-[#6c63ff55] bg-[#6c63ff18] text-[#a09aff]'}`}>
                <p className="text-sm font-black">{alert.title}</p>
                <p className="mt-1 text-xs leading-relaxed">{alert.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div id="admin-settings" className="mb-4 scroll-mt-6 rounded-3xl border border-[#1e1e32] bg-[#0f0f1a] p-5">
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
        <div className="mb-5 rounded-2xl border border-[#ef444433] bg-[#ef444410] p-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#fca5a5]">
            {tx('Čiščenje zgodovine analitike', 'Clear analytics history')}
          </p>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {(['24h', '7d', '30d', 'all'] as const).map((range) => (
              <button key={range} onClick={() => clearAnalyticsHistory(range)} disabled={!!clearLoading}
                className={`rounded-xl border px-3 py-2 text-xs font-bold transition-all disabled:opacity-50 ${
                  range === 'all'
                    ? 'border-[#ef444466] bg-[#ef444418] text-[#fca5a5]'
                    : 'border-[#f59e0b55] bg-[#f59e0b18] text-[#fbbf24]'
                }`}>
                {clearLoading === range ? tx('Brišem...', 'Deleting...') : range === 'all' ? tx('Vse', 'All') : rangeLabel[range]}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-[#5a5a80]">
            {tx('Tipka Vse ima dodatno opozorilo, da ne izbrišeš celotne zgodovine po nesreči.', 'The All button has an extra warning so the full history is not deleted by accident.')}
          </p>
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

        <div id="admin-errors" className="scroll-mt-6 rounded-2xl border border-[#1e1e32] bg-[#0f0f1a] p-5">
          <h2 className="text-white font-bold">{tx('Napake v sistemu', 'System errors')}</h2>
          <p className="mb-4 text-[#5a5a80] text-xs">{tx('Zadnje napake iz brskalnika uporabnikov.', 'Latest browser errors from users.')}</p>
          <button onClick={() => window.location.href = '/admin-napake'}
            className="mb-4 w-full rounded-xl border border-[#ef444455] bg-[#ef444418] px-3 py-2 text-xs font-bold text-[#fca5a5]">
            {tx('Odpri prijave napak uporabnikov', 'Open user bug reports')}
          </button>
          <div className="mb-4 rounded-2xl border border-[#1e1e32] bg-[#13131f] p-3">
            <p className="mb-3 text-xs font-black uppercase tracking-wider text-[#8a8aa8]">{tx('Status napak', 'Error status')}</p>
            {errorStatusStats.length === 0 ? (
              <p className="text-xs text-[#5a5a80]">{tx('Ni statusov napak.', 'No error statuses.')}</p>
            ) : errorStatusStats.map((item) => (
              <div key={item.label} className="mb-2 last:mb-0">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-bold text-white">{item.label}</span>
                  <span className="text-xs font-black text-[#fca5a5]">{item.count} / {item.percent}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#0f0f1a]">
                  <div className="h-full rounded-full bg-[#ef4444]" style={{ width: `${Math.max(4, item.percent)}%` }} />
                </div>
              </div>
            ))}
          </div>
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
                <p className="mt-1 text-[11px] text-[#5a5a80]">
                  v{error.app_version || error.metadata?.appVersion || '-'} · {error.release_channel || error.metadata?.releaseChannel || '-'}
                </p>
                {(error.device_info || error.metadata?.userAgent) && (
                  <p className="mt-1 line-clamp-1 text-[10px] text-[#5a5a80]">{error.device_info || error.metadata?.userAgent}</p>
                )}
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
          <div className="mb-4 rounded-2xl border border-[#ef444433] bg-[#ef444410] p-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#fca5a5]">
              {tx('Počisti zgodovino funkcij', 'Clear feature history')}
            </p>
            <div className="grid grid-cols-4 gap-2">
              {(['24h', '7d', '30d', 'all'] as const).map((range) => (
                <button key={range} onClick={() => clearAnalyticsHistory(range)} disabled={!!clearLoading}
                  className={`rounded-xl border px-2 py-2 text-[11px] font-bold transition-all disabled:opacity-50 ${
                    range === 'all'
                      ? 'border-[#ef444466] bg-[#ef444418] text-[#fca5a5]'
                      : 'border-[#f59e0b55] bg-[#f59e0b18] text-[#fbbf24]'
                  }`}>
                  {clearLoading === range ? '...' : range === 'all' ? tx('Vse', 'All') : rangeLabel[range]}
                </button>
              ))}
            </div>
          </div>
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

        <div id="admin-plans" className="scroll-mt-6 rounded-2xl border border-[#1e1e32] bg-[#0f0f1a] p-5">
          <h2 className="text-white font-bold">{tx('Paketi uporabnikov', 'User packages')}</h2>
          <p className="mb-4 text-[#5a5a80] text-xs">{tx('Trenutno je app odprta, tu pa pripravljas pakete za cas po promociji.', 'The app is currently open; this prepares plans for after the promotion.')}</p>
          <div className="mb-4 rounded-2xl border border-[#1e1e32] bg-[#13131f] p-3">
            <div className="flex gap-2">
              <input value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder={tx('Poisci email uporabnika', 'Search user email')}
                className="min-w-0 flex-1 rounded-xl border border-[#1e1e32] bg-[#0f0f1a] px-4 py-3 text-white outline-none focus:border-[#6c63ff]" />
              <button onClick={() => loadAdminUsers(userSearch)} disabled={usersLoading}
                className="rounded-xl bg-[#3ecfcf] px-4 py-3 text-xs font-black text-[#071112] disabled:opacity-60">
                {usersLoading ? tx('Iskanje...', 'Searching...') : tx('Poisci', 'Search')}
              </button>
            </div>
            <div className="mt-3 max-h-44 overflow-auto">
              {adminUsers.length === 0 ? (
                <p className="rounded-xl bg-[#0f0f1a] p-3 text-xs text-[#5a5a80]">
                  {tx('Ni nalozenih uporabnikov ali pa se niso ustvarili dogodkov.', 'No loaded users or no users have created events yet.')}
                </p>
              ) : adminUsers.map((user) => (
                <button key={user.id} onClick={() => selectAdminUser(user)}
                  className="mb-2 w-full rounded-xl border border-[#1e1e32] bg-[#0f0f1a] p-3 text-left transition-colors hover:border-[#6c63ff66]">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-bold text-white">{user.email}</p>
                    <span className="shrink-0 rounded-full bg-[#3ecfcf22] px-2 py-1 text-[10px] font-black text-[#3ecfcf]">
                      {user.plan?.plan || 'max'}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-[#5a5a80]">
                    {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString(language === 'en' ? 'en-US' : 'sl-SI') : tx('Brez prijave', 'No sign-in')}
                    {user.plan?.source ? ` · ${user.plan.source}` : ''}
                  </p>
                </button>
              ))}
            </div>
          </div>
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
            <select value={planSource} onChange={(e) => setPlanSource(e.target.value)}
              className="rounded-xl border border-[#1e1e32] bg-[#13131f] px-4 py-3 text-white outline-none focus:border-[#6c63ff]">
              <option value="manual">{tx('rocno / promocija', 'manual / promotion')}</option>
              <option value="promo">{tx('promocija', 'promotion')}</option>
              <option value="paid">{tx('placilo', 'paid')}</option>
            </select>
            <select value={billingStatus} onChange={(e) => setBillingStatus(e.target.value)}
              className="rounded-xl border border-[#1e1e32] bg-[#13131f] px-4 py-3 text-white outline-none focus:border-[#6c63ff]">
              <option value="free_open">{tx('odprto do promocije', 'open during promotion')}</option>
              <option value="trial">{tx('testno obdobje', 'trial')}</option>
              <option value="paid_active">{tx('aktivno placilo', 'active payment')}</option>
              <option value="past_due">{tx('placilo zamuja', 'past due')}</option>
            </select>
            <input value={planNote} onChange={(e) => setPlanNote(e.target.value)} placeholder={tx('Opomba, npr. prijatelj testira', 'Note, e.g. friend testing')}
              className="rounded-xl border border-[#1e1e32] bg-[#13131f] px-4 py-3 text-white outline-none focus:border-[#6c63ff]" />
            {(plans.find((plan) => String(plan.email).toLowerCase() === planEmail.trim().toLowerCase())?.locked ||
              plans.find((plan) => String(plan.email).toLowerCase() === planEmail.trim().toLowerCase())?.source === 'paid' ||
              plans.find((plan) => String(plan.email).toLowerCase() === planEmail.trim().toLowerCase())?.billing_status === 'paid_active') && (
              <input value={paidConfirm} onChange={(e) => setPaidConfirm(e.target.value)} placeholder={tx('Za spremembo placljivega uporabnika vpisi PLACILO', 'To change a paid user, type PLACILO')}
                className="rounded-xl border border-[#ef444466] bg-[#ef444418] px-4 py-3 text-[#fca5a5] outline-none focus:border-[#ef4444]" />
            )}
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
                  <p className="text-[#5a5a80] text-xs">{plan.note || '-'} {plan.source ? `· ${plan.source}` : ''}</p>
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
    </div>
  )
}
