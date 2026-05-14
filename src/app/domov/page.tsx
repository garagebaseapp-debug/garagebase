'use client'

import { useEffect, useMemo, useState } from 'react'
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

function Icon({ type, className = 'h-6 w-6' }: { type: 'home' | 'car' | 'shield' | 'wrench' | 'calendar' | 'fuel' | 'cost' | 'bell' | 'box'; className?: string }) {
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
      <path d="M14.5 5.5a5 5 0 0 0 4 6l-8.7 8.7a2.4 2.4 0 0 1-3.4-3.4l8.7-8.7a5 5 0 0 0-.6-2.6Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
      <path d="M5 19V9M12 19V5M19 19v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 19h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
  if (type === 'bell') return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M18 9a6 6 0 0 0-12 0v4l-2 4h16l-2-4V9Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M10 20a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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

  const heroImage = theme === 'svetla' ? '/landing-hero-light.jpg' : '/landing-hero-dark.jpg'
  const favoriteCar = cars[0]
  const favoriteCarName = favoriteCar ? vehicleDisplayName(favoriteCar, tx('Vozilo', 'Vehicle')) : ''

  const carImage = (car: any) => {
    const raw = car?.slika_url || car?.slika || ''
    if (!raw) return ''
    return imageUrlWithVersion(raw, car?.slika_updated_at || car?.updated_at || car?.created_at || GARAGE_CACHE_VERSION)
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

  useEffect(() => {
    const load = async () => {
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
        window.location.href = '/'
        return
      }

      let { data: carsData, error: carsError } = await supabase
        .from('cars')
        .select('*')
        .eq('user_id', user.id)
        .eq('arhivirano', false)
        .order('vrstni_red', { ascending: true })

      if (carsError) {
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
        setLoading(false)
        return
      }

      const [remindersRes, fuelRes, serviceRes, expenseRes] = await Promise.all([
        supabase.from('reminders').select('*').in('car_id', ids).order('datum', { ascending: true }).limit(24),
        supabase.from('fuel_logs').select('*').in('car_id', ids).order('datum', { ascending: false }).limit(8),
        supabase.from('service_logs').select('*').in('car_id', ids).order('datum', { ascending: false }).limit(8),
        supabase.from('expenses').select('*').in('car_id', ids).order('datum', { ascending: false }).limit(8),
      ])

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
  const topReminders = reminders.slice(0, 3)

  const statCards = [
    { label: tx('Vozil', 'Vehicles'), value: cars.length, icon: 'car' as const, tone: 'text-[#6c63ff]', href: '/garaza' },
    { label: tx('Aktivna opomnika', 'Active reminders'), value: activeReminders.length, icon: 'shield' as const, tone: 'text-[#6c63ff]', href: reminders[0]?.carId ? `/opomniki?car=${reminders[0].carId}` : '/garaza' },
    { label: tx('Servis kmalu', 'Service soon'), value: serviceSoon.length, icon: 'wrench' as const, tone: 'text-[#16a34a]', href: serviceSoon[0]?.carId ? `/opomniki?car=${serviceSoon[0].carId}` : '/garaza' },
    { label: tx('Zapadli dogodki', 'Overdue events'), value: expiredReminders.length, icon: 'calendar' as const, tone: 'text-[#ef4444]', href: expiredReminders[0]?.carId ? `/opomniki?car=${expiredReminders[0].carId}` : '/garaza' },
  ]

  return (
    <div className="gb-app-home min-h-screen bg-[#080810] px-5 pt-5 pb-24 text-white md:pt-6">
      <div className="mx-auto max-w-md lg:max-w-5xl">
        <header className="mb-6 flex items-center justify-between">
          <button onClick={() => window.location.href = '/domov'} className="text-3xl font-black tracking-tight text-white">
            Garage<span className="text-[#6c63ff]">Base</span>
          </button>
          <button onClick={() => window.location.href = '/nastavitve'} className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#1e1e32] bg-[#0f0f1a] text-[#8a8aa8]">
            <Icon type="bell" className="h-5 w-5" />
          </button>
        </header>

        <section className="mb-5">
          <h1 className="max-w-2xl text-[2rem] font-black leading-[1.08] text-white sm:text-5xl">
            {tx('Dobrodošel nazaj,', 'Welcome back,')}<br />
            {tx('Pripravljen ', 'Ready for the ')}<span className="text-[#6c63ff]">{tx('na pot?', 'road?')}</span>
          </h1>
        </section>

        <section className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {statCards.map((item) => (
            <button key={item.label} onClick={() => window.location.href = item.href} className="min-h-[118px] rounded-[22px] border border-[#1e1e32] bg-[#0f0f1a] p-3 text-center shadow-xl shadow-black/10 transition-transform active:scale-[0.98]">
              <div className={`mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#6c63ff14] ${item.tone}`}>
                <Icon type={item.icon} className="h-6 w-6" />
              </div>
              <p className="text-2xl font-black text-white">{loading && cars.length === 0 ? '-' : item.value}</p>
              <p className="mt-1 text-[13px] leading-tight text-[#8a8aa8]">{item.label}</p>
            </button>
          ))}
        </section>

        <section className="mb-6 overflow-hidden rounded-[24px] border border-[#1e1e32] bg-[#0f0f1a] shadow-xl shadow-black/10">
          <button
            onClick={() => window.location.href = cars.length > 0 ? '/garaza' : '/dodaj-avto'}
            className="relative block h-[220px] w-full overflow-hidden text-left sm:h-[300px] lg:h-[340px]"
          >
            <img src={heroImage} alt="" className="absolute inset-0 h-full w-full object-cover object-[58%_58%]" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#07070d]/66 via-[#07070d]/10 to-transparent" />
            <div className="absolute bottom-5 left-5 right-5 sm:bottom-7 sm:left-7">
              <span className="inline-flex w-fit items-center gap-3 rounded-2xl bg-[#6c63ff] px-5 py-3.5 text-base font-black text-white shadow-lg shadow-[#6c63ff44]">
                {cars.length > 0 ? tx('Odpri garažo', 'Open garage') : tx('Dodaj vozilo', 'Add vehicle')}
                <span aria-hidden="true">→</span>
              </span>
            </div>
          </button>
        </section>

        {false && favoriteCar && (
          <section className="mb-8 rounded-3xl border border-[#1e1e32] bg-[#0f0f1a] p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-black text-white">{tx('Glavno vozilo', 'Main vehicle')}</h2>
              <button onClick={() => window.location.href = `/dashboard?car=${favoriteCar.id}`} className="text-sm font-bold text-[#a09aff]">{tx('Odpri', 'Open')} →</button>
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

        <section className="mb-7">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[1.35rem] font-black text-white">{tx('Aktivni opomniki', 'Active reminders')}</h2>
            <button onClick={() => window.location.href = reminders[0]?.carId ? `/opomniki?car=${reminders[0].carId}` : '/garaza'} className="text-sm font-bold text-[#d8d8e8]">
              {tx('Prikaži vse', 'Show all')} →
            </button>
          </div>
          <div className="overflow-hidden rounded-[24px] border border-[#1e1e32] bg-[#0f0f1a]">
            {topReminders.length === 0 ? (
              <div className="p-5 text-sm font-semibold text-[#8a8aa8]">{tx('Ni aktivnih opomnikov.', 'No active reminders.')}</div>
            ) : topReminders.map((item, index) => {
              const tone = cardTone[item.tone]
              return (
                <button key={item.id} onClick={() => window.location.href = `/opomniki?car=${item.carId}`} className={`flex w-full items-center gap-3 p-3 text-left ${index > 0 ? 'border-t border-[#1e1e32]' : ''}`}>
                  <div className="h-14 w-16 flex-shrink-0 overflow-hidden rounded-2xl bg-[#13131f]">
                    {item.image ? <img src={item.image} alt={item.carName} className="h-full w-full object-cover" loading="lazy" decoding="async" /> : <div className="flex h-full w-full items-center justify-center text-[#6c63ff]"><Icon type="car" /></div>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-black text-white">{item.carName}</p>
                    <p className="mt-1 truncate text-sm text-[#d8d8e8]">{item.title} - {item.subtitle}</p>
                  </div>
                  <span className={`rounded-2xl px-4 py-3 text-sm font-black ${tone.pill}`}>{item.value}</span>
                </button>
              )
            })}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[1.35rem] font-black text-white">{tx('Nedavni dogodki', 'Recent events')}</h2>
            <button onClick={() => window.location.href = favoriteCar ? `/dashboard?car=${favoriteCar.id}` : '/garaza'} className="text-sm font-bold text-[#d8d8e8]">
              {tx('Prikaži vse', 'Show all')} →
            </button>
          </div>
          <div className="overflow-hidden rounded-[24px] border border-[#1e1e32] bg-[#0f0f1a]">
            {recentEvents.length === 0 ? (
              <div className="p-5 text-sm font-semibold text-[#8a8aa8]">{tx('Ni zadnjih dogodkov.', 'No recent events.')}</div>
            ) : recentEvents.slice(0, 3).map((event, index) => (
              <button key={event.id} onClick={() => window.location.href = event.href} className={`flex w-full items-center gap-4 p-4 text-left ${index > 0 ? 'border-t border-[#1e1e32]' : ''}`}>
                <div className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl ${event.tone === 'fuel' ? 'bg-[#2563eb18] text-[#3b82f6]' : event.tone === 'service' ? 'bg-[#16a34a18] text-[#22c55e]' : 'bg-[#6c63ff18] text-[#8b5cf6]'}`}>
                  <Icon type={event.tone === 'fuel' ? 'fuel' : event.tone === 'service' ? 'wrench' : 'box'} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-black text-white">{event.title}</p>
                  <p className="mt-1 truncate text-sm text-[#8a8aa8]">{event.subtitle}</p>
                </div>
                <span className="text-sm text-[#8a8aa8]">{event.dateText}</span>
              </button>
            ))}
          </div>
        </section>
      </div>

      <BottomNav aktivna="domov" />
    </div>
  )
}
