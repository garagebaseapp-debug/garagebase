'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BackButton, BottomNav } from '@/lib/nav'
import { useLanguage } from '@/lib/i18n'
import { formatMoney, getCurrencyFromSettings, type GarageBaseCurrency } from '@/lib/currency'
import { formatDistance, getDistanceUnitFromSettings, type DistanceUnit } from '@/lib/units'
import { imageUrlWithVersion } from '@/lib/vehicle-cache'
import { vehicleDisplayName } from '@/lib/vehicle-display'
import { importBuckets, isImportedHistoryRow, numberValue, rowMileageValue } from '@/lib/vehicle-costs'

type CardTone = 'purple' | 'green' | 'orange' | 'blue'

type StatCardProps = {
  title: string
  value: string
  sub?: string
  tone: CardTone
  icon: 'service' | 'cost' | 'range' | 'calendar'
}

type ServiceCar = Record<string, unknown> & {
  id: string
  znamka?: string | null
  model?: string | null
  slika_url?: string | null
  slika?: string | null
  slika_updated_at?: string | null
  updated_at?: string | null
  created_at?: string | null
  arhivirano?: boolean | null
}

type ServiceRow = Record<string, unknown> & {
  id?: string
  car_id?: string
  datum?: string | null
  created_at?: string | null
  km?: number | string | null
  cena?: number | string | null
  servis?: string | null
  opis?: string | null
}

type ReminderRow = Record<string, unknown> & {
  tip?: string | null
  naziv?: string | null
  opis?: string | null
}

const toneClasses: Record<CardTone, string> = {
  purple: 'text-[#7c3aed] bg-[#6c63ff14]',
  green: 'text-[#16a34a] bg-[#16a34a14]',
  orange: 'text-[#f97316] bg-[#f9731614]',
  blue: 'text-[#2563eb] bg-[#2563eb14]',
}

const toDateValue = (value: string | null | undefined) => {
  const time = value ? new Date(value).getTime() : 0
  return Number.isFinite(time) ? time : 0
}

function Icon({ type, className = 'h-6 w-6' }: { type: StatCardProps['icon'] | 'plus' | 'car', className?: string }) {
  if (type === 'service') return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M14.5 5.5a5 5 0 0 0 4 6l-8.7 8.7a2.4 2.4 0 0 1-3.4-3.4l8.7-8.7a5 5 0 0 0-.6-2.6Z" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
  if (type === 'cost') return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 7h8a4 4 0 0 1 0 8H7M7 7v10M5 11h9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
  if (type === 'range') return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 18h14M7 15l4-4 3 3 4-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
  if (type === 'calendar') return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
    </svg>
  )
  if (type === 'plus') return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"/>
    </svg>
  )
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 13l1.5-4.2A3 3 0 0 1 9.3 7h5.4a3 3 0 0 1 2.8 1.8L19 13" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
      <path d="M4 13h16v5H4v-5Z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round"/>
    </svg>
  )
}

function StatCard({ title, value, sub, tone, icon }: StatCardProps) {
  return (
    <div className="rounded-[22px] border border-[#1e1e32] bg-[#0f0f1a] p-4 shadow-xl shadow-black/10">
      <div className="mb-3 flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${toneClasses[tone]}`}>
          <Icon type={icon} className="h-5 w-5" />
        </div>
        <p className="text-base font-black leading-tight text-white">{title}</p>
      </div>
      <p className="text-3xl font-black leading-tight text-white">{value}</p>
      {sub && <p className="mt-1 text-sm font-semibold text-[#8a8aa8]">{sub}</p>}
    </div>
  )
}

async function loadActiveCars(userId: string) {
  const query = await supabase
    .from('cars')
    .select('*')
    .eq('user_id', userId)
    .or('arhivirano.is.null,arhivirano.eq.false')
    .order('vrstni_red', { ascending: true })

  let cars = query.data || []
  if (query.error || cars.length === 0) {
    if (query.error) console.warn('[GarageBase service] active cars query failed', query.error)
    const fallback = await supabase
      .from('cars')
      .select('*')
      .eq('user_id', userId)
      .order('vrstni_red', { ascending: true })
    if (fallback.error) console.warn('[GarageBase service] fallback cars query failed', fallback.error)
    cars = ((fallback.data || []) as ServiceCar[]).filter((car) => car?.arhivirano !== true)
  }
  return cars as ServiceCar[]
}

