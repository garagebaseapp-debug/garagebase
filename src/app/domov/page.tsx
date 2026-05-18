'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { BottomNav } from '@/lib/nav'
import { useLanguage } from '@/lib/i18n'
import { formatMoney, getCurrencyFromSettings, type GarageBaseCurrency } from '@/lib/currency'
import { formatDistance, getDistanceUnitFromSettings, type DistanceUnit } from '@/lib/units'
import { GARAGE_CACHE_VERSION, imageUrlWithVersion, readGarageCache } from '@/lib/vehicle-cache'
import { vehicleDisplayName } from '@/lib/vehicle-display'
import { fuelCostValue } from '@/lib/vehicle-costs'

type RecentEvent = {
  id: string
  carId: string
  carName: string
  title: string
  subtitle: string
  dateText: string
  href: string
  tone: 'fuel' | 'service' | 'cost'
  sortValue: number
  image?: string
}

type ReminderItem = {
  id: string
  carId: string
  carName: string
  title: string
  subtitle: string
  value: string
  tone: 'blue' | 'green' | 'orange' | 'red'
  sortValue: number
  image?: string
}

const cardTone = {
  blue: {
    iconBg: 'bg-[#2563eb18]',
    text: 'text-[#3b82f6]',
    pill: 'bg-[#2563eb14] text-[#60a5fa]',
    border: 'border-[#2563eb22]',
  },
  green: {
    iconBg: 'bg-[#16a34a18]',
    text: 'text-[#22c55e]',
    pill: 'bg-[#16a34a14] text-[#4ade80]',
    border: 'border-[#16a34a22]',
  },
  orange: {
    iconBg: 'bg-[#ea580c18]',
    text: 'text-[#f97316]',
    pill: 'bg-[#ea580c14] text-[#fb923c]',
    border: 'border-[#ea580c22]',
  },
  red: {
    iconBg: 'bg-[#ef444418]',
    text: 'text-[#ef4444]',
    pill: 'bg-[#ef444414] text-[#f87171]',
    border: 'border-[#ef444422]',
  },
}

function Icon({ type, className = 'h-6 w-6' }: { type: 'home' | 'car' | 'shield' | 'wrench' | 'calendar' | 'fuel' | 'cost' | 'bell' | 'box' | 'settings' | 'plus' | 'menu'; className?: string }) {
  if (type === 'car') return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 13l1.5-4.2A3 3 0 0 1 9.3 7h5.4a3 3 0 0 1 2.8 1.8L19 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 13h16v5H4v-5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M7 18v1.5M17 18v1.5M7 15h.01M17 15h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
  if (type === 'shield') return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3l7 3v5c0 4.5-2.8 8.3-7 10-4.2-1.7-7-5.5-7-10V6l7-3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
  if (type === 'wrench') return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M16.8 3.6 14.2 6.2l2.9 2.9 2.7-2.6a5 5 0 0 1-6.4 6.5l-6.6 6.6a2.3 2.3 0 0 1-3.3-3.3l6.6-6.6a5 5 0 0 1 6.7-6.1Z" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.3 17.7h.01" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  )
  if (type === 'calendar') return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
  if (type === 'fuel') return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 3h7a1 1 0 0 1 1 1v17H6V4a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="2" />
      <path d="M8 7h5v4H8V7ZM15 7h2l2 3v7a2 2 0 0 0 2 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
  if (type === 'cost') return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 19.5h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M6.5 16.5v-4M12 16.5v-8M17.5 16.5v-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="m5.8 9.8 3.1-2.6 3.2 2.1 4.6-5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16.7 4.3h-3.1M16.7 4.3v3.1" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  )
  if (type === 'bell') return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M18 9a6 6 0 0 0-12 0v4l-2 4h16l-2-4V9Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M10 20a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
  if (type === 'settings') return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z" stroke="currentColor" strokeWidth="2.1"/>
      <path d="M19.2 13.8a7.8 7.8 0 0 0 0-3.6l2-1.5-2-3.5-2.4 1a7.8 7.8 0 0 0-3.1-1.8L13.4 2H9.6l-.4 2.4a7.8 7.8 0 0 0-3.1 1.8l-2.3-1-2 3.5 2 1.5a7.8 7.8 0 0 0 0 3.6l-2 1.5 2 3.5 2.3-1a7.8 7.8 0 0 0 3.1 1.8l.4 2.4h3.8l.3-2.4a7.8 7.8 0 0 0 3.1-1.8l2.4 1 2-3.5-2-1.5Z" stroke="currentColor" strokeWidth="2.1" strokeLinejoin="round"/>
    </svg>
  )
  if (type === 'plus') return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"/>
    </svg>
  )
  if (type === 'menu') return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 7h14M5 12h14M5 17h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
    </svg>
  )
  if (type === 'box') return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3l8 4-8 4-8-4 8-4ZM4 11l8 4 8-4M4 15l8 4 8-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1v-8.5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}

