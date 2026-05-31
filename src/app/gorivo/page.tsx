'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BottomNav } from '@/lib/nav'
import { useLanguage } from '@/lib/i18n'
import { formatMoney, getCurrencyFromSettings, type GarageBaseCurrency } from '@/lib/currency'
import { formatDistance, getDistanceUnitFromSettings, type DistanceUnit } from '@/lib/units'
import { imageUrlWithVersion } from '@/lib/vehicle-cache'
import { vehicleDisplayName } from '@/lib/vehicle-display'
import {
  combineConsumptionSegments,
  consumptionSegment,
  fuelCostValue,
  fuelLitersValue,
  fuelPriceValue,
  importBuckets,
  isImportedHistoryRow,
  numberValue,
  rowMileageValue,
} from '@/lib/vehicle-costs'

type MetricTone = 'purple' | 'blue' | 'green' | 'orange'

type MetricCardProps = {
  title: string
  icon: 'fuel' | 'range' | 'cost' | 'calendar'
  total: number | null
  garageBase?: number | null
  imported?: number | null
  garageBaseCount?: number
  importedCount?: number
  formatter: (value: number | null) => string
  tone: MetricTone
  labels: {
    garageBase: string
    imported: string
    total: string
    importShort: string
  }
}

type MonthPoint = {
  label: string
  garageBase: number | null
  imported: number | null
  total: number | null
}

const monthKey = (value: string | null | undefined) => {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

const toDateValue = (value: string | null | undefined) => {
  const date = value ? new Date(value).getTime() : 0
  return Number.isFinite(date) ? date : 0
}

const monthStarts = () => {
  const now = new Date()
  return Array.from({ length: 6 }, (_, index) => new Date(now.getFullYear(), now.getMonth() - (5 - index), 1))
}

const moneySum = (rows: any[]) => rows.reduce((sum, row) => sum + fuelCostValue(row), 0)
const literSum = (rows: any[]) => rows.reduce((sum, row) => sum + fuelLitersValue(row), 0)
const averageLiters = (rows: any[]) => rows.length > 0 ? literSum(rows) / rows.length : 0

const isPartialFill = (row: any) =>
  row?.polni_rezervar === false || String(row?.polni_rezervar).toLowerCase() === 'false'

function Icon({ type, className = 'h-6 w-6' }: { type: MetricCardProps['icon'] | 'car' | 'plus', className?: string }) {
  if (type === 'fuel') return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 3h7a1 1 0 0 1 1 1v17H6V4a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="2.2"/>
      <path d="M8 7h5v4H8V7ZM15 7h2l2 3v7a2 2 0 0 0 2 2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
    </svg>
  )
  if (type === 'range') return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 14a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" strokeWidth="2.2"/>
      <path d="M4 16a9 9 0 1 1 16 0M12 14l4-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
    </svg>
  )
  if (type === 'cost') return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 7h8a4 4 0 0 1 0 8H7M7 7v10M5 11h9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
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
      <path d="M7 18v1.5M17 18v1.5M7 15h.01M17 15h.01" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
    </svg>
  )
}

const toneClasses: Record<MetricTone, { text: string, bg: string }> = {
  purple: { text: 'text-[#7c3aed]', bg: 'bg-[#6c63ff14]' },
  blue: { text: 'text-[#2563eb]', bg: 'bg-[#2563eb14]' },
  green: { text: 'text-[#16a34a]', bg: 'bg-[#16a34a14]' },
  orange: { text: 'text-[#f97316]', bg: 'bg-[#f9731614]' },
}

