'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { HomeButton, BackButton } from '@/lib/nav'
import { type GarageBaseCurrency, currencySymbol, formatMoney, getCurrencyFromSettings } from '@/lib/currency'
import { useLanguage } from '@/lib/i18n'
import { formatDistance, getDistanceUnitFromSettings, type DistanceUnit } from '@/lib/units'
import { buildCostSummary as buildSharedCostSummary, buildVehicleStats, costDistanceFromFuelRows, costValueFor, splitRowsBySource, vehicleOwnershipCostValue } from '@/lib/vehicle-costs'
import { clearVehicleDataCaches, ensureVehicleStatsCacheVersion, readGarageCache, VEHICLE_STATS_CACHE_VERSION } from '@/lib/vehicle-cache'

const COST_LIST_SIZE = 60
const fuelCostColumns = 'id,car_id,datum,km,litri,cena_na_liter,cena_skupaj,postaja,created_at,receipt_url,import_batch_id,source_owner_label,polni_rezervar,verification_level'
const serviceCostColumns = 'id,car_id,datum,km,cena,servis,opis,created_at,foto_url,import_batch_id,source_owner_label'
const expenseCostColumns = 'id,car_id,datum,znesek,kategorija,opis,created_at,receipt_url,import_batch_id,source_owner_label'
const isLockedRecordError = (error: any) => String(error?.message || '').includes('manual_record_locked_after_24h')