const asDateText = (value: string | null | undefined, locale: string) => {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(locale)
}

export default function DomovPage() {
  const router = useRouter()
  const { language } = useLanguage()
  const tx = (sl: string, en: string) => language === 'en' ? en : sl
  const locale = language === 'en' ? 'en-US' : 'sl-SI'
  const [loading, setLoading] = useState(true)
  const [cars, setCars] = useState<any[]>([])
  const [reminders, setReminders] = useState<ReminderItem[]>([])
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([])
  const [theme, setTheme] = useState<'temna' | 'svetla'>('temna')
  const [currency, setCurrency] = useState<GarageBaseCurrency>('EUR')
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>('km')
  const [displayName, setDisplayName] = useState('')
  const [monthlyCost, setMonthlyCost] = useState(0)
  const [showAllRecentEvents, setShowAllRecentEvents] = useState(false)
  const [garageOpening, setGarageOpening] = useState(false)
  const garageNavigationStarted = useRef(false)
  const garageFallbackTimeout = useRef<number | null>(null)

  const favoriteCar = cars[0]
  const favoriteCarName = favoriteCar ? vehicleDisplayName(favoriteCar, tx('Vozilo', 'Vehicle')) : ''

  const carImage = (car: any) => {
    const raw = car?.slika_url || car?.slika || ''
    if (!raw) return ''
    return imageUrlWithVersion(raw, car?.slika_updated_at || car?.updated_at || car?.created_at || GARAGE_CACHE_VERSION)
  }
  const isLightTheme = theme === 'svetla'
  const heroImage = isLightTheme ? '/home-garage-closed-light.webp' : '/home-garage-closed-dark.webp'
  const doorConfig = isLightTheme
    ? {
      viewBox: '0 0 914 609',
      opening: '181,149 736,45 730,470 181,428',
      panel: '181,149 736,45 730,470 181,428',
      linePairs: [
        ['181,149', '736,45'],
        ['181,184', '735,98'],
        ['181,219', '735,151'],
        ['181,254', '734,204'],
        ['181,289', '733,258'],
        ['181,324', '732,311'],
        ['181,358', '731,364'],
        ['181,393', '731,417'],
        ['181,428', '730,470'],
      ],
      lift: 430,
      fill: '#e7edf5',
      stroke: '#aeb8c6',
      line: '#c5ceda',
    }
    : {
      viewBox: '0 0 1536 1024',
      opening: '490,365 1040,255 1040,686 490,644',
      panel: '490,365 1040,255 1040,686 490,644',
      linePairs: [
        ['490,365', '1040,255'],
        ['490,400', '1040,309'],
        ['490,435', '1040,363'],
        ['490,470', '1040,417'],
        ['490,505', '1040,471'],
        ['490,540', '1040,525'],
        ['490,575', '1040,578'],
        ['490,609', '1040,632'],
        ['490,644', '1040,686'],
      ],
      lift: 445,
      fill: '#151b27',
      stroke: '#364155',
      line: '#47536a',
    }

  const carNameById = useMemo(() => {
    const map: Record<string, any> = {}
    cars.forEach((car) => { if (car?.id) map[car.id] = car })
    return map
  }, [cars])

  const daysTo = (value?: string | null) => {
    if (!value) return null
    const target = new Date(value).getTime()
    if (Number.isNaN(target)) return null
    return Math.ceil((target - Date.now()) / (1000 * 60 * 60 * 24))
  }

  const reminderTone = (days: number | null, kmLeft: number | null): ReminderItem['tone'] => {
    if ((days !== null && days < 0) || (kmLeft !== null && kmLeft <= 0)) return 'red'
    if ((days !== null && days <= 30) || (kmLeft !== null && kmLeft <= 1500)) return 'orange'
    if ((days !== null && days <= 90) || (kmLeft !== null && kmLeft <= 5000)) return 'blue'
    return 'green'
  }

  const preklopiTemo = () => {
    const next = theme === 'svetla' ? 'temna' : 'svetla'
    setTheme(next)
    try {
      const current = JSON.parse(localStorage.getItem('garagebase_nastavitve') || '{}')
      localStorage.setItem('garagebase_nastavitve', JSON.stringify({ ...current, tema: next, onboardingDone: true }))
      document.documentElement.classList.toggle('light-mode', next === 'svetla')
    } catch {}
  }

  const vstopiVGarazo = () => {
    if (cars.length === 0) {
      router.push('/dodaj-avto')
      return
    }
    router.push('/garaza')
  }

  const odpriGarazoPoAnimaciji = () => {
    if (!garageOpening || garageNavigationStarted.current) return
    garageNavigationStarted.current = true
    if (garageFallbackTimeout.current !== null) {
      window.clearTimeout(garageFallbackTimeout.current)
      garageFallbackTimeout.current = null
    }
    router.push('/garaza')
  }

  useEffect(() => {
    const image = new Image()
    image.src = heroImage
  }, [heroImage])

  useEffect(() => {
    router.prefetch('/garaza')
  }, [router])

  useEffect(() => () => {
    if (garageFallbackTimeout.current !== null) window.clearTimeout(garageFallbackTimeout.current)
  }, [])

  useEffect(() => {
    const load = async () => {
      try {
        const settings = JSON.parse(localStorage.getItem('garagebase_nastavitve') || '{}')
        if (settings?.nacin === 'lite') {
          router.replace('/garaza?direct=1')
          return
        }
      } catch {}

      try {
        if (window.location.search.includes('login=1')) {
          window.history.replaceState({}, '', '/domov')
        }
        sessionStorage.removeItem('garagebase_after_login_home')
        sessionStorage.setItem('garagebase_seen_domov_this_session', '1')
        localStorage.removeItem('garagebase_after_login_home')
      } catch {}
      const selectedCurrency = getCurrencyFromSettings()
      const selectedDistanceUnit = getDistanceUnitFromSettings()
      setCurrency(selectedCurrency)
      setDistanceUnit(selectedDistanceUnit)
      try {
        const raw = localStorage.getItem('garagebase_nastavitve')
        const settings = raw ? JSON.parse(raw) : {}
        setTheme(settings.tema === 'svetla' ? 'svetla' : 'temna')
      } catch {
        setTheme(document.documentElement.classList.contains('light-mode') ? 'svetla' : 'temna')
      }

      const cached = readGarageCache()
      if (cached?.avti?.length) {
        const cachedCars = cached.avti.filter((car: any) => car?.arhivirano !== true)
        setCars(cachedCars)
        setLoading(false)
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/')
        return
      }
      const rawName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || ''
      setDisplayName(String(rawName).split(/[ ._-]/).filter(Boolean)[0] || '')

      let { data: carsData, error: carsError } = await supabase
        .from('cars')
        .select('*')
        .eq('user_id', user.id)
        .or('arhivirano.is.null,arhivirano.eq.false')
        .order('vrstni_red', { ascending: true })

      if (carsError || (carsData || []).length === 0) {
        const fallback = await supabase
          .from('cars')
          .select('*')
          .eq('user_id', user.id)
          .order('vrstni_red', { ascending: true })
        carsData = (fallback.data || []).filter((car: any) => car?.arhivirano !== true)
      }

      const loadedCars = carsData || []
      setCars(loadedCars)
      localStorage.setItem('garagebase_garaza_cache', JSON.stringify({
        version: GARAGE_CACHE_VERSION,
        avti: loadedCars,
        arhiv: false,
        savedAt: Date.now(),
      }))

      const ids = loadedCars.map((car: any) => car.id).filter(Boolean)
      const carMap: Record<string, any> = {}
      loadedCars.forEach((car: any) => { carMap[car.id] = car })

      if (ids.length === 0) {
        setReminders([])
        setRecentEvents([])
        setMonthlyCost(0)
        setLoading(false)
        return
      }

      const [remindersRes, fuelRes, serviceRes, expenseRes] = await Promise.all([
        supabase.from('reminders').select('*').in('car_id', ids).order('datum', { ascending: true }).limit(24),
        supabase.from('fuel_logs').select('*').in('car_id', ids).order('datum', { ascending: false }).limit(8),
        supabase.from('service_logs').select('*').in('car_id', ids).order('datum', { ascending: false }).limit(8),
        supabase.from('expenses').select('*').in('car_id', ids).order('datum', { ascending: false }).limit(8),
      ])
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)
      const inCurrentMonth = (row: any) => new Date(row.datum || row.created_at || 0).getTime() >= startOfMonth.getTime()
      const currentMonthCost = [
        ...(fuelRes.data || []).filter(inCurrentMonth).map((row: any) => fuelCostValue(row)),
        ...(serviceRes.data || []).filter(inCurrentMonth).map((row: any) => Number(row.cena || 0)),
        ...(expenseRes.data || []).filter((row: any) => row.kategorija !== 'km_sprememba' && inCurrentMonth(row)).map((row: any) => Number(row.znesek || 0)),
      ].reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0)
      setMonthlyCost(currentMonthCost)

      const nextReminders = (remindersRes.data || []).map((reminder: any): ReminderItem => {
        const car = carMap[reminder.car_id]
        const days = daysTo(reminder.datum)
        const kmLeft = reminder.km_opomnik && car?.km_trenutni ? reminder.km_opomnik - car.km_trenutni : null
        const tone = reminderTone(days, kmLeft)
        const value = days !== null
          ? days < 0 ? tx(`${Math.abs(days)} dni zamude`, `${Math.abs(days)} days overdue`) : tx(`${days} dni`, `${days} days`)
          : kmLeft !== null ? formatDistance(kmLeft, selectedDistanceUnit) : '-'
        const title = String(reminder.tip || tx('Opomnik', 'Reminder'))
        const subtitle = reminder.datum
          ? `${vehicleDisplayName(car, tx('Vozilo', 'Vehicle'))} - ${asDateText(reminder.datum, locale)}`
          : vehicleDisplayName(car, tx('Vozilo', 'Vehicle'))
        return {
          id: reminder.id,
          carId: reminder.car_id,
          carName: vehicleDisplayName(car, tx('Vozilo', 'Vehicle')),
          title,
          subtitle,
          value,
          tone,
          sortValue: Math.min(days ?? 99999, kmLeft ?? 999999),
          image: carImage(car),
        }
      }).sort((a, b) => a.sortValue - b.sortValue)

      const fuelEvents = (fuelRes.data || []).map((row: any): RecentEvent => {
        const car = carMap[row.car_id]
        return {
          id: `fuel-${row.id}`,
          carId: row.car_id,
          carName: vehicleDisplayName(car, tx('Vozilo', 'Vehicle')),
          title: tx('Tankanje', 'Fill-up'),
          subtitle: `${vehicleDisplayName(car, tx('Vozilo', 'Vehicle'))} - ${row.litri || 0} L`,
          dateText: asDateText(row.datum, locale),
          href: `/zgodovina-goriva?car=${row.car_id}`,
          tone: 'fuel',
          sortValue: new Date(row.datum || row.created_at || 0).getTime(),
          image: carImage(car),
        }
      })

      const serviceEvents = (serviceRes.data || []).map((row: any): RecentEvent => {
        const car = carMap[row.car_id]
        return {
          id: `service-${row.id}`,
          carId: row.car_id,
          carName: vehicleDisplayName(car, tx('Vozilo', 'Vehicle')),
          title: row.opis || tx('Servis', 'Service'),
          subtitle: vehicleDisplayName(car, tx('Vozilo', 'Vehicle')),
          dateText: asDateText(row.datum, locale),
          href: `/zgodovina-servisa?car=${row.car_id}`,
          tone: 'service',
          sortValue: new Date(row.datum || row.created_at || 0).getTime(),
          image: carImage(car),
        }
      })

      const expenseEvents = (expenseRes.data || []).filter((row: any) => row.kategorija !== 'km_sprememba').map((row: any): RecentEvent => {
        const car = carMap[row.car_id]
        return {
          id: `expense-${row.id}`,
          carId: row.car_id,
          carName: vehicleDisplayName(car, tx('Vozilo', 'Vehicle')),
          title: row.opis || row.kategorija || tx('StroĹˇek', 'Expense'),
          subtitle: `${vehicleDisplayName(car, tx('Vozilo', 'Vehicle'))} - ${formatMoney(row.znesek || fuelCostValue(row), selectedCurrency)}`,
          dateText: asDateText(row.datum, locale),
          href: `/stroski?car=${row.car_id}`,
          tone: 'cost',
          sortValue: new Date(row.datum || row.created_at || 0).getTime(),
          image: carImage(car),
        }
      })

      setReminders(nextReminders)
      setRecentEvents([...fuelEvents, ...serviceEvents, ...expenseEvents].sort((a, b) => b.sortValue - a.sortValue).slice(0, 5))
      setLoading(false)
    }
    load()
  }, [language])

  const activeReminders = reminders.filter((item) => item.tone !== 'red')
  const expiredReminders = reminders.filter((item) => item.tone === 'red')
  const serviceSoon = reminders.filter((item) => item.title.toLowerCase().includes('servis') || item.title.toLowerCase().includes('service'))
  const topReminders = reminders.slice(0, 3)
  const displayedRecentEvents = showAllRecentEvents ? recentEvents : recentEvents.slice(0, 1)
  const translateLabel = (value: string) => {
    const normalized = String(value || '').toLowerCase()
    if (normalized === 'registracija') return tx('Registracija', 'Registration')
    if (normalized === 'olje') return tx('Olje', 'Oil')
    if (normalized === 'tankanje') return tx('Tankanje', 'Fill-up')
    if (normalized === 'servis') return tx('Servis', 'Service')
    if (normalized === 'stroĹˇek' || normalized === 'strosek') return tx('StroĹˇek', 'Expense')
    return value
  }

  const greetingName = displayName || tx('uporabnik', 'driver')
  const nextServiceReminder = reminders.find((item) => item.title.toLowerCase().includes('servis') || item.title.toLowerCase().includes('service'))
  const statCards = [
    { label: tx('Vozila', 'Vehicles'), value: cars.length || '-', sub: tx('Vsa vozila.', 'All vehicles.'), href: '/garaza' },
    { label: tx('Opomniki', 'Reminders'), value: reminders.length || '-', sub: tx('Aktivnih.', 'Active.'), href: reminders[0]?.carId ? `/opomniki?car=${reminders[0].carId}` : '/opomniki' },
    { label: tx('StroĹˇki (mesec)', 'Costs (month)'), value: formatMoney(monthlyCost, currency), sub: new Date().toLocaleDateString(locale, { month: 'long', year: 'numeric' }), href: '/stroski-garaza' },
    { label: tx('Naslednji servis', 'Next service'), value: nextServiceReminder?.value || '-', sub: nextServiceReminder?.carName || tx('Ni podatka', 'No data'), href: nextServiceReminder?.carId ? `/opomniki?car=${nextServiceReminder.carId}` : '/opomniki' },
  ]
  const mobileStatCards = [statCards[0], statCards[1], statCards[3]].filter(Boolean)
  const quickActions = [
    { label: tx('Dodaj vozilo', 'Add vehicle'), href: '/dodaj-avto', icon: 'plus' as const },
    { label: tx('ZabeleĹľi servis', 'Log service'), href: favoriteCar?.id ? `/vnos-servisa?car=${favoriteCar.id}` : '/vnos-servisa', icon: 'wrench' as const },
    { label: tx('Dodaj stroĹˇek', 'Add expense'), href: favoriteCar?.id ? `/vnos-stroska?car=${favoriteCar.id}` : '/vnos-stroska', icon: 'box' as const },
    { label: tx('Tankanje', 'Fill-up'), href: favoriteCar?.id ? `/vnos-goriva?car=${favoriteCar.id}` : '/vnos-goriva', icon: 'fuel' as const },
  ]

  return (
    <div className={`gb-app-home min-h-screen px-4 pt-3 pb-[calc(5.9rem+env(safe-area-inset-bottom))] md:pt-6 xl:pb-12 ${isLightTheme ? 'bg-[#f2f0e9] text-[#101225]' : 'bg-[#080a12] text-white'}`}>
      <div className="mx-auto max-w-md xl:max-w-none">
        <div className="xl:hidden">
        <section className="relative -mx-4 -mt-3 min-h-[438px] overflow-hidden rounded-b-[34px]">
          <img src={heroImage} alt={favoriteCarName || 'GarageBase'} className="absolute inset-0 h-full w-full object-cover object-[56%_32%]" loading="eager" decoding="async" />
          <div className={`absolute inset-0 ${isLightTheme ? 'bg-gradient-to-b from-[#f2f0e9]/0 via-[#f2f0e9]/34 to-[#f2f0e9]' : 'bg-gradient-to-b from-black/8 via-[#080a12]/34 to-[#080a12]'}`} />
          <div className="relative z-10 px-5 pt-7">
            <header className="mb-[92px] flex items-center justify-between">
              <button onClick={() => router.push('/domov')} className={`text-[1.55rem] font-black leading-none tracking-tight ${isLightTheme ? 'text-[#101225]' : 'text-white'}`}>
                Garage<span className="text-[#6c63ff]">Base</span>
              </button>
              <div className="flex items-center gap-2">
                <button onClick={() => router.push('/vec')} className="flex h-10 w-10 items-center justify-center rounded-full bg-[#6c63ff] text-sm font-black text-white shadow-lg shadow-[#6c63ff33]">
                  {displayName ? displayName.slice(0, 2).toUpperCase() : 'JN'}
                </button>
                <button onClick={() => router.push(reminders[0]?.carId ? `/opomniki?car=${reminders[0].carId}` : favoriteCar?.id ? `/opomniki?car=${favoriteCar.id}` : '/opomniki')} className={`flex h-10 w-10 items-center justify-center rounded-full shadow-lg shadow-black/10 ${isLightTheme ? 'bg-white/88 text-[#101225]' : 'bg-white/14 text-white'}`}>
                  <Icon type="bell" className="h-5 w-5" />
                </button>
              </div>
            </header>
            <h1 className={`max-w-[84%] text-[2.32rem] font-black leading-[0.98] tracking-tight ${isLightTheme ? 'text-[#101225]' : 'text-white'}`}>
              {tx('Dobrodošel nazaj,', 'Welcome back,')}<br />{greetingName}.
            </h1>
            <p className={`mt-3 text-[0.98rem] font-black ${isLightTheme ? 'text-[#101225]' : 'text-white'}`}>
              {tx('Tvoja garaža. Tvoja vozila. Tvoj nadzor.', 'Your garage. Your vehicles. Your control.')}
            </p>
            <button
              onClick={vstopiVGarazo}
              className="mt-5 flex w-[62%] min-w-[205px] items-center justify-center gap-3 rounded-xl bg-[#6c63ff] px-5 py-3.5 text-base font-black text-white shadow-xl shadow-[#6c63ff55] transition-transform active:scale-[0.98]"
            >
              {cars.length > 0 ? tx('Vstopi v garažo', 'Enter garage') : tx('Dodaj vozilo', 'Add vehicle')}
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </section>

        <section className="mb-6 grid grid-cols-3 gap-3">
            {mobileStatCards.map((item) => (
              <button key={item.label} onClick={() => router.push(item.href)} className={`min-h-[112px] rounded-2xl border p-3.5 text-left shadow-lg shadow-black/5 ${isLightTheme ? 'border-white/80 bg-white/78 text-[#101225]' : 'border-[#2b2f4d] bg-[#151827] text-white'}`}>
                <p className={`text-[0.86rem] font-medium leading-tight ${isLightTheme ? 'text-[#34384a]' : 'text-[#c8cbe0]'}`}>{item.label}</p>
                <p className="mt-1 truncate text-[1.72rem] font-black leading-none">{item.value}</p>
                <p className={`mt-1.5 text-[0.84rem] font-medium leading-tight ${isLightTheme ? 'text-[#3f4658]' : 'text-[#c8cbe0]'}`}>{item.sub}</p>
              </button>
            ))}
        </section>

        <section className="hidden mb-3 overflow-hidden rounded-[22px] border border-[#1e1e32] bg-[#0f0f1a] shadow-xl shadow-black/10 xl:hidden">
          <button
            onClick={() => router.push(cars.length > 0 ? '/garaza' : '/dodaj-avto')}
            className="relative block h-[clamp(118px,18dvh,155px)] w-full overflow-hidden text-left sm:h-[260px] lg:h-[340px]"
          >
            <img src={heroImage} alt="" className="absolute inset-0 h-full w-full object-cover object-[58%_58%]" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#07070d]/66 via-[#07070d]/10 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4 sm:bottom-7 sm:left-7">
              <span className="hidden w-fit items-center gap-3 rounded-2xl bg-[#6c63ff] px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-[#6c63ff44] sm:py-3">
                {cars.length > 0 ? tx('Odpri garaĹľo', 'Open garage') : tx('Dodaj vozilo', 'Add vehicle')}
                <span aria-hidden="true">â†’</span>
              </span>
            </div>
          </button>
        </section>

        {false && favoriteCar && (
          <section className="mb-8 rounded-3xl border border-[#1e1e32] bg-[#0f0f1a] p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-black text-white">{tx('Glavno vozilo', 'Main vehicle')}</h2>
              <button onClick={() => router.push(`/dashboard?car=${favoriteCar.id}`)} className="text-sm font-bold text-[#a09aff]">{tx('Odpri', 'Open')} â†’</button>
            </div>
            <div className="flex items-center gap-4">
              <div className="h-20 w-28 flex-shrink-0 overflow-hidden rounded-2xl bg-[#13131f]">
                {carImage(favoriteCar) ? (
                  <img src={carImage(favoriteCar)} alt={favoriteCarName} className="h-full w-full object-cover" loading="lazy" decoding="async" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[#6c63ff]"><Icon type="car" /></div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-black text-white">{favoriteCarName}</p>
                <p className="mt-1 text-sm text-[#8a8aa8]">
                  {formatDistance(favoriteCar.km_trenutni || 0, distanceUnit)}
                  {favoriteCar.gorivo ? ` - ${favoriteCar.gorivo}` : ''}
                </p>
              </div>
            </div>
          </section>
        )}

        <section className="mb-3">
          <div className="mb-2 flex items-center justify-between">
            <h2 className={`text-[1.15rem] font-black sm:text-[1.18rem] ${isLightTheme ? 'text-[#101225]' : 'text-white'}`}>{tx('Aktivni opomniki', 'Active reminders')}</h2>
            <button onClick={() => router.push(reminders[0]?.carId ? `/opomniki?car=${reminders[0].carId}` : favoriteCar?.id ? `/opomniki?car=${favoriteCar.id}` : '/garaza')} className={`text-sm font-bold ${isLightTheme ? 'text-[#4f5668]' : 'text-[#d8d8e8]'}`}>
              {tx('PrikaĹľi vse', 'Show all')} â†’
            </button>
          </div>
          <div className={`overflow-hidden rounded-[22px] border ${isLightTheme ? 'border-white/70 bg-white/78 shadow-lg shadow-[#101225]/5' : 'border-[#1e1e32] bg-[#0f0f1a]'}`}>
            {topReminders.length === 0 ? (
              <div className="p-5 text-sm font-semibold text-[#8a8aa8]">{tx('Ni aktivnih opomnikov.', 'No active reminders.')}</div>
            ) : topReminders.map((item, index) => {
              const tone = cardTone[item.tone]
              return (
                <button key={item.id} onClick={() => router.push(`/opomniki?car=${item.carId}`)} className={`flex w-full items-center gap-3 p-2 text-left transition-colors hover:bg-white/5 sm:p-2.5 ${index > 0 ? (isLightTheme ? 'border-t border-[#e6e0d7]' : 'border-t border-[#1e1e32]') : ''} ${item.tone === 'red' ? 'ring-1 ring-inset ring-[#ef444422]' : item.tone === 'orange' ? 'ring-1 ring-inset ring-[#f59e0b22]' : ''}`}>
                  <div className="h-9 w-11 flex-shrink-0 overflow-hidden rounded-xl bg-[#13131f] sm:h-12 sm:w-14">
                    {item.image ? <img src={item.image} alt={item.carName} className="h-full w-full object-cover" loading="lazy" decoding="async" /> : <div className="flex h-full w-full items-center justify-center text-[#6c63ff]"><Icon type="car" /></div>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm font-black ${isLightTheme ? 'text-[#101225]' : 'text-white'}`}>{item.carName}</p>
                    <p className={`mt-0.5 truncate text-xs ${isLightTheme ? 'text-[#4f5668]' : 'text-[#d8d8e8]'}`}>{translateLabel(item.title)} - {item.subtitle}</p>
                  </div>
                  <span className={`rounded-xl px-2.5 py-1.5 text-xs font-black sm:px-3 sm:py-2 ${tone.pill}`}>{item.value}</span>
                </button>
              )
            })}
          </div>
        </section>

        <section className="hidden">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[1rem] font-black text-white sm:text-[1.18rem]">{tx('Nedavni dogodki', 'Recent events')}</h2>
            <button onClick={() => setShowAllRecentEvents((value) => !value)} className="text-sm font-bold text-[#d8d8e8]">
              {showAllRecentEvents ? tx('PrikaĹľi manj', 'Show less') : tx('PrikaĹľi vse', 'Show all')} â†’
            </button>
          </div>
          <div className="overflow-hidden rounded-[24px] border border-[#1e1e32] bg-[#0f0f1a]">
            {recentEvents.length === 0 ? (
              <div className="p-5 text-sm font-semibold text-[#8a8aa8]">{tx('Ni zadnjih dogodkov.', 'No recent events.')}</div>
            ) : displayedRecentEvents.map((event, index) => (
              <button key={event.id} onClick={() => router.push(event.href)} className={`flex w-full items-center gap-3 p-2 text-left sm:p-3 ${index > 0 ? 'border-t border-[#1e1e32]' : ''}`}>
                <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl sm:h-12 sm:w-12 ${event.tone === 'fuel' ? 'bg-[#2563eb18] text-[#3b82f6]' : event.tone === 'service' ? 'bg-[#16a34a18] text-[#22c55e]' : 'bg-[#6c63ff18] text-[#8b5cf6]'}`}>
                  <Icon type={event.tone === 'fuel' ? 'fuel' : event.tone === 'service' ? 'wrench' : 'box'} className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-white">{translateLabel(event.title)}</p>
                  <p className="mt-0.5 truncate text-xs text-[#8a8aa8]">{event.subtitle}</p>
                </div>
                <span className="text-xs text-[#8a8aa8]">{event.dateText}</span>
              </button>
            ))}
          </div>
        </section>
        </div>

        <div className="hidden xl:block">
          <section className={`relative mb-10 min-h-[430px] overflow-hidden rounded-[34px] border shadow-2xl ${isLightTheme ? 'border-white/70 bg-white/70 shadow-[#101225]/8' : 'border-white/10 bg-[#10131d] shadow-black/24'}`}>
            <img src={heroImage} alt={favoriteCarName || 'GarageBase'} className="absolute inset-0 h-full w-full object-cover object-center" loading="eager" decoding="async" />
            <div className={`absolute inset-0 ${isLightTheme ? 'bg-gradient-to-r from-[#f2f0e9]/94 via-[#f2f0e9]/72 to-transparent' : 'bg-gradient-to-r from-[#080a12]/94 via-[#080a12]/62 to-transparent'}`} />
            <div className="relative z-10 flex min-h-[430px] flex-col justify-center px-12 py-10">
              <h1 className={`max-w-xl text-6xl font-black leading-[0.96] tracking-tight ${isLightTheme ? 'text-[#101225]' : 'text-white'}`}>
                {tx('Dobrodošel nazaj,', 'Welcome back,')}<br />{greetingName}.
              </h1>
              <p className={`mt-6 text-2xl font-black ${isLightTheme ? 'text-[#101225]' : 'text-white'}`}>
                {tx('Tvoja garaža. Tvoja vozila. Tvoj nadzor.', 'Your garage. Your vehicles. Your control.')}
              </p>
              <button onClick={vstopiVGarazo} className="mt-10 flex w-[330px] items-center justify-center gap-3 rounded-2xl bg-[#6c63ff] px-7 py-4 text-xl font-black text-white shadow-2xl shadow-[#6c63ff55] transition-transform active:scale-[0.98]">
                {cars.length > 0 ? tx('Vstopi v garažo', 'Enter garage') : tx('Dodaj vozilo', 'Add vehicle')}
                <span aria-hidden="true">→</span>
              </button>
            </div>
            <div className="absolute right-8 top-8 z-20 flex items-center gap-3">
              <button onClick={() => router.push(reminders[0]?.carId ? `/opomniki?car=${reminders[0].carId}` : favoriteCar?.id ? `/opomniki?car=${favoriteCar.id}` : '/opomniki')} className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${isLightTheme ? 'border-white/70 bg-white/86 text-[#101225]' : 'border-white/10 bg-white/12 text-white'}`}>
                <Icon type="bell" className="h-6 w-6" />
              </button>
              <button onClick={() => router.push('/vec')} className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${isLightTheme ? 'border-white/70 bg-white/86 text-[#101225]' : 'border-white/10 bg-white/12 text-white'}`}>
                <Icon type="settings" className="h-6 w-6" />
              </button>
            </div>
          </section>

          <section className="mb-10 grid grid-cols-4 gap-5">
            {statCards.map((item) => (
              <button key={item.label} onClick={() => router.push(item.href)} className={`rounded-[24px] border p-7 text-left shadow-xl transition-transform active:scale-[0.99] ${isLightTheme ? 'border-white/70 bg-white/74 text-[#101225] shadow-[#101225]/8' : 'border-[#3f2a8f] bg-white/7 text-white shadow-black/20'}`}>
                <p className={`text-lg font-semibold ${isLightTheme ? 'text-[#333849]' : 'text-[#c9c7d8]'}`}>{item.label}</p>
                <p className="mt-4 truncate text-4xl font-black">{item.value}</p>
                <p className={`mt-2 truncate text-lg font-semibold ${isLightTheme ? 'text-[#4f5668]' : 'text-[#c9c7d8]'}`}>{item.sub}</p>
              </button>
            ))}
          </section>

          <section className="grid grid-cols-2 gap-8">
            <div>
              <h2 className={`mb-5 text-2xl font-black ${isLightTheme ? 'text-[#101225]' : 'text-white'}`}>{tx('Aktivni opomniki', 'Active reminders')}</h2>
              <div className={`overflow-hidden rounded-[24px] border ${isLightTheme ? 'border-white/70 bg-white/76' : 'border-white/10 bg-white/7'}`}>
                {topReminders.length === 0 ? (
                  <div className={`p-6 text-base font-semibold ${isLightTheme ? 'text-[#4f5668]' : 'text-[#c9c7d8]'}`}>{tx('Ni aktivnih opomnikov.', 'No active reminders.')}</div>
                ) : topReminders.map((item, index) => (
                  <button key={item.id} onClick={() => router.push(`/opomniki?car=${item.carId}`)} className={`flex w-full items-center gap-4 p-4 text-left ${index > 0 ? (isLightTheme ? 'border-t border-[#e7e1d6]' : 'border-t border-white/10') : ''}`}>
                    <div className="h-14 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-[#13131f]">
                      {item.image ? <img src={item.image} alt={item.carName} className="h-full w-full object-cover" loading="lazy" decoding="async" /> : <div className="flex h-full w-full items-center justify-center text-[#6c63ff]"><Icon type="car" /></div>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-lg font-black ${isLightTheme ? 'text-[#101225]' : 'text-white'}`}>{item.carName}</p>
                      <p className={`truncate text-sm font-semibold ${isLightTheme ? 'text-[#4f5668]' : 'text-[#d8d8e8]'}`}>{translateLabel(item.title)} - {item.subtitle}</p>
                    </div>
                    <span className="rounded-xl bg-[#ef444414] px-4 py-2 text-sm font-black text-[#ef4444]">{item.value}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h2 className={`mb-5 text-2xl font-black ${isLightTheme ? 'text-[#101225]' : 'text-white'}`}>{tx('Hitre akcije', 'Quick actions')}</h2>
              <div className="grid grid-cols-2 gap-3">
                {quickActions.map((item) => (
                  <button key={item.label} onClick={() => router.push(item.href)} className={`flex min-h-[105px] items-center gap-4 rounded-[22px] border p-5 text-left text-lg font-black ${isLightTheme ? 'border-white/70 bg-white/74 text-[#101225] shadow-xl shadow-[#101225]/8' : 'border-white/10 bg-white/7 text-white'}`}>
                    <Icon type={item.icon} className="h-7 w-7 text-[#8b5cf6]" />
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>

      <BottomNav aktivna="domov" />
    </div>
  )
}