function MetricCard({ title, icon, total, garageBase, imported, garageBaseCount, importedCount, formatter, tone, labels }: MetricCardProps) {
  const showBreakdown = numberValue(imported) > 0
  const toneClass = toneClasses[tone]
  return (
    <div className="rounded-[22px] border border-[#1e1e32] bg-[#0f0f1a] p-4 shadow-xl shadow-black/10">
      <div className="mb-3 flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${toneClass.bg} ${toneClass.text}`}>
          <Icon type={icon} className="h-5 w-5" />
        </div>
        <p className="text-base font-black leading-tight text-white">{title}</p>
      </div>
      {showBreakdown ? (
        <div className="space-y-2 text-sm">
          <div className="rounded-2xl border border-[#6c63ff55] bg-[#6c63ff18] px-3 py-2">
            <div className="flex items-center justify-between gap-3">
              <span className="font-black text-[#6d28d9]">{labels.garageBase}</span>
              <span className="font-black text-[#6d28d9]">{formatter(garageBase ?? null)}</span>
            </div>
          </div>
          <div className="rounded-2xl border border-[#16a34a55] bg-[#16a34a18] px-3 py-2">
            <div className="flex items-center justify-between gap-3">
              <span className="font-black text-[#15803d]">{labels.imported}</span>
              <span className="font-black text-[#15803d]">{formatter(imported ?? null)}</span>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#1e1e32] bg-[#13131f] px-3 py-2">
            <span className="font-black text-white">{labels.total}</span>
            <span className="font-black text-white">{formatter(total)}</span>
          </div>
          {(garageBaseCount || importedCount) && (
            <p className="pt-1 text-xs text-[#8a8aa8]">
              {garageBaseCount || 0} GB / {importedCount || 0} {labels.importShort}
            </p>
          )}
        </div>
      ) : (
        <p className="text-3xl font-black leading-tight text-white">{formatter(total)}</p>
      )}
    </div>
  )
}

function FuelChart({
  points,
  hasImported,
  emptyText,
  labels,
  ariaLabel,
}: {
  points: MonthPoint[]
  hasImported: boolean
  emptyText: string
  labels: { garageBase: string; imported: string; total: string }
  ariaLabel: string
}) {
  const values = points.flatMap((point) => [point.total, point.garageBase, point.imported]).filter((value): value is number => value !== null && value > 0)
  if (values.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-2xl border border-[#1e1e32] bg-[#13131f] text-sm font-semibold text-[#8a8aa8]">
        {emptyText}
      </div>
    )
  }

  const min = Math.max(0, Math.floor(Math.min(...values) - 1))
  const max = Math.ceil(Math.max(...values) + 1)
  const width = 360
  const height = 190
  const left = 42
  const right = 12
  const top = 20
  const bottom = 44
  const plotWidth = width - left - right
  const plotHeight = height - top - bottom
  const yFor = (value: number) => top + (max - value) / Math.max(1, max - min) * plotHeight
  const xFor = (index: number) => left + (points.length <= 1 ? 0 : (index / (points.length - 1)) * plotWidth)
  const pathFor = (key: keyof MonthPoint) => points
    .map((point, index) => ({ value: point[key], index }))
    .filter((item): item is { value: number; index: number } => typeof item.value === 'number' && item.value > 0)
    .map((item, order) => `${order === 0 ? 'M' : 'L'} ${xFor(item.index)} ${yFor(item.value)}`)
    .join(' ')
  const totalPath = pathFor('total')
  const garagePath = pathFor('garageBase')
  const importedPath = pathFor('imported')
  const ticks = [max, (max + min) / 2, min]

  return (
    <div className="overflow-hidden rounded-2xl border border-[#1e1e32] bg-[#13131f] p-3">
      <div className="mb-2 flex flex-wrap gap-3 text-[11px] font-bold text-[#8a8aa8]">
        {hasImported && <span><span className="mr-1 inline-block h-2 w-4 rounded-full bg-[#7c3aed]" />{labels.garageBase}</span>}
        {hasImported && <span><span className="mr-1 inline-block h-2 w-4 rounded-full bg-[#16a34a]" />{labels.imported}</span>}
        <span><span className="mr-1 inline-block h-2 w-4 rounded-full bg-[#3b82f6]" />{labels.total}</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-48 w-full" role="img" aria-label={ariaLabel}>
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={left} x2={width - right} y1={yFor(tick)} y2={yFor(tick)} stroke="currentColor" className="text-[#25253a]" strokeWidth="1" />
            <text x="4" y={yFor(tick) + 4} className="fill-[#8a8aa8] text-[10px] font-bold">{tick.toFixed(tick % 1 === 0 ? 0 : 1)}</text>
          </g>
        ))}
        {hasImported && garagePath && <path d={garagePath} fill="none" stroke="#7c3aed" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />}
        {hasImported && importedPath && <path d={importedPath} fill="none" stroke="#16a34a" strokeWidth="3" strokeDasharray="7 6" strokeLinecap="round" strokeLinejoin="round" />}
        {totalPath && <path d={totalPath} fill="none" stroke="#3b82f6" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />}
        {points.map((point, index) => (
          <g key={point.label}>
            {point.total !== null && point.total > 0 && <circle cx={xFor(index)} cy={yFor(point.total)} r="4" fill="#3b82f6" />}
            <text x={xFor(index)} y={height - 16} textAnchor="middle" className="fill-[#8a8aa8] text-[11px] font-bold">{point.label}</text>
          </g>
        ))}
      </svg>
    </div>
  )
}