const numericValue = (value: unknown) => {
  const raw = String(value ?? '').trim()
  let normalized = raw
  const comma = raw.lastIndexOf(',')
  const dot = raw.lastIndexOf('.')
  if (comma >= 0 && dot >= 0) {
    normalized = comma > dot
      ? raw.replace(/\./g, '').replace(',', '.')
      : raw.replace(/,/g, '')
  } else if (comma >= 0) {
    normalized = raw.replace(',', '.')
  }
  const cleaned = normalized.replace(/[^0-9.-]/g, '')
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

const statsHasData = (stats: any) => {
  if (!stats) return false
  const rowCount =
    numericValue(stats.rows?.fuel) +
    numericValue(stats.rows?.service) +
    numericValue(stats.rows?.expense)
  const costTotal =
    numericValue(stats.costs?.fuel) +
    numericValue(stats.costs?.service) +
    numericValue(stats.costs?.expense)
  return rowCount > 0 || costTotal > 0
}

const statsHasRealValues = (stats: any) => {
  if (!stats) return false
  const costTotal =
    numericValue(stats.costs?.fuel) +
    numericValue(stats.costs?.service) +
    numericValue(stats.costs?.expense) +
    numericValue(stats.costs?.total)
  return costTotal > 0 ||
    numericValue(stats.consumption?.garageBase) > 0 ||
    numericValue(stats.consumption?.imported) > 0 ||
    numericValue(stats.consumption?.total) > 0
}

const firstUsableStats = (...sets: any[]) =>
  sets.find((stats) => statsHasRealValues(stats)) ||
  sets.find((stats) => statsHasData(stats)) ||
  null

const hasConsumptionValues = (consumption: any) =>
  numericValue(consumption?.garageBase) > 0 ||
  numericValue(consumption?.imported) > 0 ||
  numericValue(consumption?.total) > 0

const apiDebugText = (payload: any) => {
  const debug = payload?.debug
  if (!debug) return `api:${payload?.source || 'stats'}`
  const selected = debug.selected
  const selectedText = selected ? `${selected.fuel}/${selected.service}/${selected.expense}` : '?'
  const statsRows = debug.statsRows ? `${debug.statsRows.fuel}/${debug.statsRows.service}/${debug.statsRows.expense}` : ''
  const statsText = statsRows ? ` stats:${statsRows}` : ''
  const sumText = debug.statsTotal || debug.statsLiters
    ? ` sum:${numericValue(debug.statsTotal).toFixed(0)}/${numericValue(debug.statsLiters).toFixed(0)}`
    : ''
  const sample = debug.sampleFuel
  const sampleText = sample
    ? ` sample:${numericValue(sample.computedCost).toFixed(0)}/${numericValue(sample.computedLiters).toFixed(0)}`
    : ''
  const consumption = debug.statsConsumption
  const consumptionText = consumption
    ? ` cons:${numericValue(consumption.total || consumption.garageBase || consumption.imported).toFixed(1)}`
    : ''
  const otherRows = Array.isArray(debug.userCarsWithRows)
    ? debug.userCarsWithRows.reduce((sum: number, car: any) => sum + numericValue(car.fuel) + numericValue(car.service) + numericValue(car.expense), 0)
    : 0
  return `api:${payload?.source || selected?.label || 'stats'} sel:${selectedText}${statsText}${sumText}${sampleText}${consumptionText}${otherRows > 0 ? ` all:${otherRows}` : ''}`
}

const firstNumberValue = (row: any, keys: string[]) => {
  for (const key of keys) {
    const value = numericValue(row?.[key])
    if (value > 0) return value
  }
  return 0
}

const fuelLitersValue = (row: any) =>
  firstNumberValue(row, ['litri', 'liters', 'litres', 'liter', 'volume', 'volumen', 'Volumen', 'kolicina', 'količina', 'quantity', 'qty'])

const fuelPriceValue = (row: any) =>
  firstNumberValue(row, ['cena_na_liter', 'cenaNaLiter', 'price_per_liter', 'pricePerLiter', 'price/l', 'Cena / L', 'Cena/L'])

const fuelCostValue = (row: any) => {
  const direct = firstNumberValue(row, ['cena_skupaj', 'cenaSkupaj', 'skupaj', 'skupni_stroski', 'skupniStroski', 'Skupni stroški', 'total', 'Total', 'amount', 'znesek'])
  if (direct > 0) return direct
  const liters = fuelLitersValue(row)
  const price = fuelPriceValue(row)
  return liters > 0 && price > 0 ? liters * price : 0
}

const readCostCache = (carId: string) => {
  try {
    const raw = localStorage.getItem(`garagebase_stroski_cache_${carId}`)
    const parsed = raw ? JSON.parse(raw) : null
    const gorivo = Array.isArray(parsed?.gorivo) ? parsed.gorivo : []
    const servisi = Array.isArray(parsed?.servisi) ? parsed.servisi : []
    const expenses = Array.isArray(parsed?.expenses) ? parsed.expenses : []
    const isFullCostCache = parsed?.fullCosts === true || Array.isArray(parsed?.servisi) || Array.isArray(parsed?.expenses) || !!parsed?.serverStats
    if (isFullCostCache && (gorivo.length || servisi.length || expenses.length || parsed?.serverStats)) {
      return { gorivo, servisi, expenses, serverStats: parsed?.serverStats }
    }
  } catch {}
  return null
}

const readFuelHistoryCache = (carId: string) => {
  try {
    const raw = localStorage.getItem(`garagebase_fuel_history_cache_${carId}`)
    const parsed = raw ? JSON.parse(raw) : null
    const rows = Array.isArray(parsed?.rows) ? parsed.rows : []
    return rows.length ? rows : []
  } catch {
    return []
  }
}

const readVehicleStatsCache = (carId?: string) => {
  if (!carId) return null
  try {
    const raw = localStorage.getItem(`garagebase_vehicle_stats_${carId}`)
    const parsed = raw ? JSON.parse(raw) : null
    const total =
      numericValue(parsed?.costs?.total) ||
      numericValue(parsed?.fuelCost) + numericValue(parsed?.serviceCost) + numericValue(parsed?.expenseCost)
    const imported = numericValue(parsed?.costs?.imported)
    const rows =
      numericValue(parsed?.rows?.fuel) +
      numericValue(parsed?.rows?.service) +
      numericValue(parsed?.rows?.expense) +
      numericValue(parsed?.fuelRows)
    const liters = numericValue(parsed?.liters) || numericValue(parsed?.fuelLiters)
    if (total <= 0 && rows <= 0 && liters <= 0) return null
    return {
      ...parsed,
      rows: {
        fuel: numericValue(parsed?.rows?.fuel) || numericValue(parsed?.fuelRows),
        service: numericValue(parsed?.rows?.service),
        expense: numericValue(parsed?.rows?.expense),
      },
      liters,
      costs: {
        fuel: numericValue(parsed?.costs?.fuel) || numericValue(parsed?.fuelCost),
        service: numericValue(parsed?.costs?.service) || numericValue(parsed?.serviceCost),
        expense: numericValue(parsed?.costs?.expense) || numericValue(parsed?.expenseCost),
        garageBase: numericValue(parsed?.costs?.garageBase) || Math.max(0, total - imported),
        imported,
        total,
        perKm: parsed?.costs?.perKm ?? parsed?.costs?.naKm ?? null,
      },
      consumption: parsed?.consumption || {},
    }
  } catch {
    return null
  }
}

const buildRowStatsFromRows = (fuelRows: any[] = [], serviceRows: any[] = [], expenseRows: any[] = [], car?: any) => {
  const filteredExpenses = expenseRows.filter((row: any) => row?.kategorija !== 'km_sprememba')
  const fuelCost = fuelRows.reduce((sum, row) => sum + fuelCostValue(row), 0)
  const serviceCost = serviceRows.reduce((sum, row) => sum + numericValue(row?.cena), 0)
  const expenseCost = filteredExpenses.reduce((sum, row) => sum + numericValue(row?.znesek), 0)
  const totalCost = fuelCost + serviceCost + expenseCost
  const costRows = [
    ...fuelRows.map((row) => ({ ...row, _tip: 'gorivo' })),
    ...serviceRows.map((row) => ({ ...row, _tip: 'servis' })),
    ...filteredExpenses.map((row) => ({ ...row, _tip: 'ostalo' })),
  ]
  const sourceSplit = splitRowsBySource(costRows)
  const imported = sourceSplit.imported.reduce((sum, row) => sum + costValueFor(row), 0)
  const garageBase = Math.max(0, totalCost - imported)
  const drivenKm = costDistanceFromFuelRows(fuelRows, car)

  return {
    rows: {
      fuel: fuelRows.length,
      service: serviceRows.length,
      expense: filteredExpenses.length,
    },
    liters: fuelRows.reduce((sum, row) => sum + fuelLitersValue(row), 0),
    costs: {
      fuel: fuelCost,
      service: serviceCost,
      expense: expenseCost,
      garageBase,
      imported,
      total: totalCost,
      perKm: drivenKm > 0 && garageBase > 0 ? garageBase / drivenKm : null,
    },
    consumption: {},
  }
}

const emptyCostSummary = () => ({
  fuel: 0,
  service: 0,
  expense: 0,
  total: 0,
  imported: 0,
  garageBase: 0,
  rows: {
    fuel: 0,
    service: 0,
    expense: 0,
  },
})

const normalizeCostSummary = (summary: any) => ({
  fuel: numericValue(summary?.fuel),
  service: numericValue(summary?.service),
  expense: numericValue(summary?.expense),
  total: numericValue(summary?.total),
  imported: numericValue(summary?.imported),
  garageBase: numericValue(summary?.garageBase),
  rows: {
    fuel: numericValue(summary?.rows?.fuel),
    service: numericValue(summary?.rows?.service),
    expense: numericValue(summary?.rows?.expense),
  },
})

const mergeCostSummaries = (...summaries: any[]) => {
  const merged = emptyCostSummary()
  summaries.forEach((summary) => {
    if (!summary) return
    const item = normalizeCostSummary(summary)
    const calculatedTotal = item.fuel + item.service + item.expense
    const hasValues = calculatedTotal > 0 || item.total > 0 || item.imported > 0 || item.garageBase > 0
    const hasRows = item.rows.fuel > 0 || item.rows.service > 0 || item.rows.expense > 0
    if (!hasValues && !hasRows) return
    if (!hasValues && hasRows) {
      merged.rows.fuel = Math.max(merged.rows.fuel, item.rows.fuel)
      merged.rows.service = Math.max(merged.rows.service, item.rows.service)
      merged.rows.expense = Math.max(merged.rows.expense, item.rows.expense)
      return
    }
    const itemTotal = item.total > 0 ? item.total : calculatedTotal
    const mergedRowCount = merged.rows.fuel + merged.rows.service + merged.rows.expense
    const itemRowCount = item.rows.fuel + item.rows.service + item.rows.expense
    const shouldReplace =
      merged.total <= 0 ||
      itemTotal > merged.total ||
      (Math.abs(itemTotal - merged.total) < 0.01 && itemRowCount > mergedRowCount)

    if (shouldReplace) {
      merged.fuel = item.fuel
      merged.service = item.service
      merged.expense = item.expense
      merged.total = itemTotal
      merged.imported = item.imported
      merged.garageBase = item.garageBase > 0 ? item.garageBase : (itemTotal > 0 ? itemTotal - item.imported : 0)
    }
    merged.rows.fuel = Math.max(merged.rows.fuel, item.rows.fuel)
    merged.rows.service = Math.max(merged.rows.service, item.rows.service)
    merged.rows.expense = Math.max(merged.rows.expense, item.rows.expense)
  })
  if (merged.total <= 0) merged.total = merged.fuel + merged.service + merged.expense
  if (merged.garageBase <= 0 && merged.total > 0) {
    const ownCost = merged.total - merged.imported
    merged.garageBase = ownCost > 0 ? ownCost : 0
  }
  return merged
}

const costSummaryFromStats = (stats: any) => {
  const fuel = numericValue(stats?.costs?.fuel)
  const service = numericValue(stats?.costs?.service)
  const expense = numericValue(stats?.costs?.expense)
  const calculatedTotal = fuel + service + expense
  const reportedTotal = numericValue(stats?.costs?.total)
  const total = calculatedTotal > 0 ? calculatedTotal : reportedTotal
  const imported = numericValue(stats?.costs?.imported)
  const reportedGarageBase = numericValue(stats?.costs?.garageBase)
  const calculatedGarageBase = total > 0 ? total - imported : 0
  const garageBase = reportedGarageBase > 0 ? reportedGarageBase : (calculatedGarageBase > 0 ? calculatedGarageBase : 0)

  return {
    fuel,
    service,
    expense,
    total,
    imported,
    garageBase,
    rows: {
      fuel: numericValue(stats?.rows?.fuel),
      service: numericValue(stats?.rows?.service),
      expense: numericValue(stats?.rows?.expense),
    },
  }
}

const safeBuildCostSummary = (fuelRows: any[] = [], serviceRows: any[] = [], expenseRows: any[] = [], stats?: any) => {
  try {
    return buildSharedCostSummary(fuelRows, serviceRows, expenseRows, stats)
  } catch (error) {
    console.warn('[GarageBase costs] summary fallback used', error)
    const fallbackStats = statsHasData(stats) || statsHasRealValues(stats)
      ? stats
      : buildRowStatsFromRows(fuelRows, serviceRows, expenseRows)
    const fuel = numericValue(fallbackStats?.costs?.fuel)
    const service = numericValue(fallbackStats?.costs?.service)
    const expense = numericValue(fallbackStats?.costs?.expense)
    const total = fuel + service + expense
    const imported = numericValue(fallbackStats?.costs?.imported)
    return {
      fuel,
      service,
      expense,
      total: Math.max(total, numericValue(fallbackStats?.costs?.total)),
      imported,
      garageBase: Math.max(0, numericValue(fallbackStats?.costs?.garageBase) || total - imported),
      rows: {
        fuel: numericValue(fallbackStats?.rows?.fuel) || fuelRows.length,
        service: numericValue(fallbackStats?.rows?.service) || serviceRows.length,
        expense: numericValue(fallbackStats?.rows?.expense) || expenseRows.length,
      },
    }
  }
}

const writeVehicleStatsCache = (carId: string, stats: any) => {
  try {
    const existingRaw = localStorage.getItem(`garagebase_vehicle_stats_${carId}`)
    const existing = existingRaw ? JSON.parse(existingRaw) : null
    const incomingCosts = stats?.costs || {}
    const incomingRows =
      numericValue(stats?.rows?.fuel) +
      numericValue(stats?.rows?.service) +
      numericValue(stats?.rows?.expense)
    const incomingTotal =
      numericValue(incomingCosts?.total) ||
      numericValue(incomingCosts?.fuel) +
      numericValue(incomingCosts?.service) +
      numericValue(incomingCosts?.expense)
    const hasIncomingCosts = incomingRows > 0 || incomingTotal > 0 || numericValue(stats?.liters) > 0
    const costs = hasIncomingCosts ? incomingCosts : existing?.costs || {}
    const rows = hasIncomingCosts ? stats?.rows : existing?.rows
    const consumption = hasConsumptionValues(stats?.consumption)
      ? stats.consumption
      : existing?.consumption || {}

    localStorage.setItem(`garagebase_vehicle_stats_${carId}`, JSON.stringify({
      fuelCost: hasIncomingCosts ? numericValue(costs?.fuel) : numericValue(existing?.fuelCost),
      serviceCost: hasIncomingCosts ? numericValue(costs?.service) : numericValue(existing?.serviceCost),
      expenseCost: hasIncomingCosts ? numericValue(costs?.expense) : numericValue(existing?.expenseCost),
      fuelLiters: hasIncomingCosts ? numericValue(stats?.liters) : numericValue(existing?.fuelLiters),
      fuelRows: hasIncomingCosts ? numericValue(rows?.fuel) : numericValue(existing?.fuelRows),
      rows,
      liters: hasIncomingCosts ? numericValue(stats?.liters) : numericValue(existing?.liters),
      costs,
      consumption,
      savedAt: Date.now(),
    }))
  } catch (error) {
    console.warn('[GarageBase costs] vehicle stats cache skipped', error)
  }
}

const writeCostTotalsCache = (carId: string, stats: any) => {
  try {
    localStorage.setItem(`garagebase_cost_totals_${carId}`, JSON.stringify({
      fuelCost: numericValue(stats?.costs?.fuel),
      serviceCost: numericValue(stats?.costs?.service),
      expenseCost: numericValue(stats?.costs?.expense),
      garageBaseFuelCost: numericValue(stats?.costs?.garageBase),
      importedFuelCost: numericValue(stats?.costs?.imported),
      totalCost: numericValue(stats?.costs?.total),
      fuelLiters: numericValue(stats?.liters),
      fuelRows: numericValue(stats?.rows?.fuel),
      serviceRows: numericValue(stats?.rows?.service),
      expenseRows: numericValue(stats?.rows?.expense),
      savedAt: Date.now(),
    }))
  } catch (error) {
    console.warn('[GarageBase costs] totals cache skipped', error)
  }
}

export default function Stroski() {
  const router = useRouter()
  const { language } = useLanguage()
  const tx = (sl: string, en: string) => (language === 'en' ? en : sl)
  const [activeCarId, setActiveCarId] = useState<string | null>(null)
  const [avto, setAvto] = useState<any>(null)
  const [gorivo, setGorivo] = useState<any[]>([])
  const [servisi, setServisi] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'vse' | 'gorivo' | 'servis' | 'ostalo'>('vse')
  const [grafTip, setGrafTip] = useState<'stolpci' | 'crta' | 'kolac' | 'kategorije'>('stolpci')
  const [grafObdobje, setGrafObdobje] = useState<'6m' | '12m'>('6m')
  const [uredi, setUredi] = useState<string | null>(null)
  const [editData, setEditData] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [cas, setCas] = useState(Date.now())
  const [valuta, setValuta] = useState<GarageBaseCurrency>('EUR')
  const [enotaRazdalje, setEnotaRazdalje] = useState<DistanceUnit>('km')
  const [includeVehiclePrice, setIncludeVehiclePrice] = useState(false)
  const [visibleCostCount, setVisibleCostCount] = useState(COST_LIST_SIZE)
  const [refreshing, setRefreshing] = useState(false)
  const [serverStats, setServerStats] = useState<any>(null)
  const [rowStats, setRowStats] = useState<any>(null)
  const [displayStats, setDisplayStats] = useState<any>(null)
  const [debugSource, setDebugSource] = useState('')
  const [loadedRows, setLoadedRows] = useState<{ gorivo: any[]; servisi: any[]; expenses: any[]; ready: boolean }>({
    gorivo: [],
    servisi: [],
    expenses: [],
    ready: false,
  })
  const [loadedSummary, setLoadedSummary] = useState(() => emptyCostSummary())
  const [directCostSummary, setDirectCostSummary] = useState(() => emptyCostSummary())
  const [rowCostSummary, setRowCostSummary] = useState(() => emptyCostSummary())
  const [committedSummary, setCommittedSummary] = useState(() => emptyCostSummary())
  const [costSnapshot, setCostSnapshot] = useState(() => ({
    gorivo: [] as any[],
    servisi: [] as any[],
    expenses: [] as any[],
    summary: emptyCostSummary(),
    debug: '',
    ready: false,
  }))
  const latestRowsRef = useRef<{ gorivo: any[]; servisi: any[]; expenses: any[] }>({
    gorivo: [],
    servisi: [],
    expenses: [],
  })
  const latestStatsRef = useRef<any>(null)
  const latestSummaryRef = useRef<ReturnType<typeof buildSharedCostSummary> | null>(null)
  const latestRowCostSummaryRef = useRef(emptyCostSummary())
  const committedSummaryRef = useRef(emptyCostSummary())
  const activeLoadRef = useRef('')

  const applyCommittedSummary = (summary: ReturnType<typeof emptyCostSummary>) => {
    committedSummaryRef.current = summary
    setCommittedSummary(summary)
    return summary
  }

  const resetVehicleState = (carId: string) => {
    activeLoadRef.current = carId
    latestRowsRef.current = { gorivo: [], servisi: [], expenses: [] }
    latestStatsRef.current = null
    latestSummaryRef.current = null
    latestRowCostSummaryRef.current = emptyCostSummary()
    committedSummaryRef.current = emptyCostSummary()
    setGorivo([])
    setServisi([])
    setExpenses([])
    setLoadedRows({ gorivo: [], servisi: [], expenses: [], ready: false })
    setLoadedSummary(emptyCostSummary())
    setDirectCostSummary(emptyCostSummary())
    setRowCostSummary(emptyCostSummary())
    setCommittedSummary(emptyCostSummary())
    setCostSnapshot({ gorivo: [], servisi: [], expenses: [], summary: emptyCostSummary(), debug: '', ready: false })
    setServerStats(null)
    setRowStats(null)
    setDisplayStats(null)
    setIncludeVehiclePrice(false)
    setDebugSource('')
  }

  useEffect(() => {
    const init = async () => {
      ensureVehicleStatsCacheVersion(VEHICLE_STATS_CACHE_VERSION)
      setValuta(getCurrencyFromSettings())
      setEnotaRazdalje(getDistanceUnitFromSettings())
      const params = new URLSearchParams(window.location.search)
      const carId = params.get('car')
      if (!carId) { window.location.href = '/stroski-garaza'; return }
      resetVehicleState(carId)
      setActiveCarId(carId)

      const parsedGarage = readGarageCache()
      if (parsedGarage) {
        const cachedCar = parsedGarage.avti?.find((a: any) => a.id === carId)
        if (cachedCar) {
          setAvto(cachedCar)
          setLoading(false)
        }
      }

      const cached = readCostCache(carId)
      if (cached) {
        const cachedRowStats = buildRowStatsFromRows(cached.gorivo, cached.servisi, cached.expenses)
        const cachedRowSummary = costSummaryFromStats(cachedRowStats)
        const cachedSummary = mergeCostSummaries(
          cachedRowSummary,
          safeBuildCostSummary(cached.gorivo, cached.servisi, cached.expenses, cached.serverStats)
        )
        latestRowsRef.current = { gorivo: cached.gorivo, servisi: cached.servisi, expenses: cached.expenses }
        latestSummaryRef.current = cachedSummary
        latestRowCostSummaryRef.current = cachedRowSummary
        setGorivo(cached.gorivo)
        setServisi(cached.servisi)
        setExpenses(cached.expenses)
        setLoadedRows({ gorivo: cached.gorivo, servisi: cached.servisi, expenses: cached.expenses, ready: true })
        setLoadedSummary(cachedSummary)
        setDirectCostSummary(cachedSummary)
        setRowCostSummary(cachedRowSummary)
        applyCommittedSummary(cachedSummary)
        if (statsHasData(cachedRowStats) || statsHasRealValues(cachedRowStats)) setRowStats(cachedRowStats)
        if (statsHasRealValues(cached.serverStats)) setServerStats(cached.serverStats)
        const cachedStats = firstUsableStats(cached.serverStats, readVehicleStatsCache(carId), cachedRowStats)
        if (cachedStats) {
          latestStatsRef.current = cachedStats
          setDisplayStats(cachedStats)
        }
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/'; return }
      await naloziStroske(carId)
    }
    init()
    const timer = setInterval(() => setCas(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const naloziStroske = async (carId: string) => {
      activeLoadRef.current = carId
      const shouldApply = () => activeLoadRef.current === carId
      setRefreshing(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { window.location.href = '/'; return }
        let [avtoRes, gorivoRes, servisRes, expensesRes]: any[] = await Promise.all([
          supabase.from('cars').select('*').eq('id', carId).eq('user_id', user.id).maybeSingle(),
          supabase.from('fuel_logs').select(fuelCostColumns, { count: 'exact' }).eq('car_id', carId).order('km', { ascending: false }).range(0, 999),
          supabase.from('service_logs').select(serviceCostColumns, { count: 'exact' }).eq('car_id', carId).order('datum', { ascending: false }).range(0, 999),
          supabase.from('expenses').select(expenseCostColumns, { count: 'exact' }).eq('car_id', carId).order('datum', { ascending: false }).range(0, 999),
        ])
        if (gorivoRes.error) {
          console.warn('[GarageBase costs] fuel full select failed, retrying minimal columns', gorivoRes.error.message)
          gorivoRes = await supabase.from('fuel_logs').select('id,car_id,datum,km,litri,cena_na_liter,cena_skupaj,postaja,created_at,import_batch_id,source_owner_label,polni_rezervar', { count: 'exact' }).eq('car_id', carId).order('km', { ascending: false }).range(0, 999)
        }
        if (servisRes.error) {
          console.warn('[GarageBase costs] service full select failed, retrying minimal columns', servisRes.error.message)
          servisRes = await supabase.from('service_logs').select('id,car_id,datum,km,cena,servis,opis,created_at,import_batch_id,source_owner_label', { count: 'exact' }).eq('car_id', carId).order('datum', { ascending: false }).range(0, 999)
        }
        if (expensesRes.error) {
          console.warn('[GarageBase costs] expenses full select failed, retrying minimal columns', expensesRes.error.message)
          expensesRes = await supabase.from('expenses').select('id,car_id,datum,znesek,kategorija,opis,created_at,import_batch_id,source_owner_label', { count: 'exact' }).eq('car_id', carId).order('datum', { ascending: false }).range(0, 999)
        }
        const dataError = gorivoRes.error || servisRes.error || expensesRes.error
        if (dataError) throw dataError
      if (!shouldApply()) return
      if (!avtoRes.data) { window.location.href = '/garaza'; return }
      setActiveCarId(carId)
      if (avtoRes.data) {
        setAvto(avtoRes.data)
        setIncludeVehiclePrice(avtoRes.data.include_vehicle_price_in_costs === true)
      } else {
        setAvto((prev: any) => prev || { id: carId })
      }
      let gorivoData = gorivoRes.data || []
      let servisData = servisRes.data || []
      let expensesData = (expensesRes.data || []).filter((e: any) => e.kategorija !== 'km_sprememba')
      let nextDebugSource = [
        `q:${gorivoRes.count ?? gorivoData.length}/${servisRes.count ?? servisData.length}/${expensesRes.count ?? expensesData.length}`,
        `loaded:${gorivoData.length}/${servisData.length}/${expensesData.length}`,
        gorivoRes.error?.message || servisRes.error?.message || expensesRes.error?.message || 'ok',
      ].join(' · ')
      if (gorivoData.length === 0 && servisData.length === 0 && expensesData.length === 0) {
        try {
          const cached = readCostCache(carId)
          if (cached) {
            gorivoData = cached.gorivo
            servisData = cached.servisi
            expensesData = cached.expenses
          }
        } catch {}
      }
      const carForStats = avtoRes.data || avto || {}
      const rowOnlyStats = buildRowStatsFromRows(gorivoData, servisData, expensesData, carForStats)
      const rowOnlySummary = costSummaryFromStats(rowOnlyStats)
      const initialSummary = mergeCostSummaries(
        rowOnlySummary,
        safeBuildCostSummary(gorivoData, servisData, expensesData, rowOnlyStats)
      )
      latestRowsRef.current = { gorivo: gorivoData, servisi: servisData, expenses: expensesData }
      latestStatsRef.current = rowOnlyStats
      latestSummaryRef.current = initialSummary
      latestRowCostSummaryRef.current = rowOnlySummary
      setGorivo(gorivoData)
      setServisi(servisData)
      setExpenses(expensesData)
      setLoadedRows({ gorivo: gorivoData, servisi: servisData, expenses: expensesData, ready: true })
      setLoadedSummary(initialSummary)
      setDirectCostSummary(initialSummary)
      setRowCostSummary(rowOnlySummary)
      applyCommittedSummary(initialSummary)
      setRowStats(rowOnlyStats)
      setDisplayStats(rowOnlyStats)
      nextDebugSource = `${nextDebugSource} | applied:${gorivoData.length}/${servisData.length}/${expensesData.length} row:${numericValue(rowOnlyStats.costs?.fuel).toFixed(0)}/${numericValue(rowOnlyStats.costs?.service).toFixed(0)}/${numericValue(rowOnlyStats.costs?.expense).toFixed(0)}`
      setDebugSource(nextDebugSource)
      setCostSnapshot({
        gorivo: gorivoData,
        servisi: servisData,
        expenses: expensesData,
        summary: initialSummary,
        debug: nextDebugSource,
        ready: true,
      })
      let immediateStats: any = rowOnlyStats
      let immediateSummary = initialSummary
      try {
        immediateStats = buildVehicleStats(gorivoData, servisData, expensesData, carForStats)
        latestStatsRef.current = immediateStats
        setRowStats(immediateStats)
        setDisplayStats(immediateStats)
        writeVehicleStatsCache(carId, immediateStats)
        writeCostTotalsCache(carId, immediateStats)
        const immediateRowSummary = costSummaryFromStats(immediateStats)
        latestRowCostSummaryRef.current = mergeCostSummaries(latestRowCostSummaryRef.current, immediateRowSummary)
        setRowCostSummary(latestRowCostSummaryRef.current)
        immediateSummary = mergeCostSummaries(
          latestRowCostSummaryRef.current,
          safeBuildCostSummary(gorivoData, servisData, expensesData, immediateStats)
        )
        latestSummaryRef.current = immediateSummary
        setLoadedSummary(immediateSummary)
        setDirectCostSummary(immediateSummary)
        applyCommittedSummary(immediateSummary)
        setCostSnapshot({
          gorivo: gorivoData,
          servisi: servisData,
          expenses: expensesData,
          summary: immediateSummary,
          debug: nextDebugSource,
          ready: true,
        })
      } catch (error) {
        nextDebugSource = `${nextDebugSource} | local-stats-error`
        setDebugSource(nextDebugSource)
        console.warn('[GarageBase costs] local statistics failed', error)
      }
      try {
        localStorage.setItem(`garagebase_stroski_cache_${carId}`, JSON.stringify({ gorivo: gorivoData, servisi: servisData, expenses: expensesData, fullCosts: true, savedAt: Date.now() }))
      } catch (error) {
        console.warn('[GarageBase costs] early cache write skipped', error)
      }
      let nextServerStats = null
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (token) {
        try {
          const response = await fetch(`/api/vehicle-stats?car=${encodeURIComponent(carId)}`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
          })
          const payload = await response.json()
          if (!shouldApply()) return
          if (response.ok && payload?.ok && payload?.stats && statsHasRealValues(payload.stats)) {
            nextServerStats = payload.stats
            latestStatsRef.current = nextServerStats
            setServerStats(nextServerStats)
            setDisplayStats(nextServerStats)
            nextDebugSource = `${nextDebugSource} | ${apiDebugText(payload)}`
          } else if (response.ok && payload?.ok && payload?.stats && statsHasData(payload.stats)) {
            nextDebugSource = `${nextDebugSource} | ${apiDebugText(payload)} rows-only`
          } else {
            nextDebugSource = `${nextDebugSource} | ${payload?.debug ? `${apiDebugText(payload)} empty` : `api-empty:${payload?.error || 'no-values'}`}`
            console.warn('[GarageBase costs] server statistics failed', payload?.error)
          }
        } catch (error) {
          nextDebugSource = `${nextDebugSource} | api-error`
          console.warn('[GarageBase costs] server statistics unavailable', error)
        }
      }
      if (!shouldApply()) return
      if (!nextServerStats) setServerStats(null)
      setDebugSource(nextDebugSource)
      const statsForSummary = firstUsableStats(immediateStats, nextServerStats, rowOnlyStats)
      if (statsHasData(statsForSummary) || statsHasRealValues(statsForSummary)) {
        latestStatsRef.current = statsForSummary
        setDisplayStats(statsForSummary)
      }
      const nextSummary = mergeCostSummaries(
        latestRowCostSummaryRef.current,
        safeBuildCostSummary(gorivoData, servisData, expensesData, statsForSummary)
      )
      latestSummaryRef.current = nextSummary
      setLoadedSummary(nextSummary)
      setDirectCostSummary(nextSummary)
      applyCommittedSummary(nextSummary)
      setCostSnapshot({
        gorivo: gorivoData,
        servisi: servisData,
        expenses: expensesData,
        summary: nextSummary,
        debug: nextDebugSource,
        ready: true,
      })
      const hasLocalRows = gorivoData.length > 0 || servisData.length > 0 || expensesData.length > 0
      try {
        localStorage.setItem(`garagebase_stroski_cache_${carId}`, JSON.stringify({ gorivo: gorivoData, servisi: servisData, expenses: expensesData, serverStats: nextServerStats, fullCosts: true, savedAt: Date.now() }))
      } catch (error) {
        console.warn('[GarageBase costs] cache write skipped', error)
      }
      writeVehicleStatsCache(carId, hasLocalRows && immediateStats ? immediateStats : statsForSummary)
      writeCostTotalsCache(carId, hasLocalRows && immediateStats ? immediateStats : statsForSummary)
      } catch (error) {
        console.warn('[GarageBase costs] load failed', error)
        setDebugSource((prev) => `${prev || 'load'} | load-error`)
      } finally {
      if (shouldApply()) {
        setLoading(false)
        setRefreshing(false)
      }
      }
  }

  useEffect(() => {
    setVisibleCostCount(COST_LIST_SIZE)
  }, [filter])
  const preostaliCas = (createdAt: string) => {
    const ustvarjen = new Date(createdAt).getTime()
    const konec = ustvarjen + 24 * 60 * 60 * 1000
    const preostalo = konec - cas
    if (preostalo <= 0) return null
    const ure = Math.floor(preostalo / (1000 * 60 * 60))
    const minute = Math.floor((preostalo % (1000 * 60 * 60)) / (1000 * 60))
    const sekunde = Math.floor((preostalo % (1000 * 60)) / 1000)
    return `${ure}:${String(minute).padStart(2, '0')}:${String(sekunde).padStart(2, '0')}`
  }

  const currentCarId = activeCarId || avto?.id
  const renderCache = currentCarId ? readCostCache(currentCarId) : null
  const fuelHistoryRows = currentCarId ? readFuelHistoryCache(currentCarId) : []
  const firstRows = (...sets: any[][]) => sets.find((set) => Array.isArray(set) && set.length > 0) || []
  const refRows = latestRowsRef.current
  const displayGorivo = firstRows(gorivo, loadedRows.gorivo, costSnapshot.gorivo, refRows.gorivo, renderCache?.gorivo || [], fuelHistoryRows)
  const displayServisi = firstRows(servisi, loadedRows.servisi, costSnapshot.servisi, refRows.servisi, renderCache?.servisi || [])
  const displayExpenses = firstRows(expenses, loadedRows.expenses, costSnapshot.expenses, refRows.expenses, renderCache?.expenses || [])
  const cachedVehicleStats = currentCarId ? readVehicleStatsCache(currentCarId) : null
  const hasRowCosts = displayGorivo.length > 0 || displayServisi.length > 0 || displayExpenses.length > 0
  const rowsDerivedStats = hasRowCosts
    ? buildRowStatsFromRows(displayGorivo, displayServisi, displayExpenses, avto || {})
    : null
  const refStats = latestStatsRef.current
  const refSummary = latestSummaryRef.current
  const localStateStats = loadedRows.ready && !hasRowCosts ? null : rowStats
  const displayStateStats = loadedRows.ready && !hasRowCosts ? null : displayStats
  const refStatsForDisplay = loadedRows.ready && !hasRowCosts ? null : refStats
  const serverStatsForDisplay = loadedRows.ready && !hasRowCosts ? null : serverStats
  const statsForDisplay = firstUsableStats(rowsDerivedStats, localStateStats, displayStateStats, refStatsForDisplay, serverStatsForDisplay, cachedVehicleStats)

  const allCostRows = [
    ...displayGorivo.map(v => ({ ...v, _tip: 'gorivo' })),
    ...displayServisi.map(v => ({ ...v, _tip: 'servis' })),
    ...displayExpenses.map(v => ({ ...v, _tip: 'ostalo' })),
  ].sort((a, b) => new Date(b.datum).getTime() - new Date(a.datum).getTime())
  const rowFuelTotal = displayGorivo.reduce((sum, row) => sum + fuelCostValue(row), 0)
  const rowServiceTotal = displayServisi.reduce((sum, row) => sum + numericValue(row?.cena), 0)
  const rowExpenseTotal = displayExpenses.reduce((sum, row) => sum + numericValue(row?.znesek), 0)
  const rowTotal = rowFuelTotal + rowServiceTotal + rowExpenseTotal
  const rowSourceSplit = splitRowsBySource(allCostRows)
  const rowImportedTotal = rowSourceSplit.imported.reduce((sum, row) => sum + costValueFor(row), 0)
  const rowGarageBaseTotal = Math.max(0, rowTotal - rowImportedTotal)
  const rowManualSummary = {
    fuel: rowFuelTotal,
    service: rowServiceTotal,
    expense: rowExpenseTotal,
    total: rowTotal,
    imported: rowImportedTotal,
    garageBase: rowGarageBaseTotal,
    rows: {
      fuel: displayGorivo.length,
      service: displayServisi.length,
      expense: displayExpenses.length,
    },
  }
  const liveCostSummary = safeBuildCostSummary(displayGorivo, displayServisi, displayExpenses, statsForDisplay)
  const statsRowSummary = costSummaryFromStats(statsForDisplay)
  const fallbackSummary = mergeCostSummaries(
    statsRowSummary,
    liveCostSummary,
    loadedSummary,
    directCostSummary,
    costSnapshot.summary,
    refSummary,
    committedSummary,
  )
  const renderSummary = hasRowCosts ? rowManualSummary : fallbackSummary
  const skupajGorivo = renderSummary.fuel
  const skupajServis = renderSummary.service
  const skupajExpenses = renderSummary.expense
  const skupajVse = renderSummary.total || skupajGorivo + skupajServis + skupajExpenses
  const skupajUvoz = renderSummary.imported
  const skupajGarageBase = renderSummary.garageBase || Math.max(0, skupajVse - skupajUvoz)
  const ownershipCost = vehicleOwnershipCostValue(avto)
  const skupajZLastnistvom = skupajVse + ownershipCost
  const purchasePrice = numericValue(avto?.purchase_price)
  const downPayment = numericValue(avto?.down_payment)
  const financeTotalPaid = numericValue(avto?.finance_total_paid)
  const financeOverpayment = numericValue(avto?.finance_overpayment)
  const resaleValue = numericValue(avto?.resale_value)
  const ownershipBase = financeTotalPaid > 0 ? downPayment + financeTotalPaid : purchasePrice + financeOverpayment
  const stGorivo = renderSummary.rows.fuel
  const stServis = renderSummary.rows.service
  const stOstalo = renderSummary.rows.expense
  const kmPrevozeni = costDistanceFromFuelRows(displayGorivo, avto || {})
  const strosekNaKm = kmPrevozeni > 0 && skupajGarageBase > 0 ? (skupajGarageBase / kmPrevozeni).toFixed(3) : null
  const znakValute = currencySymbol(valuta)

  const kategorijaIkona: { [key: string]: string } = {
    registracija: '📋', vinjeta: '🛣️', zavarovanje: '🛡️', gume: '⚫',
    tehnicni: '🔍', izredno: '🔨', lizing: '🏦'
  }

  const grafMeseci = () => {
    const meseci: { kljuc: string, label: string, gorivo: number, servis: number, ostalo: number }[] = []
    const datumi = [
      ...displayGorivo.map((v) => v?.datum || v?.created_at),
      ...displayServisi.map((v) => v?.datum || v?.created_at),
      ...displayExpenses.map((v) => v?.datum || v?.created_at),
    ]
      .map((value) => new Date(value || '').getTime())
      .filter((value) => Number.isFinite(value))
    const danes = datumi.length > 0 ? new Date(Math.max(...datumi)) : new Date()
    const stMesecev = grafObdobje === '12m' ? 12 : 6
    for (let i = stMesecev - 1; i >= 0; i--) {
      const d = new Date(danes.getFullYear(), danes.getMonth() - i, 1)
      const kljuc = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      meseci.push({ kljuc, label: d.toLocaleDateString(language === 'en' ? 'en-US' : 'sl-SI', { month: 'short' }), gorivo: 0, servis: 0, ostalo: 0 })
    }
    displayGorivo.forEach(v => { const value = fuelCostValue(v); if (!v.datum || !value) return; const m = meseci.find(m => m.kljuc === v.datum.substring(0, 7)); if (m) m.gorivo += value })
    displayServisi.forEach(v => { if (!v.datum || !numericValue(v.cena)) return; const m = meseci.find(m => m.kljuc === v.datum.substring(0, 7)); if (m) m.servis += numericValue(v.cena) })
    displayExpenses.forEach(v => { if (!v.datum || !numericValue(v.znesek)) return; const m = meseci.find(m => m.kljuc === v.datum.substring(0, 7)); if (m) m.ostalo += numericValue(v.znesek) })
    return meseci
  }

  const meseci = grafMeseci()
  const graphTotals = meseci.reduce((totals, mesec) => {
    totals.gorivo += mesec.gorivo
    totals.servis += mesec.servis
    totals.ostalo += mesec.ostalo
    return totals
  }, { gorivo: 0, servis: 0, ostalo: 0 })
  const prikazGorivo = skupajGorivo
  const prikazServis = skupajServis
  const prikazExpenses = skupajExpenses
  const prikazSkupaj = includeVehiclePrice ? skupajZLastnistvom : skupajVse
  const prikazGarageBase = skupajGarageBase
  const prikazUvoz = skupajUvoz
  const prikazStGorivo = stGorivo
  const prikazStServis = stServis
  const prikazStOstalo = stOstalo
  const prikazStrosekNaKm = kmPrevozeni > 0 && prikazSkupaj > 0 ? (prikazSkupaj / kmPrevozeni).toFixed(3) : strosekNaKm
  const operatingPerKm = kmPrevozeni > 0 && skupajVse > 0 ? (skupajVse / kmPrevozeni).toFixed(3) : null
  const garageBasePerKm = kmPrevozeni > 0 && skupajGarageBase > 0 ? (skupajGarageBase / kmPrevozeni).toFixed(3) : null
  const ownershipOnlyPerKm = kmPrevozeni > 0 && ownershipCost > 0 ? (ownershipCost / kmPrevozeni).toFixed(3) : null
  const totalOwnershipPerKm = kmPrevozeni > 0 && skupajZLastnistvom > 0 ? (skupajZLastnistvom / kmPrevozeni).toFixed(3) : null
  const maxVrednost = Math.max(...meseci.map(m => m.gorivo + m.servis + m.ostalo), 1)
  const maxKategorija = Math.max(...meseci.flatMap(m => [m.gorivo, m.servis, m.ostalo]), 1)
  const compactMoney = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(value >= 10000000 ? 0 : 1)}M${znakValute}`
    if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k${znakValute}`
    return `${value.toFixed(0)}${znakValute}`
  }
  const chartTicks = (max: number) => [max, max / 2, 0]
  const chartColors = {
    gorivo: '#35c6c3',
    servis: '#f2a13a',
    ostalo: '#7467f3',
    grid: '#263049',
  }

  const GrafStolpci = () => (
    <div className="grid min-w-0 grid-cols-[38px_minmax(0,1fr)] gap-2 sm:grid-cols-[44px_minmax(0,1fr)]">
      <div className="flex h-40 flex-col justify-between pb-8 pt-1 text-right">
        {chartTicks(maxVrednost).map((tick, i) => (
          <span key={i} className="text-[9px] font-semibold text-[#5a5a80]">{compactMoney(tick)}</span>
        ))}
      </div>
      <div className="relative h-40 min-w-0 overflow-hidden">
        <div className="absolute inset-x-0 top-1 bottom-8 flex flex-col justify-between pointer-events-none">
          {[0, 1, 2].map((line) => <div key={line} className="border-t border-[#1e1e32]" />)}
        </div>
        <div className="relative flex h-full min-w-0 items-end justify-between gap-0.5 px-0.5 sm:gap-1.5 sm:px-1">
          {meseci.map((m, i) => {
            const skupaj = m.gorivo + m.servis + m.ostalo
            const visina = skupaj > 0 ? (skupaj / maxVrednost) * 100 : 0
            const gorivoH = skupaj > 0 ? (m.gorivo / skupaj) * visina : 0
            const servisH = skupaj > 0 ? (m.servis / skupaj) * visina : 0
            const ostaloH = skupaj > 0 ? (m.ostalo / skupaj) * visina : 0
            return (
              <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                <div className="flex w-full justify-center" style={{ height: '118px' }} title={`${m.label}: ${formatMoney(skupaj, valuta)}`}>
                  {skupaj === 0 ? (
                    <div className="mt-auto h-1.5 w-3/4 rounded-full border border-[#6c63ff33] bg-[#6c63ff22] opacity-80" />
                  ) : (
                    <div className="mt-auto flex w-5 max-w-[82%] flex-col justify-end overflow-hidden rounded-b-md rounded-t-full border border-white/20 shadow-lg sm:w-8 md:w-10" style={{ height: `${Math.max(8, visina)}%` }}>
                      {ostaloH > 0 && <div style={{ height: `${(ostaloH / visina) * 100}%`, background: `linear-gradient(180deg, #968dff, ${chartColors.ostalo})` }} className="w-full" />}
                      {servisH > 0 && <div style={{ height: `${(servisH / visina) * 100}%`, background: `linear-gradient(180deg, #ffd59a, ${chartColors.servis})` }} className="w-full" />}
                      {gorivoH > 0 && <div style={{ height: `${(gorivoH / visina) * 100}%`, background: `linear-gradient(180deg, #8be8e3, ${chartColors.gorivo})` }} className="w-full" />}
                    </div>
                  )}
                </div>
                <p className="max-w-full truncate text-[8px] uppercase text-[#5a5a80] sm:text-[9px]">{m.label.replace('.', '')}</p>
                {skupaj > 0 && (grafObdobje === '6m' || i % 2 === 0) && <p className="text-[7px] font-bold text-white sm:text-[8px]">{compactMoney(skupaj)}</p>}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )

  const GrafCrta = () => {
    const w = 340, h = 140, padLeft = 46, padRight = 10, padTop = 16, padBottom = 28
    const chartW = w - padLeft - padRight
    const chartH = h - padTop - padBottom
    const tocke = meseci.map((m, i) => {
      const skupaj = m.gorivo + m.servis + m.ostalo
      const x = padLeft + (i / Math.max(meseci.length - 1, 1)) * chartW
      const y = padTop + chartH - (skupaj / maxVrednost) * chartH
      return { x, y, skupaj, label: m.label }
    })
    const path = tocke.map((t, i) => `${i === 0 ? 'M' : 'L'} ${t.x} ${t.y}`).join(' ')
    const fill = `${path} L ${tocke[tocke.length - 1].x} ${h - padBottom} L ${tocke[0].x} ${h - padBottom} Z`
    return (
      <div className="w-full">
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: '145px' }}>
          <defs><linearGradient id="gradCrta" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={chartColors.ostalo} stopOpacity="0.32" /><stop offset="100%" stopColor={chartColors.ostalo} stopOpacity="0" /></linearGradient></defs>
          {chartTicks(maxVrednost).map((tick, i) => {
            const y = padTop + (i / 2) * chartH
            return (
              <g key={i}>
                <line x1={padLeft} x2={w - padRight} y1={y} y2={y} stroke={chartColors.grid} strokeWidth="1" />
                <text x={padLeft - 6} y={y + 3} textAnchor="end" fill="#5a5a80" fontSize="8" fontWeight="700">{compactMoney(tick)}</text>
              </g>
            )
          })}
          <path d={fill} fill="url(#gradCrta)" />
          <path d={path} fill="none" stroke={chartColors.ostalo} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {tocke.map((t, i) => (
            <g key={i}>
              <text x={t.x} y={h - 7} textAnchor="middle" fill="#5a5a80" fontSize="8" fontWeight="700">{t.label}</text>
              <circle cx={t.x} cy={t.y} r="3" fill={chartColors.ostalo} />
              {t.skupaj > 0 && <text x={t.x} y={Math.max(8, t.y - 8)} textAnchor="middle" fill="white" fontSize="7" fontWeight="bold">{compactMoney(t.skupaj)}</text>}
            </g>
          ))}
        </svg>
      </div>
    )
  }

  const GrafKategorije = () => {
    const w = 340
    const h = 145
    const padLeft = 46
    const padRight = 10
    const padTop = 16
    const padBottom = 28
    const chartW = w - padLeft - padRight
    const chartH = h - padTop - padBottom
    const series = [
      { key: 'gorivo', label: tx('Gorivo', 'Fuel'), color: chartColors.gorivo },
      { key: 'servis', label: tx('Servis', 'Service'), color: chartColors.servis },
      { key: 'ostalo', label: tx('Ostalo', 'Other'), color: chartColors.ostalo },
    ] as const
    const pointsFor = (key: typeof series[number]['key']) => meseci.map((m, i) => {
      const x = padLeft + (i / Math.max(meseci.length - 1, 1)) * chartW
      const y = padTop + chartH - ((m[key] || 0) / maxKategorija) * chartH
      return { x, y, value: m[key] || 0 }
    })
    const pathFor = (key: typeof series[number]['key']) =>
      pointsFor(key).map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

    return (
      <div className="w-full">
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: '145px' }}>
          {chartTicks(maxKategorija).map((tick, i) => {
            const y = padTop + (i / 2) * chartH
            return (
              <g key={i}>
                <line x1={padLeft} x2={w - padRight} y1={y} y2={y} stroke={chartColors.grid} strokeWidth="1" />
                <text x={padLeft - 6} y={y + 3} textAnchor="end" fill="#5a5a80" fontSize="8" fontWeight="700">{compactMoney(tick)}</text>
              </g>
            )
          })}
          {series.map((s) => (
            <g key={s.key}>
              <path d={pathFor(s.key)} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              {pointsFor(s.key).map((p, i) => (
                p.value > 0 ? <circle key={i} cx={p.x} cy={p.y} r="3" fill={s.color} /> : null
              ))}
            </g>
          ))}
          {meseci.map((m, i) => {
            const x = padLeft + (i / Math.max(meseci.length - 1, 1)) * chartW
            return <text key={i} x={x} y={h - 7} textAnchor="middle" fill="#5a5a80" fontSize="8" fontWeight="700">{m.label}</text>
          })}
        </svg>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {series.map((s) => (
            <div key={s.key} className="rounded-xl border border-[#1e1e32] bg-[#13131f] px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                <p className="text-[#5a5a80] text-[10px] font-bold uppercase">{s.label}</p>
              </div>
              <p className="mt-1 text-xs font-bold text-white">{compactMoney(graphTotals[s.key])}</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const GrafKolac = () => {
    if (skupajVse === 0) return <div className="flex items-center justify-center h-36"><p className="text-[#5a5a80] text-sm">{tx('Ni podatkov', 'No data')}</p></div>
    const r = 45, cx = 60, cy = 60
    const segments = [
      { vrednost: skupajGorivo, barva: chartColors.gorivo, naziv: tx('Gorivo', 'Fuel') },
      { vrednost: skupajServis, barva: chartColors.servis, naziv: tx('Servis', 'Service') },
      { vrednost: skupajExpenses, barva: chartColors.ostalo, naziv: tx('Ostalo', 'Other') },
    ].filter(s => s.vrednost > 0)
    let kot = -90
    const poti = segments.map(s => {
      const delež = s.vrednost / skupajVse
      const kotKonec = kot + delež * 360
      const x1 = cx + r * Math.cos((kot * Math.PI) / 180), y1 = cy + r * Math.sin((kot * Math.PI) / 180)
      const x2 = cx + r * Math.cos((kotKonec * Math.PI) / 180), y2 = cy + r * Math.sin((kotKonec * Math.PI) / 180)
      const pot = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${delež > 0.5 ? 1 : 0} 1 ${x2} ${y2} Z`
      kot = kotKonec
      return { ...s, pot, delež }
    })
    return (
      <div className="flex items-center gap-4">
        <svg viewBox="0 0 120 120" style={{ width: '120px', height: '120px', flexShrink: 0 }}>
          {poti.map((p, i) => <path key={i} d={p.pot} fill={p.barva} stroke="#080810" strokeWidth="2" />)}
          <circle cx={cx} cy={cy} r="22" fill="#0f0f1a" />
          <text x={cx} y={cy - 4} textAnchor="middle" fill="white" fontSize="8" fontWeight="bold">{skupajVse.toFixed(0)}</text>
          <text x={cx} y={cy + 7} textAnchor="middle" fill="#5a5a80" fontSize="6">{valuta}</text>
        </svg>
        <div className="flex flex-col gap-2 flex-1">
          {poti.map((p, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.barva }} /><p className="text-[#5a5a80] text-xs">{p.naziv}</p></div>
              <div className="text-right"><p className="text-white text-xs font-bold">{p.vrednost.toFixed(0)} {znakValute}</p><p className="text-[#5a5a80] text-[9px]">{(p.delež * 100).toFixed(0)}%</p></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const shraniUrediGorivo = async (id: string) => {
    setSaving(true)
    const { error } = await supabase.from('fuel_logs').update({
      datum: editData.datum,
      litri: parseFloat(editData.litri),
      cena_na_liter: editData.cena_na_liter ? parseFloat(editData.cena_na_liter) : null,
      cena_skupaj: editData.litri && editData.cena_na_liter ? parseFloat(editData.litri) * parseFloat(editData.cena_na_liter) : null,
      postaja: editData.postaja || null,
    }).eq('id', id).eq('car_id', avto.id)
    if (error) {
      window.alert(isLockedRecordError(error)
        ? tx('Ta vnos je starejši od 24 ur in je zaščiten pred spremembami. Če je prišlo do napake, kontaktiraj podporo.', 'This entry is older than 24 hours and is protected from changes. If something is wrong, contact support.')
        : tx(`Shranjevanje ni uspelo: ${error.message}`, `Saving failed: ${error.message}`))
      setSaving(false)
      return
    }
    const { data } = await supabase.from('fuel_logs').select(fuelCostColumns).eq('car_id', avto.id).order('datum', { ascending: true })
    const nextGorivo = data || []
    const nextStats = buildRowStatsFromRows(nextGorivo, displayServisi, displayExpenses, avto || {})
    const nextRowSummary = costSummaryFromStats(nextStats)
    const nextSummary = mergeCostSummaries(nextRowSummary, safeBuildCostSummary(nextGorivo, displayServisi, displayExpenses, nextStats))
    latestRowsRef.current = { gorivo: nextGorivo, servisi: displayServisi, expenses: displayExpenses }
    latestStatsRef.current = nextStats
    latestRowCostSummaryRef.current = nextRowSummary
    latestSummaryRef.current = nextSummary
    setGorivo(nextGorivo)
    setLoadedRows(prev => ({ ...prev, gorivo: nextGorivo, ready: true }))
    setRowStats(nextStats)
    setDisplayStats(nextStats)
    setRowCostSummary(nextRowSummary)
    setLoadedSummary(nextSummary)
    setDirectCostSummary(nextSummary)
    applyCommittedSummary(nextSummary)
    setCostSnapshot({ gorivo: nextGorivo, servisi: displayServisi, expenses: displayExpenses, summary: nextSummary, debug: 'edited', ready: true })
    clearVehicleDataCaches(avto.id)
    writeVehicleStatsCache(avto.id, nextStats)
    writeCostTotalsCache(avto.id, nextStats)
    setUredi(null)
    setSaving(false)
  }

  const shraniUrediServis = async (id: string) => {
    setSaving(true)
    const { error } = await supabase.from('service_logs').update({
      datum: editData.datum,
      opis: editData.opis,
      servis: editData.servis || null,
      cena: editData.cena ? parseFloat(editData.cena) : null,
    }).eq('id', id).eq('car_id', avto.id)
    if (error) {
      window.alert(isLockedRecordError(error)
        ? tx('Ta vnos je starejši od 24 ur in je zaščiten pred spremembami. Če je prišlo do napake, kontaktiraj podporo.', 'This entry is older than 24 hours and is protected from changes. If something is wrong, contact support.')
        : tx(`Shranjevanje ni uspelo: ${error.message}`, `Saving failed: ${error.message}`))
      setSaving(false)
      return
    }
    const { data } = await supabase.from('service_logs').select(serviceCostColumns).eq('car_id', avto.id).order('datum', { ascending: true })
    const nextServisi = data || []
    const nextStats = buildRowStatsFromRows(displayGorivo, nextServisi, displayExpenses, avto || {})
    const nextRowSummary = costSummaryFromStats(nextStats)
    const nextSummary = mergeCostSummaries(nextRowSummary, safeBuildCostSummary(displayGorivo, nextServisi, displayExpenses, nextStats))
    latestRowsRef.current = { gorivo: displayGorivo, servisi: nextServisi, expenses: displayExpenses }
    latestStatsRef.current = nextStats
    latestRowCostSummaryRef.current = nextRowSummary
    latestSummaryRef.current = nextSummary
    setServisi(nextServisi)
    setLoadedRows(prev => ({ ...prev, servisi: nextServisi, ready: true }))
    setRowStats(nextStats)
    setDisplayStats(nextStats)
    setRowCostSummary(nextRowSummary)
    setLoadedSummary(nextSummary)
    setDirectCostSummary(nextSummary)
    applyCommittedSummary(nextSummary)
    setCostSnapshot({ gorivo: displayGorivo, servisi: nextServisi, expenses: displayExpenses, summary: nextSummary, debug: 'edited', ready: true })
    clearVehicleDataCaches(avto.id)
    writeVehicleStatsCache(avto.id, nextStats)
    writeCostTotalsCache(avto.id, nextStats)
    setUredi(null)
    setSaving(false)
  }

  const shraniUrediExpense = async (id: string) => {
    setSaving(true)
    const { error } = await supabase.from('expenses').update({
      datum: editData.datum,
      opis: editData.opis || null,
      znesek: editData.znesek ? parseFloat(editData.znesek) : null,
    }).eq('id', id).eq('car_id', avto.id)
    if (error) {
      window.alert(isLockedRecordError(error)
        ? tx('Ta vnos je starejši od 24 ur in je zaščiten pred spremembami. Če je prišlo do napake, kontaktiraj podporo.', 'This entry is older than 24 hours and is protected from changes. If something is wrong, contact support.')
        : tx(`Shranjevanje ni uspelo: ${error.message}`, `Saving failed: ${error.message}`))
      setSaving(false)
      return
    }
    const { data } = await supabase.from('expenses').select(expenseCostColumns).eq('car_id', avto.id).order('datum', { ascending: true })
    const nextExpenses = (data || []).filter((e: any) => e.kategorija !== 'km_sprememba')
    const nextStats = buildRowStatsFromRows(displayGorivo, displayServisi, nextExpenses, avto || {})
    const nextRowSummary = costSummaryFromStats(nextStats)
    const nextSummary = mergeCostSummaries(nextRowSummary, safeBuildCostSummary(displayGorivo, displayServisi, nextExpenses, nextStats))
    latestRowsRef.current = { gorivo: displayGorivo, servisi: displayServisi, expenses: nextExpenses }
    latestStatsRef.current = nextStats
    latestRowCostSummaryRef.current = nextRowSummary
    latestSummaryRef.current = nextSummary
    setExpenses(nextExpenses)
    setLoadedRows(prev => ({ ...prev, expenses: nextExpenses, ready: true }))
    setRowStats(nextStats)
    setDisplayStats(nextStats)
    setRowCostSummary(nextRowSummary)
    setLoadedSummary(nextSummary)
    setDirectCostSummary(nextSummary)
    applyCommittedSummary(nextSummary)
    setCostSnapshot({ gorivo: displayGorivo, servisi: displayServisi, expenses: nextExpenses, summary: nextSummary, debug: 'edited', ready: true })
    clearVehicleDataCaches(avto.id)
    writeVehicleStatsCache(avto.id, nextStats)
    writeCostTotalsCache(avto.id, nextStats)
    setUredi(null)
    setSaving(false)
  }

  const vsiVnosi = allCostRows
  const dashboardBackHref = currentCarId ? `/dashboard?car=${currentCarId}` : undefined
  const hasImportedCosts = prikazUvoz > 0

  const filtrirani = vsiVnosi.filter(v => filter === 'vse' || v._tip === filter)
  const vidniVnosi = filtrirani.slice(0, visibleCostCount)

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#080810] px-4 py-6 pb-24">
      <div className="mx-auto w-full max-w-6xl">

      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
        <BackButton href={dashboardBackHref} />
        <div>
          <h1 className="text-xl font-bold text-white">📊 {tx('Stroški', 'Costs')}</h1>
          {avto && <p className="text-[#5a5a80] text-xs">{avto.znamka} {avto.model}</p>}
        </div>
      </div>

        {avto?.id && (
          <button
            onClick={() => naloziStroske(avto.id)}
            disabled={refreshing}
            className="rounded-xl border border-[#2a2a40] bg-[#13131f] px-3 py-2 text-xs font-bold text-[#a09aff] disabled:opacity-50"
          >
            {refreshing ? tx('Osvezujem...', 'Refreshing...') : tx('Osvezi', 'Refresh')}
          </button>
        )}
      </div>

      <div className="mb-4 overflow-hidden rounded-3xl border border-[#2a2a40] bg-[#0f0f1a] p-4 shadow-2xl shadow-black/10 sm:p-5">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#a09aff]">{tx('Pregled izračuna', 'Calculation overview')}</p>
            <h2 className="mt-1 text-2xl font-black text-white">{tx('Obratovanje ali celotno lastništvo', 'Running costs or total ownership')}</h2>
            <p className="mt-1 text-sm font-semibold text-[#8a8aa8]">
              {tx('Primerjaj stroške brez cene avta in z nakupom, lizingom ali prodajno vrednostjo.', 'Compare costs without vehicle price and with purchase, finance or resale value.')}
            </p>
          </div>
          <div className="flex rounded-2xl border border-[#2a2a40] bg-[#13131f] p-1">
            <button type="button" onClick={() => setIncludeVehiclePrice(false)}
              className={`rounded-xl px-3 py-2 text-xs font-black transition-all ${!includeVehiclePrice ? 'bg-[#3ecfcf] text-[#051114]' : 'text-[#8a8aa8] hover:text-white'}`}>
              {tx('Brez cene avta', 'Without car price')}
            </button>
            <button type="button" onClick={() => setIncludeVehiclePrice(true)}
              className={`rounded-xl px-3 py-2 text-xs font-black transition-all ${includeVehiclePrice ? 'bg-[#6c63ff] text-white' : 'text-[#8a8aa8] hover:text-white'}`}>
              {tx('Z lastništvom', 'With ownership')}
            </button>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <button type="button" onClick={() => setIncludeVehiclePrice(false)}
            className={`min-w-0 rounded-2xl border p-4 text-left transition-all ${!includeVehiclePrice ? 'border-[#3ecfcf] bg-[#3ecfcf14] shadow-[inset_0_0_0_1px_rgba(62,207,207,0.24)]' : 'border-[#2a2a40] bg-[#13131f]'}`}>
            <p className="text-xs font-black uppercase tracking-wide text-[#3ecfcf]">{tx('Obratovalni stroški', 'Running costs')}</p>
            <p className="mt-2 break-words text-3xl font-black text-white">{formatMoney(skupajVse, valuta)}</p>
            <p className="mt-1 text-sm font-bold text-[#a8b0c0]">
              {operatingPerKm ? `${operatingPerKm} ${znakValute}/${enotaRazdalje}` : '-'}
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-xs font-bold">
              <div className="rounded-xl bg-[#0b1020] p-2"><p className="text-[#8a8aa8]">{tx('Gorivo', 'Fuel')}</p><p className="mt-1 text-white">{formatMoney(prikazGorivo, valuta)}</p></div>
              <div className="rounded-xl bg-[#0b1020] p-2"><p className="text-[#8a8aa8]">{tx('Servis', 'Service')}</p><p className="mt-1 text-white">{formatMoney(prikazServis, valuta)}</p></div>
              <div className="rounded-xl bg-[#0b1020] p-2"><p className="text-[#8a8aa8]">{tx('Ostalo', 'Other')}</p><p className="mt-1 text-white">{formatMoney(prikazExpenses, valuta)}</p></div>
            </div>
          </button>

          <div className="min-w-0 rounded-2xl border border-[#2a2a40] bg-[#13131f] p-4">
            <p className="text-xs font-black uppercase tracking-wide text-[#a09aff]">{tx('Vir stroškov', 'Cost source')}</p>
            <div className="mt-3 space-y-3">
              <div>
                <div className="flex items-center justify-between gap-3 text-sm font-bold">
                  <span className="text-[#c8c4ff]">{tx('GarageBase vnosi', 'GarageBase entries')}</span>
                  <span className="text-white">{formatMoney(prikazGarageBase, valuta)}</span>
                </div>
                <p className="mt-1 text-xs font-bold text-[#8a8aa8]">{garageBasePerKm ? `${garageBasePerKm} ${znakValute}/${enotaRazdalje}` : '-'}</p>
              </div>
              <div>
                <div className="flex items-center justify-between gap-3 text-sm font-bold">
                  <span className="text-[#86efac]">{tx('Uvožena zgodovina', 'Imported history')}</span>
                  <span className="text-white">{formatMoney(prikazUvoz, valuta)}</span>
                </div>
                <p className="mt-1 text-xs font-bold text-[#8a8aa8]">{tx('Ločeno od tvojih GarageBase vnosov.', 'Separate from your GarageBase entries.')}</p>
              </div>
              <div className="rounded-xl border border-[#6c63ff44] bg-[#6c63ff10] p-3">
                <p className="text-xs font-black uppercase tracking-wide text-[#a09aff]">{tx('Prevoženo v izračunu', 'Distance in calculation')}</p>
                <p className="mt-1 text-lg font-black text-white">{formatDistance(kmPrevozeni, enotaRazdalje)}</p>
              </div>
            </div>
          </div>

          <button type="button" onClick={() => setIncludeVehiclePrice(true)}
            className={`min-w-0 rounded-2xl border p-4 text-left transition-all ${includeVehiclePrice ? 'border-[#6c63ff] bg-[#6c63ff18] shadow-[inset_0_0_0_1px_rgba(108,99,255,0.26)]' : 'border-[#2a2a40] bg-[#13131f]'}`}>
            <p className="text-xs font-black uppercase tracking-wide text-[#a09aff]">{tx('Skupni strošek lastništva', 'Total ownership cost')}</p>
            <p className="mt-2 break-words text-3xl font-black text-white">{formatMoney(skupajZLastnistvom, valuta)}</p>
            <p className="mt-1 text-sm font-bold text-[#c8c4ff]">
              {totalOwnershipPerKm ? `${totalOwnershipPerKm} ${znakValute}/${enotaRazdalje}` : '-'}
            </p>
            <div className="mt-4 space-y-2 text-xs font-bold">
              <div className="flex justify-between gap-3 rounded-xl bg-[#0b1020] p-2"><span className="text-[#8a8aa8]">{tx('Obratovanje', 'Running')}</span><span className="text-white">{formatMoney(skupajVse, valuta)}</span></div>
              <div className="flex justify-between gap-3 rounded-xl bg-[#0b1020] p-2"><span className="text-[#8a8aa8]">{tx('Cena/lizing', 'Price/finance')}</span><span className="text-white">{formatMoney(ownershipBase, valuta)}</span></div>
              <div className="flex justify-between gap-3 rounded-xl bg-[#0b1020] p-2"><span className="text-[#8a8aa8]">{tx('Prodajna vrednost', 'Resale value')}</span><span className="text-[#86efac]">- {formatMoney(resaleValue, valuta)}</span></div>
              <div className="flex justify-between gap-3 rounded-xl border border-[#6c63ff44] bg-[#6c63ff10] p-2"><span className="text-[#c8c4ff]">{tx('Neto vozilo', 'Net vehicle')}</span><span className="text-white">{formatMoney(ownershipCost, valuta)}</span></div>
            </div>
            {ownershipOnlyPerKm && <p className="mt-3 text-xs font-bold text-[#8a8aa8]">{tx('Samo vozilo', 'Vehicle only')}: {ownershipOnlyPerKm} {znakValute}/{enotaRazdalje}</p>}
          </button>
        </div>
      </div>

      <div className="mb-4 max-w-full overflow-hidden rounded-3xl border border-[#6c63ff33] bg-[#0f0f1a] p-4 shadow-2xl shadow-black/10 sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2">{tx('Skupni stroški', 'Total costs')}</p>
            <p className="break-words text-2xl font-black leading-none text-white min-[390px]:text-3xl sm:text-4xl">{formatMoney(prikazSkupaj, valuta)}</p>
          </div>
          <button
            onClick={() => router.push(`/vnos-stroska?car=${avto?.id}`)}
            className="shrink-0 rounded-2xl bg-[#6c63ff] px-3 py-2.5 text-xs font-black text-white shadow-lg shadow-[#6c63ff33] sm:px-4 sm:py-3 sm:text-sm"
          >
            + {tx('Dodaj', 'Add')}
          </button>
        </div>
        {hasImportedCosts ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-center">
            <div className="min-w-0 rounded-2xl border border-[#22c55e44] bg-[#22c55e12] p-3 sm:p-4">
              <p className="text-[#22c55e] text-xs font-black uppercase tracking-wide">{tx('Uvoženi stroški', 'Imported costs')}</p>
              <p className="mt-2 break-words text-lg font-black text-[#22c55e] min-[390px]:text-xl sm:text-2xl">{formatMoney(prikazUvoz, valuta)}</p>
            </div>
            <div className="hidden h-10 w-10 items-center justify-center rounded-full border border-[#22c55e55] bg-[#22c55e18] text-xl font-black text-[#22c55e] md:flex">+</div>
            <div className="min-w-0 rounded-2xl border border-[#6c63ff44] bg-[#6c63ff12] p-3 sm:p-4">
              <p className="text-[#a09aff] text-xs font-black uppercase tracking-wide">{tx('GarageBase stroški', 'GarageBase costs')}</p>
              <p className="mt-2 break-words text-lg font-black text-[#a09aff] min-[390px]:text-xl sm:text-2xl">{formatMoney(prikazGarageBase, valuta)}</p>
            </div>
            <div className="hidden h-10 w-10 items-center justify-center rounded-full border border-[#6c63ff55] bg-[#6c63ff18] text-xl font-black text-[#a09aff] md:flex">=</div>
            <div className="min-w-0 rounded-2xl border border-[#d8d8e833] bg-[#ffffff08] p-3 sm:p-4">
              <p className="text-[#d8d8e8] text-xs font-black uppercase tracking-wide">{tx('Skupaj', 'Total')}</p>
              <p className="mt-2 break-words text-lg font-black text-white min-[390px]:text-xl sm:text-2xl">{formatMoney(prikazSkupaj, valuta)}</p>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-[#6c63ff33] bg-[#6c63ff10] p-4">
            <p className="text-[#a09aff] text-xs font-black uppercase tracking-wide">{tx('Skupni stroški', 'Total costs')}</p>
            <p className="mt-2 text-2xl font-black text-white">{formatMoney(prikazSkupaj, valuta)}</p>
          </div>
        )}
        {prikazStrosekNaKm && <p className="mt-4 text-[#5a5a80] text-sm">{prikazStrosekNaKm} {znakValute}/{enotaRazdalje} · {tx('skupaj po razponu zapisov', 'total across record range')} · {formatDistance(kmPrevozeni, enotaRazdalje)}</p>}
      </div>

      <div className="hidden">
        <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2">{tx('Skupni stroški', 'Total costs')}</p>
        <p className="text-white font-bold text-4xl mb-1">{formatMoney(prikazSkupaj, valuta)}</p>
        {hasImportedCosts && (
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="rounded-xl border border-[#6c63ff33] bg-[#6c63ff0d] p-3">
              <p className="text-[#a09aff] text-[11px] font-bold uppercase tracking-wide">{tx('GarageBase vnosi', 'GarageBase entries')}</p>
              <p className="text-[#c8c4ff] text-lg font-semibold mt-1">{formatMoney(prikazGarageBase, valuta)}</p>
            </div>
            <div className="rounded-xl border border-[#22c55e33] bg-[#22c55e0d] p-3">
              <p className="text-[#86efac] text-[11px] font-bold uppercase tracking-wide">{tx('Uvozena zgodovina', 'Imported history')}</p>
              <p className="text-[#bbf7d0] text-lg font-semibold mt-1">{formatMoney(prikazUvoz, valuta)}</p>
            </div>
          </div>
        )}
        {prikazStrosekNaKm && <p className="text-[#5a5a80] text-sm">{prikazStrosekNaKm} {znakValute}/{enotaRazdalje} · {tx('skupaj po razponu zapisov', 'total across record range')} · {formatDistance(kmPrevozeni, enotaRazdalje)}</p>}
      </div>

      <div className="overflow-hidden bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-4 mb-4">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[#5a5a80] text-xs uppercase tracking-wider">
            {grafTip === 'kolac'
              ? tx('Razmerje stroskov', 'Cost split')
              : grafTip === 'kategorije'
                ? tx('Trend po rubrikah', 'Category trend')
                : grafObdobje === '12m'
                  ? tx('Zadnjih 12 mesecev', 'Last 12 months')
                  : tx('Zadnjih 6 mesecev', 'Last 6 months')}
          </p>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
          {grafTip !== 'kolac' && (
          <div className="flex gap-1 bg-[#13131f] rounded-xl p-1">
            <button onClick={() => setGrafObdobje('6m')} className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${grafObdobje === '6m' ? 'bg-[#3ecfcf] text-black' : 'text-[#5a5a80] hover:text-white'}`}>6M</button>
            <button onClick={() => setGrafObdobje('12m')} className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${grafObdobje === '12m' ? 'bg-[#3ecfcf] text-black' : 'text-[#5a5a80] hover:text-white'}`}>{tx('1L', '1Y')}</button>
          </div>
          )}
          <div className="flex gap-1 bg-[#13131f] rounded-xl p-1">
            <button onClick={() => setGrafTip('stolpci')} className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${grafTip === 'stolpci' ? 'bg-[#6c63ff] text-white' : 'text-[#5a5a80] hover:text-white'}`}>▌▌▌</button>
            <button onClick={() => setGrafTip('crta')} className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${grafTip === 'crta' ? 'bg-[#6c63ff] text-white' : 'text-[#5a5a80] hover:text-white'}`}>╱╱</button>
            <button onClick={() => setGrafTip('kategorije')} className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${grafTip === 'kategorije' ? 'bg-[#6c63ff] text-white' : 'text-[#5a5a80] hover:text-white'}`}>3L</button>
            <button onClick={() => setGrafTip('kolac')} className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${grafTip === 'kolac' ? 'bg-[#6c63ff] text-white' : 'text-[#5a5a80] hover:text-white'}`}>◉</button>
          </div>
          </div>
        </div>
        {grafTip !== 'kolac' && graphTotals.gorivo + graphTotals.servis + graphTotals.ostalo === 0 && prikazSkupaj > 0 && (
          <div className="mb-3 rounded-2xl border border-[#6c63ff33] bg-[#6c63ff10] p-3 text-sm font-semibold text-[#a09aff]">
            {tx('V tem obdobju ni stroškov. Graf se zato opira na zadnje obdobje z vnesenimi podatki oziroma spodnje skupne zneske.', 'There are no costs in this period. The chart uses the latest period with data where possible, and the totals below remain available.')}
          </div>
        )}
        {grafTip === 'stolpci' && <GrafStolpci />}
        {grafTip === 'crta' && <GrafCrta />}
        {grafTip === 'kategorije' && <GrafKategorije />}
        {grafTip === 'kolac' && <GrafKolac />}
        {grafTip !== 'kolac' && (
          <div className="flex gap-4 mt-3 pt-3 border-t border-[#1e1e32]">
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: chartColors.gorivo }} /><p className="text-[#5a5a80] text-[10px]">{tx('Gorivo', 'Fuel')}</p></div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: chartColors.servis }} /><p className="text-[#5a5a80] text-[10px]">{tx('Servis', 'Service')}</p></div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: chartColors.ostalo }} /><p className="text-[#5a5a80] text-[10px]">{tx('Ostalo', 'Other')}</p></div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <button onClick={() => setFilter(filter === 'gorivo' ? 'vse' : 'gorivo')} className={`rounded-2xl p-3 border transition-all text-left ${filter === 'gorivo' ? 'bg-[#3ecfcf22] border-[#3ecfcf66]' : 'bg-[#0f0f1a] border-[#1e1e32]'}`}>
          <p className="text-2xl mb-2">⛽</p>
          <p className={`text-xs uppercase tracking-wider mb-1 ${filter === 'gorivo' ? 'text-[#3ecfcf]' : 'text-[#5a5a80]'}`}>{tx('Gorivo', 'Fuel')}</p>
          <p className={`font-bold text-lg ${filter === 'gorivo' ? 'text-[#3ecfcf]' : 'text-white'}`}>{prikazGorivo.toFixed(0)} {znakValute}</p>
          <p className="text-[#5a5a80] text-xs">{prikazStGorivo}x</p>
        </button>
        <button onClick={() => setFilter(filter === 'servis' ? 'vse' : 'servis')} className={`rounded-2xl p-3 border transition-all text-left ${filter === 'servis' ? 'bg-[#f59e0b22] border-[#f59e0b66]' : 'bg-[#0f0f1a] border-[#1e1e32]'}`}>
          <p className="text-2xl mb-2">🔧</p>
          <p className={`text-xs uppercase tracking-wider mb-1 ${filter === 'servis' ? 'text-[#f59e0b]' : 'text-[#5a5a80]'}`}>{tx('Servisi', 'Services')}</p>
          <p className={`font-bold text-lg ${filter === 'servis' ? 'text-[#f59e0b]' : 'text-white'}`}>{prikazServis.toFixed(0)} {znakValute}</p>
          <p className="text-[#5a5a80] text-xs">{prikazStServis}x</p>
        </button>
        <button onClick={() => setFilter(filter === 'ostalo' ? 'vse' : 'ostalo')} className={`rounded-2xl p-3 border transition-all text-left ${filter === 'ostalo' ? 'bg-[#6c63ff22] border-[#6c63ff66]' : 'bg-[#0f0f1a] border-[#1e1e32]'}`}>
          <p className="text-2xl mb-2">💰</p>
          <p className={`text-xs uppercase tracking-wider mb-1 ${filter === 'ostalo' ? 'text-[#a09aff]' : 'text-[#5a5a80]'}`}>{tx('Ostalo', 'Other')}</p>
          <p className={`font-bold text-lg ${filter === 'ostalo' ? 'text-[#a09aff]' : 'text-white'}`}>{prikazExpenses.toFixed(0)} {znakValute}</p>
          <p className="text-[#5a5a80] text-xs">{prikazStOstalo}x</p>
        </button>
      </div>

      <button onClick={() => router.push(`/vnos-stroska?car=${avto?.id}`)}
        className="w-full bg-[#3ecfcf] hover:bg-[#2eb8b8] text-black font-semibold py-3 rounded-xl transition-colors mb-4">
        + {tx('Dodaj strošek', 'Add expense')}
      </button>

      {filter !== 'vse' && (
        <div className="flex items-center justify-between mb-3">
          <p className="text-[#5a5a80] text-xs uppercase tracking-wider">{tx('Filtrirano', 'Filtered')}: {filter === 'gorivo' ? tx('Gorivo', 'Fuel') : filter === 'servis' ? tx('Servisi', 'Services') : tx('Ostalo', 'Other')}</p>
          <button onClick={() => setFilter('vse')} className="text-[#6c63ff] text-xs">{tx('Počisti filter', 'Clear filter')} x</button>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {filtrirani.length === 0 ? (
          <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-6 text-center">
            <p className="text-white font-semibold mb-1">{tx('Ni vnosov', 'No entries')}</p>
          </div>
        ) : (
          vidniVnosi.map((v) => {
            const preostalo = preostaliCas(v.created_at)
            const jeUredi = uredi === v.id

            if (v._tip === 'gorivo') return (
              <div key={`g-${v.id}`} className="bg-[#0f0f1a] border border-[#1e1e32] rounded-xl p-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">⛽</span>
                    <div>
                      <p className="text-white text-sm font-semibold">{new Date(v.datum).toLocaleDateString(language === 'en' ? 'en-US' : 'sl-SI')}</p>
                      <p className="text-[#5a5a80] text-xs">{v.litri} L · {formatDistance(v.km, enotaRazdalje)}{v.postaja ? ` · ${v.postaja}` : ''}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <p className="text-[#3ecfcf] font-semibold">{formatMoney(fuelCostValue(v), valuta)}</p>
                    {preostalo && !jeUredi && (
                      <button onClick={() => { setUredi(v.id); setEditData({ datum: v.datum, litri: v.litri?.toString(), cena_na_liter: v.cena_na_liter?.toString(), postaja: v.postaja || '' }) }}
                        className="flex items-center gap-1 bg-[#f59e0b22] border border-[#f59e0b44] text-[#f59e0b] text-[10px] font-semibold px-2 py-1 rounded-lg">
                        {tx('Uredi', 'Edit')} · {preostalo}
                      </button>
                    )}
                  </div>
                </div>
                {!jeUredi && v.receipt_url && (
                  <button
                    type="button"
                    onClick={() => window.open(v.receipt_url, '_blank')}
                    className="mt-3 w-full rounded-xl border border-[#3ecfcf55] bg-[#3ecfcf18] px-3 py-2 text-sm font-semibold text-[#3ecfcf]"
                  >
                    {tx('Odpri račun', 'Open receipt')}
                  </button>
                )}
                {jeUredi && (
                  <div className="flex flex-col gap-3 mt-3 pt-3 border-t border-[#1e1e32]">
                    <p className="text-[#f59e0b] text-xs font-semibold">{tx('Urejanje', 'Editing')} · {preostalo}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[#5a5a80] text-xs mb-1 block">{tx('Litri', 'Liters')}</label>
                        <input type="number" value={editData.litri} onChange={e => setEditData({ ...editData, litri: e.target.value })}
                          className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-[#f59e0b]" />
                      </div>
                      <div>
                        <label className="text-[#5a5a80] text-xs mb-1 block">{tx('Cena/L', 'Price/L')}</label>
                        <input type="number" value={editData.cena_na_liter} onChange={e => setEditData({ ...editData, cena_na_liter: e.target.value })}
                          className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-[#f59e0b]" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[#5a5a80] text-xs mb-1 block">{tx('Postaja', 'Station')}</label>
                      <input type="text" value={editData.postaja} onChange={e => setEditData({ ...editData, postaja: e.target.value })}
                        className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-[#f59e0b]" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => setUredi(null)} className="py-2 rounded-xl border border-[#1e1e32] text-[#5a5a80] text-sm">{tx('Prekliči', 'Cancel')}</button>
                      <button onClick={() => shraniUrediGorivo(v.id)} disabled={saving} className="py-2 rounded-xl bg-[#f59e0b] text-black font-semibold text-sm disabled:opacity-50">{saving ? tx('Shranjujem...', 'Saving...') : tx('Shrani', 'Save')}</button>
                    </div>
                  </div>
                )}
              </div>
            )

            if (v._tip === 'servis') return (
              <div key={`s-${v.id}`} className="bg-[#0f0f1a] border border-[#1e1e32] rounded-xl p-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">🔧</span>
                    <div>
                      <p className="text-white text-sm font-semibold">{new Date(v.datum).toLocaleDateString(language === 'en' ? 'en-US' : 'sl-SI')}</p>
                      <p className="text-[#5a5a80] text-xs">{v.opis?.replace(/\s*\[Naknadno.*?\]/, '').substring(0, 35)}{v.servis ? ` · ${v.servis}` : ''}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <p className="text-[#f59e0b] font-semibold">{formatMoney(v.cena, valuta)}</p>
                    {preostalo && !jeUredi && (
                      <button onClick={() => { setUredi(v.id); setEditData({ datum: v.datum, opis: v.opis?.replace(/\s*\[Naknadno.*?\]/, '') || '', servis: v.servis || '', cena: v.cena?.toString() || '' }) }}
                        className="flex items-center gap-1 bg-[#f59e0b22] border border-[#f59e0b44] text-[#f59e0b] text-[10px] font-semibold px-2 py-1 rounded-lg">
                        {tx('Uredi', 'Edit')} · {preostalo}
                      </button>
                    )}
                  </div>
                </div>
                {!jeUredi && v.foto_url && (
                  <button
                    type="button"
                    onClick={() => window.open(String(v.foto_url).split(',')[0], '_blank')}
                    className="mt-3 w-full rounded-xl border border-[#f59e0b55] bg-[#f59e0b18] px-3 py-2 text-sm font-semibold text-[#f59e0b]"
                  >
                    {tx('Odpri račun', 'Open receipt')}
                  </button>
                )}
                {jeUredi && (
                  <div className="flex flex-col gap-3 mt-3 pt-3 border-t border-[#1e1e32]">
                    <p className="text-[#f59e0b] text-xs font-semibold">{tx('Urejanje', 'Editing')} · {preostalo}</p>
                    <div>
                      <label className="text-[#5a5a80] text-xs mb-1 block">{tx('Opis', 'Description')}</label>
                      <textarea value={editData.opis} onChange={e => setEditData({ ...editData, opis: e.target.value })} rows={2}
                        className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-[#f59e0b] resize-none" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[#5a5a80] text-xs mb-1 block">{tx('Servis', 'Service')}</label>
                        <input type="text" value={editData.servis} onChange={e => setEditData({ ...editData, servis: e.target.value })}
                          className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-[#f59e0b]" />
                      </div>
                      <div>
                        <label className="text-[#5a5a80] text-xs mb-1 block">Cena ({znakValute})</label>
                        <input type="number" value={editData.cena} onChange={e => setEditData({ ...editData, cena: e.target.value })}
                          className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-[#f59e0b]" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => setUredi(null)} className="py-2 rounded-xl border border-[#1e1e32] text-[#5a5a80] text-sm">{tx('Prekliči', 'Cancel')}</button>
                      <button onClick={() => shraniUrediServis(v.id)} disabled={saving} className="py-2 rounded-xl bg-[#f59e0b] text-black font-semibold text-sm disabled:opacity-50">{saving ? tx('Shranjujem...', 'Saving...') : tx('Shrani', 'Save')}</button>
                    </div>
                  </div>
                )}
              </div>
            )

            return (
              <div key={`e-${v.id}`} className="bg-[#0f0f1a] border border-[#1e1e32] rounded-xl p-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{kategorijaIkona[v.kategorija] || '💰'}</span>
                    <div>
                      <p className="text-white text-sm font-semibold capitalize">{v.kategorija}</p>
                      <p className="text-[#5a5a80] text-xs">{new Date(v.datum).toLocaleDateString('sl-SI')}</p>
                      {v.opis && <p className="text-[#5a5a80] text-xs mt-0.5">{v.opis}</p>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <p className="text-[#a09aff] font-semibold">{formatMoney(v.znesek, valuta)}</p>
                    {preostalo && !jeUredi && (
                      <button onClick={() => { setUredi(v.id); setEditData({ datum: v.datum, opis: v.opis || '', znesek: v.znesek?.toString() || '' }) }}
                        className="flex items-center gap-1 bg-[#f59e0b22] border border-[#f59e0b44] text-[#f59e0b] text-[10px] font-semibold px-2 py-1 rounded-lg">
                        {tx('Uredi', 'Edit')} · {preostalo}
                      </button>
                    )}
                  </div>
                </div>
                {!jeUredi && v.receipt_url && (
                  <button
                    type="button"
                    onClick={() => window.open(v.receipt_url, '_blank')}
                    className="mt-3 w-full rounded-xl border border-[#a09aff55] bg-[#6c63ff18] px-3 py-2 text-sm font-semibold text-[#a09aff]"
                  >
                    {tx('Odpri račun', 'Open receipt')}
                  </button>
                )}
                {jeUredi && (
                  <div className="flex flex-col gap-3 mt-3 pt-3 border-t border-[#1e1e32]">
                    <p className="text-[#f59e0b] text-xs font-semibold">{tx('Urejanje', 'Editing')} · {preostalo}</p>
                    <div>
                      <label className="text-[#5a5a80] text-xs mb-1 block">{tx('Opis', 'Description')}</label>
                      <input type="text" value={editData.opis} onChange={e => setEditData({ ...editData, opis: e.target.value })}
                        className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-[#f59e0b]" />
                    </div>
                    <div>
                      <label className="text-[#5a5a80] text-xs mb-1 block">{tx('Znesek', 'Amount')} ({znakValute})</label>
                      <input type="number" value={editData.znesek} onChange={e => setEditData({ ...editData, znesek: e.target.value })}
                        className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-[#f59e0b]" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => setUredi(null)} className="py-2 rounded-xl border border-[#1e1e32] text-[#5a5a80] text-sm">{tx('Prekliči', 'Cancel')}</button>
                      <button onClick={() => shraniUrediExpense(v.id)} disabled={saving} className="py-2 rounded-xl bg-[#f59e0b] text-black font-semibold text-sm disabled:opacity-50">{saving ? tx('Shranjujem...', 'Saving...') : tx('Shrani', 'Save')}</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
        {filtrirani.length > vidniVnosi.length && (
          <button onClick={() => setVisibleCostCount(count => count + COST_LIST_SIZE)}
            className="mt-2 rounded-2xl border border-[#6c63ff55] bg-[#6c63ff18] px-4 py-3 text-sm font-bold text-[#a09aff]">
            {tx(`Nalozi se ${Math.min(COST_LIST_SIZE, filtrirani.length - vidniVnosi.length)} zapisov`, `Load ${Math.min(COST_LIST_SIZE, filtrirani.length - vidniVnosi.length)} more records`)}
          </button>
        )}
      </div>
      </div>

      <HomeButton />
    </div>
  )
}