export default function ServisPage() {
  const { language } = useLanguage()
  const tx = (sl: string, en: string) => language === 'en' ? en : sl
  const locale = language === 'en' ? 'en-US' : 'sl-SI'
  const [loading, setLoading] = useState(true)
  const [cars, setCars] = useState<ServiceCar[]>([])
  const [services, setServices] = useState<ServiceRow[]>([])
  const [reminders, setReminders] = useState<ReminderRow[]>([])
  const [currency, setCurrency] = useState<GarageBaseCurrency>('EUR')
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>('km')

  useEffect(() => {
    const load = async () => {
      setCurrency(getCurrencyFromSettings())
      setDistanceUnit(getDistanceUnitFromSettings())
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = '/'
        return
      }

      let activeCars = await loadActiveCars(user.id)
      const carParam = new URLSearchParams(window.location.search).get('car')
      if (carParam) {
        const selectedCar = activeCars.find((car) => car?.id === carParam)
        if (selectedCar) activeCars = [selectedCar]
      }
      setCars(activeCars)
      const ids = activeCars.map((car) => car.id).filter((id): id is string => Boolean(id))
      if (ids.length === 0) {
        setLoading(false)
        return
      }

      const [servicesRes, remindersRes] = await Promise.all([
        supabase.from('service_logs').select('*').in('car_id', ids).order('datum', { ascending: false }).limit(1200),
        supabase.from('reminders').select('*').in('car_id', ids).order('datum', { ascending: true }).limit(80),
      ])
      if (servicesRes.error) console.warn('[GarageBase service] service logs query failed', servicesRes.error)
      if (remindersRes.error) console.warn('[GarageBase service] reminders query failed', remindersRes.error)
      setServices((servicesRes.data || []) as ServiceRow[])
      setReminders((remindersRes.data || []) as ReminderRow[])
      setLoading(false)
    }
    load()
  }, [])

  const carById = useMemo(() => {
    const map: Record<string, ServiceCar> = {}
    cars.forEach((car) => { if (car?.id) map[car.id] = car })
    return map
  }, [cars])

  const buckets = useMemo(() => importBuckets(services), [services])
  const importedServices = services.filter((row) => isImportedHistoryRow(row, buckets))
  const garageServices = services.filter((row) => !isImportedHistoryRow(row, buckets))
  const totalCost = services.reduce((sum, row) => sum + numberValue(row?.cena), 0)
  const importedCost = importedServices.reduce((sum, row) => sum + numberValue(row?.cena), 0)
  const garageCost = garageServices.reduce((sum, row) => sum + numberValue(row?.cena), 0)
  const yearStart = new Date(new Date().getFullYear(), 0, 1).getTime()
  const yearServices = services.filter((row) => toDateValue(row.datum || row.created_at) >= yearStart)
  const yearCost = yearServices.reduce((sum, row) => sum + numberValue(row?.cena), 0)
  const yearImportedCost = yearServices
    .filter((row) => isImportedHistoryRow(row, buckets))
    .reduce((sum, row) => sum + numberValue(row?.cena), 0)
  const yearGarageCost = yearServices
    .filter((row) => !isImportedHistoryRow(row, buckets))
    .reduce((sum, row) => sum + numberValue(row?.cena), 0)

  const serviceReminders = reminders.filter((reminder) => {
    const raw = `${reminder?.tip || ''} ${reminder?.naziv || ''} ${reminder?.opis || ''}`.toLowerCase()
    return raw.includes('servis') || raw.includes('service')
  })

  const averageGap = useMemo(() => {
    const diffs: number[] = []
    const byCar = new Map<string, ServiceRow[]>()
    services.forEach((row) => {
      if (!row?.car_id || rowMileageValue(row) <= 0) return
      const list = byCar.get(row.car_id) || []
      list.push(row)
      byCar.set(row.car_id, list)
    })
    byCar.forEach((rows) => {
      const sorted = [...rows].sort((a, b) => rowMileageValue(a) - rowMileageValue(b))
      for (let i = 1; i < sorted.length; i++) {
        const diff = rowMileageValue(sorted[i]) - rowMileageValue(sorted[i - 1])
        if (diff > 0) diffs.push(diff)
      }
    })
    if (diffs.length === 0) return null
    return diffs.reduce((sum, value) => sum + value, 0) / diffs.length
  }, [services])

  const latestService = services[0]
  const latestCar = latestService?.car_id ? carById[latestService.car_id] : null
  const firstCarId = latestService?.car_id || cars[0]?.id
  const addServiceHref = cars.length > 0 ? '/vnos-servisa' : '/dodaj-avto'
  const recentServices = services.slice(0, 5)
  const hasImported = importedServices.length > 0

  const carImage = (car: ServiceCar) => {
    const raw = car?.slika_url || car?.slika || ''
    if (!raw) return ''
    return imageUrlWithVersion(raw, car?.slika_updated_at || car?.updated_at || car?.created_at)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080810] px-5 py-6 pb-24 text-white">
        <p className="text-[#8a8aa8]">{tx('Nalaganje...', 'Loading...')}</p>
        <BottomNav aktivna="servis" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#080810] px-4 pt-5 pb-28 text-white md:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <BackButton />
            <div className="min-w-0">
            <p className="text-lg font-black text-white">Garage<span className="text-[#6c63ff]">Base</span></p>
            <h1 className="mt-4 text-4xl font-black tracking-tight text-white">{tx('Servis.', 'Service.')}</h1>
            </div>
          </div>
          <button
            onClick={() => window.location.href = addServiceHref}
            className="inline-flex items-center gap-2 rounded-2xl bg-[#5b21d9] px-4 py-3 text-sm font-black text-white shadow-lg shadow-[#6c63ff44]"
          >
            <Icon type="plus" className="h-5 w-5" />
            {tx('Dodaj servis', 'Add service')}
          </button>
        </header>

        {cars.length === 0 ? (
          <section className="rounded-[28px] border border-[#1e1e32] bg-[#0f0f1a] p-6 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-[#6c63ff14] text-[#6c63ff]">
              <Icon type="car" />
            </div>
            <h2 className="text-2xl font-black text-white">{tx('Najprej dodaj vozilo', 'Add a vehicle first')}</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-[#8a8aa8]">
              {tx('Ko imaš vozilo, lahko vodiš servisno knjigo, račune in opomnike.', 'Once you have a vehicle, you can track service history, receipts and reminders.')}
            </p>
            <button onClick={() => window.location.href = '/dodaj-avto'} className="mt-5 rounded-2xl bg-[#6c63ff] px-5 py-3 font-black text-white">
              {tx('Dodaj vozilo', 'Add vehicle')}
            </button>
          </section>
        ) : (
          <>
            <section className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard title={tx('Prihajajoči servisi', 'Upcoming services')} value={String(serviceReminders.length)} sub={tx('opomniki za servis', 'service reminders')} tone="purple" icon="service" />
              <StatCard
                title={tx('Stroški servisa letos', 'Service costs this year')}
                value={formatMoney(yearCost, currency, 0)}
                sub={hasImported ? `${tx('Naši vnosi', 'Our entries')}: ${formatMoney(yearGarageCost, currency, 0)} · ${tx('Uvoz', 'Import')}: ${formatMoney(yearImportedCost, currency, 0)}` : undefined}
                tone="green"
                icon="cost"
              />
              <StatCard title={tx('Povprečna razdalja', 'Average distance')} value={averageGap ? formatDistance(Math.round(averageGap), distanceUnit) : '-'} sub={tx('med servisnimi vnosi', 'between service entries')} tone="blue" icon="range" />
              <StatCard
                title={tx('Zadnji servis', 'Latest service')}
                value={latestCar ? vehicleDisplayName(latestCar, tx('Vozilo', 'Vehicle')) : '-'}
                sub={latestService?.datum ? new Date(latestService.datum).toLocaleDateString(locale) : undefined}
                tone="orange"
                icon="calendar"
              />
            </section>

            <section className="mb-7 rounded-[28px] border border-[#1e1e32] bg-[#0f0f1a] p-5 shadow-xl shadow-black/10">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black text-white">{tx('Skupaj servisov', 'Service total')}</h2>
                  <p className="mt-1 text-sm font-semibold text-[#8a8aa8]">
                    {services.length} {tx('vnosov', 'entries')}
                  </p>
                </div>
                <p className="text-3xl font-black text-white">{formatMoney(totalCost, currency, 0)}</p>
              </div>
              {hasImported && (
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm font-bold">
                  <div className="rounded-2xl border border-[#6c63ff33] bg-[#6c63ff12] p-3">
                    <p className="text-[#a09aff]">{tx('Naši vnosi', 'Our entries')}</p>
                    <p className="mt-1 text-lg text-white">{garageServices.length} · {formatMoney(garageCost, currency, 0)}</p>
                  </div>
                  <div className="rounded-2xl border border-[#f9731633] bg-[#f9731612] p-3">
                    <p className="text-[#f97316]">{tx('Uvoženo', 'Imported')}</p>
                    <p className="mt-1 text-lg text-white">{importedServices.length} · {formatMoney(importedCost, currency, 0)}</p>
                  </div>
                </div>
              )}
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-2xl font-black text-white">{tx('Zadnji servisi', 'Latest services')}</h2>
                {firstCarId && (
                  <button onClick={() => window.location.href = `/zgodovina-servisa?car=${firstCarId}`} className="text-sm font-bold text-[#d8d8e8]">
                    {tx('Prikaži vse', 'Show all')} →
                  </button>
                )}
              </div>
              <div className="overflow-hidden rounded-[26px] border border-[#1e1e32] bg-[#0f0f1a]">
                {recentServices.length === 0 ? (
                  <div className="p-6 text-sm font-semibold text-[#8a8aa8]">{tx('Ni servisnih vnosov.', 'No service entries yet.')}</div>
                ) : recentServices.map((row, index) => {
                  const car = row.car_id ? carById[row.car_id] : null
                  const image = car ? carImage(car) : ''
                  const imported = isImportedHistoryRow(row, buckets)
                  return (
                    <button key={row.id || `${row.car_id}-${index}`} onClick={() => window.location.href = `/zgodovina-servisa?car=${row.car_id}`} className={`flex w-full items-center gap-3 p-3 text-left ${index > 0 ? 'border-t border-[#1e1e32]' : ''}`}>
                      <div className="h-14 w-16 flex-shrink-0 overflow-hidden rounded-2xl bg-[#13131f]">
                        {image ? <img src={image} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" /> : <div className="flex h-full w-full items-center justify-center text-[#6c63ff]"><Icon type="car" /></div>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-base font-black text-white">{vehicleDisplayName(car, tx('Vozilo', 'Vehicle'))}</p>
                          {imported && <span className="rounded-lg bg-[#f9731618] px-2 py-1 text-[10px] font-black text-[#f97316]">{tx('Uvoz', 'Import')}</span>}
                        </div>
                        <p className="mt-1 truncate text-sm text-[#8a8aa8]">
                          {row.datum ? new Date(row.datum).toLocaleDateString(locale) : '-'} · {rowMileageValue(row) > 0 ? formatDistance(rowMileageValue(row), distanceUnit) : '-'}
                          {row.servis ? ` · ${row.servis}` : ''}
                        </p>
                      </div>
                      <p className="rounded-xl bg-[#6c63ff18] px-3 py-2 text-sm font-black text-[#a09aff]">{formatMoney(numberValue(row?.cena), currency, 2)}</p>
                    </button>
                  )
                })}
              </div>
            </section>
          </>
        )}
      </div>
      <BottomNav aktivna="servis" />
    </div>
  )
}
