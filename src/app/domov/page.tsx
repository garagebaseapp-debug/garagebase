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
  const heroMobileImage = isLightTheme ? '/home-garage-premium-light-opt.jpg' : '/home-garage-premium-dark-opt.jpg'
  const heroWebImage = isLightTheme ? '/home-garage-web-light-opt.jpg' : '/home-garage-web-dark-opt.jpg'
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
    image.src = heroMobileImage
    const webImage = new Image()
    webImage.src = heroWebImage
  }, [heroMobileImage, heroWebImage])

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
      const savedDisplayName = (() => {
        try {
          const raw = localStorage.getItem('garagebase_nastavitve')
          const settings = raw ? JSON.parse(raw) : {}
          return String(settings.prikaznoIme || settings.displayName || '').trim()
        } catch {
          return ''
        }
      })()
      const rawName = savedDisplayName || user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || ''
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
          title: row.opis || row.kategorija || tx('Strošek', 'Expense'),
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
  const topReminders = [...reminders]
    .sort((a, b) => {
      if (a.tone === 'red' && b.tone !== 'red') return -1
      if (a.tone !== 'red' && b.tone === 'red') return 1
      return a.sortValue - b.sortValue
    })
    .slice(0, 5)
  const displayedRecentEvents = showAllRecentEvents ? recentEvents : recentEvents.slice(0, 1)
  const translateLabel = (value: string) => {
    const normalized = String(value || '').toLowerCase()
    if (normalized === 'registracija') return tx('Registracija', 'Registration')
    if (normalized === 'olje') return tx('Olje', 'Oil')
    if (normalized === 'tankanje') return tx('Tankanje', 'Fill-up')
    if (normalized === 'servis') return tx('Servis', 'Service')
    if (normalized === 'strošek' || normalized === 'strosek') return tx('Strošek', 'Expense')
    return value
  }

  const greetingName = (displayName || tx('uporabnik', 'driver')).split('@')[0]
  const displayGreetingName = greetingName.length > 10 ? `${greetingName.slice(0, 10)}.` : `${greetingName}.`
  const nextServiceReminder = reminders.find((item) => item.title.toLowerCase().includes('servis') || item.title.toLowerCase().includes('service'))
  const statCards = [
    { label: tx('Vozila', 'Vehicles'), value: cars.length || '-', sub: tx('Vsa vozila.', 'All vehicles.'), href: '/garaza' },
    { label: tx('Opomniki', 'Reminders'), value: reminders.length || '-', sub: tx('Aktivnih.', 'Active.'), href: reminders[0]?.carId ? `/opomniki?car=${reminders[0].carId}` : '/opomniki' },
    { label: tx('Stroški (mesec)', 'Costs (month)'), value: formatMoney(monthlyCost, currency), sub: new Date().toLocaleDateString(locale, { month: 'long', year: 'numeric' }), href: '/stroski-garaza' },
    { label: tx('Naslednji servis', 'Next service'), value: nextServiceReminder?.value || '-', sub: nextServiceReminder?.carName || tx('Ni podatka', 'No data'), href: nextServiceReminder?.carId ? `/opomniki?car=${nextServiceReminder.carId}` : '/opomniki' },
  ]
  const mobileStatCards = [statCards[0], statCards[1], statCards[3]].filter(Boolean)
  const quickActions = [
    { label: tx('Dodaj vozilo', 'Add vehicle'), href: '/dodaj-avto', icon: 'plus' as const },
    { label: tx('Zabeleži servis', 'Log service'), href: favoriteCar?.id ? `/vnos-servisa?car=${favoriteCar.id}` : '/vnos-servisa', icon: 'wrench' as const },
    { label: tx('Dodaj strošek', 'Add expense'), href: favoriteCar?.id ? `/vnos-stroska?car=${favoriteCar.id}` : '/vnos-stroska', icon: 'box' as const },
    { label: tx('Tankanje', 'Fill-up'), href: favoriteCar?.id ? `/vnos-goriva?car=${favoriteCar.id}` : '/vnos-goriva', icon: 'fuel' as const },
  ]
  return (
    <div className={`gb-app-home mx-auto min-h-screen w-full max-w-none px-0 pb-[calc(7.4rem+env(safe-area-inset-bottom))] pt-0 sm:px-0 xl:pl-[280px] xl:pb-12 ${isLightTheme ? 'bg-[#f1f3fb] text-[#101225]' : 'bg-[#1c2438] text-white'}`}>
      <div className="mx-auto w-full max-w-none">
        <section className={`relative mx-4 mb-5 mt-4 min-h-[44svh] overflow-hidden rounded-[30px] shadow-2xl ${isLightTheme ? 'bg-[#e9edf8] shadow-[0_24px_60px_rgba(69,77,115,0.18)]' : 'bg-[#252f49] shadow-[0_24px_60px_rgba(8,12,28,0.24)]'} xl:mx-0 xl:mb-8 xl:mt-0 xl:h-[390px] xl:min-h-0 xl:rounded-[34px]`}>
          <picture>
            <source media="(min-width: 1280px)" srcSet={heroWebImage} />
            <img src={heroMobileImage} alt={favoriteCarName || 'GarageBase'} className="absolute inset-0 h-full w-full object-cover object-[60%_35%] xl:object-center" loading="eager" decoding="async" />
          </picture>
          <div className={`absolute inset-0 ${isLightTheme ? 'bg-gradient-to-r from-[#f1f3fb]/86 via-[#f1f3fb]/18 to-transparent' : 'bg-gradient-to-r from-[#202940]/42 via-[#202940]/10 to-transparent'}`} />
          <div className="relative z-10 flex min-h-[44svh] flex-col px-5 pb-6 pt-5 xl:h-full xl:min-h-0 xl:px-12 xl:py-10">
            <header className="flex items-center justify-between xl:absolute xl:left-12 xl:right-12 xl:top-10 xl:mb-0">
              <button onClick={() => router.push('/domov')} className={`text-[1.55rem] font-black leading-none tracking-tight xl:hidden ${isLightTheme ? 'text-[#101225]' : 'text-white'}`}>
                Garage<span className="text-[#6c63ff]">Base</span>
              </button>
              <div className="hidden xl:block" />
              <div className="flex items-center gap-2">
                <button onClick={() => router.push('/vec')} className="flex h-10 w-10 items-center justify-center rounded-full bg-[#6c63ff] text-sm font-black text-white shadow-lg shadow-[#6c63ff33]">
                  {displayName ? displayName.slice(0, 2).toUpperCase() : 'JN'}
                </button>
                <button
                  type="button"
                  onClick={preklopiTemo}
                  aria-label={isLightTheme ? tx('Preklopi na temni način', 'Switch to dark mode') : tx('Preklopi na svetli način', 'Switch to light mode')}
                  className={`flex h-10 w-[72px] items-center rounded-full border p-1 shadow-lg transition-colors xl:h-12 xl:w-[82px] ${
                    isLightTheme ? 'border-white/80 bg-white/88 shadow-[#101225]/10' : 'border-white/15 bg-white/14 shadow-black/20'
                  }`}
                >
                  <span className={`flex h-8 w-8 items-center justify-center rounded-full text-base font-black shadow-md transition-transform xl:h-10 xl:w-10 ${
                    isLightTheme
                      ? 'translate-x-8 bg-[#6c63ff] text-white xl:translate-x-8'
                      : 'translate-x-0 bg-white text-[#101225]'
                  }`}>
                    {isLightTheme ? '☀' : '☾'}
                  </span>
                </button>
                <button onClick={() => router.push(reminders[0]?.carId ? `/opomniki?car=${reminders[0].carId}` : favoriteCar?.id ? `/opomniki?car=${favoriteCar.id}` : '/opomniki')} className={`flex h-10 w-10 items-center justify-center rounded-full shadow-lg shadow-black/10 xl:h-12 xl:w-12 ${isLightTheme ? 'bg-white/88 text-[#101225]' : 'bg-white/14 text-white'}`}>
                  <Icon type="bell" className="h-5 w-5 xl:h-6 xl:w-6" />
                </button>
                <button onClick={() => router.push('/vec')} className={`hidden h-10 w-10 items-center justify-center rounded-full shadow-lg shadow-black/10 xl:flex xl:h-12 xl:w-12 ${isLightTheme ? 'bg-white/88 text-[#101225]' : 'bg-white/14 text-white'}`}>
                  <Icon type="settings" className="h-5 w-5 xl:h-6 xl:w-6" />
                </button>
              </div>
            </header>
            <div className="mt-auto pb-2 xl:mt-20 xl:max-w-[450px] xl:pb-0">
              <h1 className={`max-w-[88%] text-[2.48rem] font-black leading-[1.02] tracking-tight drop-shadow-[0_2px_14px_rgba(255,255,255,0.35)] xl:max-w-none xl:text-[2.85rem] xl:leading-[1] ${isLightTheme ? 'text-[#080912]' : 'text-white'}`}>
                {tx('Dobrodošel', 'Welcome')}<br />{tx('nazaj,', 'back,')} {displayGreetingName}
              </h1>
              <p className={`mt-2 text-[1.05rem] font-black xl:text-lg ${isLightTheme ? 'text-[#151722]' : 'text-white'}`}>
                {tx('Tvoja garaža. Tvoja vozila. Tvoj nadzor.', 'Your garage. Your vehicles. Your control.')}
              </p>
              <button
                onClick={vstopiVGarazo}
                className="mt-7 flex w-full max-w-[360px] items-center justify-center gap-3 rounded-[24px] border border-[#d9ccff]/75 bg-[linear-gradient(135deg,#8d6bff_0%,#6f43f1_48%,#431a9f_100%)] px-8 py-[1.45rem] text-[1.35rem] font-black text-white shadow-[0_20px_42px_rgba(92,48,196,0.46),0_8px_18px_rgba(36,18,84,0.24),inset_0_1px_0_rgba(255,255,255,0.48),inset_0_-12px_26px_rgba(32,8,91,0.34)] ring-1 ring-white/25 transition-all hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0 active:scale-[0.98] xl:absolute xl:left-[92px] xl:top-[268px] xl:mt-0 xl:h-[72px] xl:w-[270px] xl:max-w-[270px] xl:rounded-[24px] xl:px-7 xl:py-0 xl:text-[1.08rem]"
              >
                {cars.length > 0 ? tx('Vstopi v garažo', 'Enter garage') : tx('Dodaj vozilo', 'Add vehicle')}
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>
        </section>

        <section className="mb-5 grid w-full grid-cols-3 gap-3 px-4 xl:hidden">
          {mobileStatCards.map((item) => (
            <button key={item.label} onClick={() => router.push(item.href)} className={`min-h-[132px] rounded-[20px] border p-4 text-left shadow-lg transition-transform active:scale-[0.99] xl:min-h-[132px] xl:rounded-[24px] xl:p-6 ${isLightTheme ? 'border-[#ffffff]/90 bg-[#fbfbff]/88 text-[#101225] shadow-[0_16px_36px_rgba(69,77,115,0.14)]' : 'border-[#53617f] bg-[#252f49]/94 text-white shadow-[0_16px_34px_rgba(8,12,28,0.22)]'}`}>
              <p className={`text-[0.96rem] font-medium leading-tight xl:text-lg ${isLightTheme ? 'text-[#34384a]' : 'text-[#c9c7d8]'}`}>{item.label}</p>
              <p className="mt-1.5 truncate text-[2.05rem] font-black leading-none xl:mt-3 xl:text-4xl">{item.value}</p>
              <p className={`mt-2 text-[0.9rem] font-medium leading-tight xl:text-base ${isLightTheme ? 'text-[#3f4658]' : 'text-[#c9c7d8]'}`}>{item.sub}</p>
            </button>
          ))}
        </section>
        <section className="mx-auto mb-8 hidden max-w-6xl grid-cols-4 gap-5 xl:grid">
          {statCards.map((item) => (
            <button key={item.label} onClick={() => router.push(item.href)} className={`min-h-[118px] rounded-[22px] border p-5 text-left shadow-lg transition-transform active:scale-[0.99] ${isLightTheme ? 'border-[#ffffff]/90 bg-[#fbfbff]/88 text-[#101225] shadow-[0_16px_36px_rgba(69,77,115,0.14)]' : 'border-[#53617f] bg-[#252f49]/94 text-white shadow-[0_16px_34px_rgba(8,12,28,0.22)]'}`}>
              <p className={`text-sm font-medium leading-tight ${isLightTheme ? 'text-[#34384a]' : 'text-[#c9c7d8]'}`}>{item.label}</p>
              <p className="mt-2 truncate text-3xl font-black leading-none">{item.value}</p>
              <p className={`mt-2 text-sm font-medium leading-tight ${isLightTheme ? 'text-[#3f4658]' : 'text-[#c9c7d8]'}`}>{item.sub}</p>
            </button>
          ))}
        </section>

        <section className="mx-auto grid w-full gap-5 px-4 xl:w-auto xl:max-w-6xl xl:grid-cols-2 xl:gap-8 xl:px-0">
          <div>
            <div className="mb-2 flex items-center justify-between xl:mb-5">
              <h2 className={`text-[1.35rem] font-black xl:text-xl ${isLightTheme ? 'text-[#080912]' : 'text-white'}`}>{tx('Aktivni opomniki', 'Active reminders')}</h2>
              <button onClick={() => router.push(reminders[0]?.carId ? `/opomniki?car=${reminders[0].carId}` : favoriteCar?.id ? `/opomniki?car=${favoriteCar.id}` : '/garaza')} className={`text-sm font-medium xl:font-bold ${isLightTheme ? 'text-[#34384a]' : 'text-[#d8d8e8]'}`}>
                {tx('Prikaži vse', 'Show all')} →
              </button>
            </div>
            <div className={`overflow-hidden rounded-[18px] shadow-[0_8px_22px_rgba(16,18,37,0.06)] xl:rounded-[24px] ${isLightTheme ? 'border border-[#ffffff]/90 bg-[#fbfbff]/88 shadow-[0_16px_36px_rgba(69,77,115,0.14)]' : 'border border-[#53617f] bg-[#252f49]/94 shadow-[0_18px_42px_rgba(8,12,28,0.24)]'}`}>
              {topReminders.length === 0 ? (
                <div className={`p-5 text-sm font-semibold xl:p-6 xl:text-base ${isLightTheme ? 'text-[#6b7280]' : 'text-[#c9c7d8]'}`}>{tx('Ni aktivnih opomnikov.', 'No active reminders.')}</div>
              ) : topReminders.map((item, index) => {
                const tone = cardTone[item.tone]
                return (
                  <button key={item.id} onClick={() => router.push(`/opomniki?car=${item.carId}`)} className={`flex w-full items-center gap-3.5 p-3.5 text-left xl:gap-4 xl:p-4 ${index > 0 ? (isLightTheme ? 'border-t border-[#d9def0]' : 'border-t border-white/10') : ''}`}>
                    <div className="h-[72px] w-[88px] flex-shrink-0 overflow-hidden rounded-[16px] bg-[#e3e7f4] xl:h-12 xl:w-14 xl:rounded-xl">
                      {item.image ? <img src={item.image} alt={item.carName} className="h-full w-full object-cover" loading="lazy" decoding="async" /> : <div className="flex h-full w-full items-center justify-center text-[#6c63ff]"><Icon type="car" /></div>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-[1.05rem] font-black xl:text-base ${isLightTheme ? 'text-[#080912]' : 'text-white'}`}>{item.carName}</p>
                      <p className={`mt-0.5 truncate text-[0.9rem] xl:text-sm ${isLightTheme ? 'text-[#4f5668]' : 'text-[#d8d8e8]'}`}>{translateLabel(item.title)} - {item.subtitle}</p>
                    </div>
                    <span className={`rounded-xl px-3 py-2 text-[0.9rem] font-black xl:rounded-xl xl:px-4 xl:py-2 xl:text-sm ${tone.pill}`}>{item.value}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="hidden xl:block">
            <h2 className={`mb-5 text-2xl font-black ${isLightTheme ? 'text-[#080912]' : 'text-white'}`}>{tx('Hitre akcije', 'Quick actions')}</h2>
            <div className="grid grid-cols-2 gap-3">
              {quickActions.map((item) => (
                <button key={item.label} onClick={() => router.push(item.href)} className={`flex min-h-[105px] items-center gap-4 rounded-[22px] border p-5 text-left text-lg font-black ${isLightTheme ? 'border-[#ffffff]/80 bg-[#fbfbff]/82 text-[#101225] shadow-xl shadow-[#454d73]/12' : 'border-[#53617f] bg-[#252f49]/92 text-white shadow-xl shadow-[#080c1c]/18'}`}>
                  <Icon type={item.icon} className="h-7 w-7 text-[#8b5cf6]" />
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>

      <BottomNav aktivna="domov" />
    </div>
  )
}