export default function GorivoPage() {
  const { language } = useLanguage()
  const tx = (sl: string, en: string) => language === 'en' ? en : sl
  const locale = language === 'en' ? 'en-US' : 'sl-SI'
  const metricLabels = {
    garageBase: tx('Naši vnosi', 'Our entries'),
    imported: tx('Uvoženo', 'Imported'),
    total: tx('Skupaj', 'Total'),
    importShort: tx('uvoz', 'import'),
  }
  const [loading, setLoading] = useState(true)
  const [cars, setCars] = useState<any[]>([])
  const [fuelRows, setFuelRows] = useState<any[]>([])
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

      const carsRes = await supabase
        .from('cars')
        .select('*')
        .eq('user_id', user.id)
        .or('arhivirano.is.null,arhivirano.eq.false')
        .order('vrstni_red', { ascending: true })

      if (carsRes.error) console.warn('[GarageBase fuel] active cars query failed', carsRes.error)
      let nextCars = carsRes.data || []
      if (carsRes.error || nextCars.length === 0) {
        const fallback = await supabase
          .from('cars')
          .select('*')
          .eq('user_id', user.id)
          .order('vrstni_red', { ascending: true })
        if (fallback.error) console.warn('[GarageBase fuel] fallback cars query failed', fallback.error)
        nextCars = (fallback.data || []).filter((car: any) => car?.arhivirano !== true)
      }

      const carParam = new URLSearchParams(window.location.search).get('car')
      if (carParam) {
        const selectedCar = nextCars.find((car: any) => car?.id === carParam)
        if (selectedCar) {
          nextCars = [selectedCar]
        } else {
          const directCar = await supabase
            .from('cars')
            .select('*')
            .eq('user_id', user.id)
            .eq('id', carParam)
            .maybeSingle()
          if (directCar.error) console.warn('[GarageBase fuel] selected car query failed', directCar.error)
          if (directCar.data && directCar.data.arhivirano !== true) nextCars = [directCar.data]
        }
      }

      setCars(nextCars)
      const carIds = nextCars.map((car: any) => car.id).filter(Boolean)
      if (carIds.length === 0) {
        setFuelRows([])
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('fuel_logs')
        .select('*')
        .in('car_id', carIds)
        .order('datum', { ascending: false })
        .limit(1200)

      if (error) console.warn('[GarageBase fuel] fuel logs query failed', error)
      setFuelRows(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const carById = useMemo(() => {
    const map: Record<string, any> = {}
    cars.forEach((car) => { if (car?.id) map[car.id] = car })
    return map
  }, [cars])

  const buckets = useMemo(() => importBuckets(fuelRows), [fuelRows])
  const importedRows = useMemo(() => fuelRows.filter((row) => isImportedHistoryRow(row, buckets)), [fuelRows, buckets])
  const garageBaseRows = useMemo(() => fuelRows.filter((row) => !isImportedHistoryRow(row, buckets)), [fuelRows, buckets])

  const now = new Date()
  const yearStart = new Date(now.getFullYear(), 0, 1).getTime()
  const lastMonthStart = Date.now() - 30 * 24 * 60 * 60 * 1000
  const yearRows = fuelRows.filter((row) => toDateValue(row.datum || row.created_at) >= yearStart)
  const lastMonthRows = fuelRows.filter((row) => toDateValue(row.datum || row.created_at) >= lastMonthStart)
  const yearImportedRows = yearRows.filter((row) => isImportedHistoryRow(row, buckets))
  const yearGarageRows = yearRows.filter((row) => !isImportedHistoryRow(row, buckets))
  const monthImportedRows = lastMonthRows.filter((row) => isImportedHistoryRow(row, buckets))
  const monthGarageRows = lastMonthRows.filter((row) => !isImportedHistoryRow(row, buckets))

  const garageConsumption = consumptionSegment(garageBaseRows)
  const importedConsumption = consumptionSegment(importedRows)
  const totalConsumption = combineConsumptionSegments([garageConsumption, importedConsumption])
  const hasImportedConsumption = importedConsumption.average !== null && importedRows.length > 0
  const tankCapacityLiters = cars.length === 1
    ? numberValue(cars[0]?.rezervar_litri ?? cars[0]?.tank_capacity_liters)
    : 0
  const rangeFor = (rows: any[], average: number | null) => {
    if (average && tankCapacityLiters > 0) return (tankCapacityLiters / average) * 100
    const avgLiters = averageLiters(rows)
    return average && avgLiters > 0 ? (avgLiters / average) * 100 : null
  }

  const monthlyPoints = useMemo((): MonthPoint[] => {
    const months = monthStarts()
    const monthMap = new Map<string, { gbDistance: number, gbLiters: number, importDistance: number, importLiters: number }>()
    months.forEach((month) => {
      monthMap.set(monthKey(month.toISOString()), { gbDistance: 0, gbLiters: 0, importDistance: 0, importLiters: 0 })
    })

    const byCar = new Map<string, any[]>()
    fuelRows.forEach((row) => {
      if (!row?.car_id) return
      const list = byCar.get(row.car_id) || []
      list.push(row)
      byCar.set(row.car_id, list)
    })

    byCar.forEach((rows) => {
      const sorted = [...rows]
        .filter((row) => rowMileageValue(row) > 0 && fuelLitersValue(row) > 0)
        .sort((a, b) => {
          const km = rowMileageValue(a) - rowMileageValue(b)
          if (km !== 0) return km
          return toDateValue(a.datum || a.created_at) - toDateValue(b.datum || b.created_at)
        })

      for (let index = 1; index < sorted.length; index++) {
        const row = sorted[index]
        if (isPartialFill(row)) continue
        const prev = sorted[index - 1]
        const distance = rowMileageValue(row) - rowMileageValue(prev)
        const liters = fuelLitersValue(row)
        const key = monthKey(row.datum || row.created_at)
        const point = monthMap.get(key)
        if (!point || distance <= 0 || liters <= 0) continue
        if (isImportedHistoryRow(row, buckets)) {
          point.importDistance += distance
          point.importLiters += liters
        } else {
          point.gbDistance += distance
          point.gbLiters += liters
        }
      }
    })

    return months.map((month) => {
      const data = monthMap.get(monthKey(month.toISOString())) || { gbDistance: 0, gbLiters: 0, importDistance: 0, importLiters: 0 }
      const gb = data.gbDistance > 0 ? (data.gbLiters / data.gbDistance) * 100 : null
      const imported = data.importDistance > 0 ? (data.importLiters / data.importDistance) * 100 : null
      const totalDistance = data.gbDistance + data.importDistance
      const totalLiters = data.gbLiters + data.importLiters
      return {
        label: month.toLocaleDateString(locale, { month: 'short' }).replace('.', ''),
        garageBase: gb,
        imported,
        total: totalDistance > 0 ? (totalLiters / totalDistance) * 100 : null,
      }
    })
  }, [fuelRows, buckets, locale])

  const carImage = (car: any) => {
    const raw = car?.slika_url || car?.slika || ''
    if (!raw) return ''
    return imageUrlWithVersion(raw, car?.slika_updated_at || car?.updated_at || car?.created_at)
  }

  const consumptionText = (value: number | null) => value ? `${value.toFixed(1)} L/100km` : '-'
  const rangeText = (value: number | null) => value ? formatDistance(Math.round(value), distanceUnit) : '-'
  const recentRows = [...fuelRows].sort((a, b) => toDateValue(b.datum || b.created_at) - toDateValue(a.datum || a.created_at)).slice(0, 5)
  const firstCarId = cars[0]?.id
  const addFuelHref = firstCarId ? `/vnos-goriva?car=${firstCarId}` : '/dodaj-avto'
  const hasImported = importedRows.length > 0

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080810] px-5 py-6 pb-24 text-white xl:pl-[280px]">
        <div className="mx-auto w-full max-w-5xl">
          <p className="text-[#8a8aa8]">{tx('Nalaganje...', 'Loading...')}</p>
        </div>
        <BottomNav aktivna="gorivo" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#080810] px-4 pt-5 pb-28 text-white md:px-8 xl:pl-[280px]">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-lg font-black text-white">Garage<span className="text-[#6c63ff]">Base</span></p>
            <h1 className="mt-4 text-4xl font-black tracking-tight text-white">{tx('Gorivo.', 'Fuel.')}</h1>
          </div>
          <button
            onClick={() => window.location.href = addFuelHref}
            className="inline-flex items-center gap-2 rounded-2xl bg-[#5b21d9] px-4 py-3 text-sm font-black text-white shadow-lg shadow-[#6c63ff44]"
          >
            <Icon type="plus" className="h-5 w-5" />
            {tx('Dodaj točenje', 'Add fill-up')}
          </button>
        </header>

        {cars.length === 0 ? (
          <section className="rounded-[28px] border border-[#1e1e32] bg-[#0f0f1a] p-6 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-[#6c63ff14] text-[#6c63ff]">
              <Icon type="car" />
            </div>
            <h2 className="text-2xl font-black text-white">{tx('Najprej dodaj vozilo', 'Add a vehicle first')}</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-[#8a8aa8]">
              {tx('Ko imaš vozilo, lahko začneš spremljati tankanja, porabo in stroške.', 'Once you have a vehicle, you can track fill-ups, consumption and costs.')}
            </p>
            <button onClick={() => window.location.href = '/dodaj-avto'} className="mt-5 rounded-2xl bg-[#6c63ff] px-5 py-3 font-black text-white">
              {tx('Dodaj vozilo', 'Add vehicle')}
            </button>
          </section>
        ) : (
          <>
            <section className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                title={tx('Povprečna poraba', 'Average consumption')}
                icon="fuel"
                total={totalConsumption}
                garageBase={garageConsumption.average}
                imported={hasImportedConsumption ? importedConsumption.average : null}
                garageBaseCount={garageBaseRows.length}
                importedCount={importedRows.length}
                formatter={consumptionText}
                tone="purple"
                labels={metricLabels}
              />
              <MetricCard
                title={tx('Doseg', 'Range')}
                icon="range"
                total={rangeFor(fuelRows, totalConsumption)}
                garageBase={rangeFor(garageBaseRows, garageConsumption.average)}
                imported={hasImportedConsumption ? rangeFor(importedRows, importedConsumption.average) : null}
                formatter={rangeText}
                tone="blue"
                labels={metricLabels}
              />
              <MetricCard
                title={tx('Stroški zadnji mesec', 'Costs last month')}
                icon="cost"
                total={moneySum(lastMonthRows)}
                garageBase={moneySum(monthGarageRows)}
                imported={moneySum(monthImportedRows)}
                formatter={(value) => value !== null ? formatMoney(value, currency, 2) : '-'}
                tone="green"
                labels={metricLabels}
              />
              <MetricCard
                title={tx('Skupni stroški letos', 'Total costs this year')}
                icon="calendar"
                total={moneySum(yearRows)}
                garageBase={moneySum(yearGarageRows)}
                imported={moneySum(yearImportedRows)}
                formatter={(value) => value !== null ? formatMoney(value, currency, 0) : '-'}
                tone="orange"
                labels={metricLabels}
              />
            </section>

            <section className="mb-7 rounded-[28px] border border-[#1e1e32] bg-[#0f0f1a] p-4 shadow-xl shadow-black/10">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-black text-white">{tx('Poraba v zadnjih 6 mesecih', 'Consumption in the last 6 months')}</h2>
                <p className="text-xs font-bold text-[#8a8aa8]">L/100km</p>
              </div>
              <FuelChart
                points={monthlyPoints}
                hasImported={hasImported}
                emptyText={tx('Premalo podatkov za graf porabe.', 'Not enough data for the consumption chart.')}
                labels={{ garageBase: metricLabels.garageBase, imported: metricLabels.imported, total: metricLabels.total }}
                ariaLabel={tx('Poraba v zadnjih 6 mesecih', 'Consumption in the last 6 months')}
              />
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-2xl font-black text-white">{tx('Zadnja točenja', 'Latest fill-ups')}</h2>
                {firstCarId && (
                  <button onClick={() => window.location.href = `/zgodovina-goriva?car=${firstCarId}`} className="text-sm font-bold text-[#d8d8e8]">
                    {tx('Prikaži vse', 'Show all')} →
                  </button>
                )}
              </div>
              <div className="overflow-hidden rounded-[26px] border border-[#1e1e32] bg-[#0f0f1a]">
                {recentRows.length === 0 ? (
                  <div className="p-6 text-sm font-semibold text-[#8a8aa8]">{tx('Ni vnosov goriva.', 'No fuel entries yet.')}</div>
                ) : recentRows.map((row, index) => {
                  const car = carById[row.car_id]
                  const imported = isImportedHistoryRow(row, buckets)
                  const image = carImage(car)
                  return (
                    <button key={row.id || `${row.car_id}-${index}`} onClick={() => window.location.href = `/zgodovina-goriva?car=${row.car_id}`} className={`flex w-full items-center gap-3 p-3 text-left ${index > 0 ? 'border-t border-[#1e1e32]' : ''}`}>
                      <div className="h-14 w-16 flex-shrink-0 overflow-hidden rounded-2xl bg-[#13131f]">
                        {image ? <img src={image} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" /> : <div className="flex h-full w-full items-center justify-center text-[#6c63ff]"><Icon type="car" /></div>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-base font-black text-white">{vehicleDisplayName(car, tx('Vozilo', 'Vehicle'))}</p>
                          {imported && <span className="rounded-lg border border-[#16a34a55] bg-[#16a34a18] px-2 py-1 text-[10px] font-black text-[#15803d]">{tx('Uvoz', 'Import')}</span>}
                        </div>
                        <p className="mt-1 truncate text-sm text-[#8a8aa8]">
                          {new Date(row.datum || row.created_at).toLocaleDateString(locale)} - {fuelLitersValue(row).toFixed(1)} L
                          {fuelPriceValue(row) > 0 ? ` - ${fuelPriceValue(row).toFixed(3)} /L` : ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="rounded-xl bg-[#6c63ff18] px-3 py-2 text-sm font-black text-[#a09aff]">{formatMoney(fuelCostValue(row), currency, 2)}</p>
                        {rowMileageValue(row) > 0 && <p className="mt-1 text-xs text-[#8a8aa8]">{formatDistance(rowMileageValue(row), distanceUnit)}</p>}
                      </div>
                    </button>
                  )
                })}
              </div>
            </section>
          </>
        )}
      </div>
      <BottomNav aktivna="gorivo" />
    </div>
  )
}
