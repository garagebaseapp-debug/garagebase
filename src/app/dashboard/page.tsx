'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { HomeButton, BackButton } from '@/lib/nav'
import { type GarageBaseCurrency, currencySymbol, formatMoney } from '@/lib/currency'
import { getStoredLanguage, type Language } from '@/lib/i18n'
import { buildVehicleStats, fuelCostValue as sharedFuelCostValue, fuelLitersValue } from '@/lib/vehicle-costs'
import { GARAGE_CACHE_VERSION, ensureVehicleStatsCacheVersion, imageUrlWithVersion, readGarageCache, VEHICLE_STATS_CACHE_VERSION } from '@/lib/vehicle-cache'
import { vehicleDisplayName } from '@/lib/vehicle-display'

type ConsumptionBreakdown = {
  garageBase: number | null
  imported: number | null
  total: number | null
}

type CostBreakdown = {
  garageBase: number
  imported: number
  total: number
  naKm: number | null
}

const emptyConsumption: ConsumptionBreakdown = { garageBase: null, imported: null, total: null }
const emptyCosts: CostBreakdown = { garageBase: 0, imported: 0, total: 0, naKm: null }

const numberValue = (value: unknown) => {
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

const fuelCostValue = (row: any) => {
  return sharedFuelCostValue(row)
}

const statsHasRealValues = (stats: any) => {
  if (!stats) return false
  const costTotal =
    numberValue(stats.costs?.fuel) +
    numberValue(stats.costs?.service) +
    numberValue(stats.costs?.expense) +
    numberValue(stats.costs?.total)
  return costTotal > 0 ||
    numberValue(stats.consumption?.garageBase) > 0 ||
    numberValue(stats.consumption?.imported) > 0 ||
    numberValue(stats.consumption?.total) > 0
}

const statsHasData = (stats: any) => {
  if (!stats) return false
  const rowCount =
    numberValue(stats.rows?.fuel) +
    numberValue(stats.rows?.service) +
    numberValue(stats.rows?.expense)
  const costTotal =
    numberValue(stats.costs?.fuel) +
    numberValue(stats.costs?.service) +
    numberValue(stats.costs?.expense) +
    numberValue(stats.costs?.total)
  return rowCount > 0 || costTotal > 0 || numberValue(stats.liters) > 0
}

const isImportedDashboardRow = (row: any) => {
  const rawText = `${row?.opis || ''} ${row?.postaja || ''} ${row?.kategorija || ''}`
  return Boolean(
    row?.import_batch_id ||
    row?.source_owner_label ||
    /\[(?:Drivvo|CSV|Naknadno|Prejsnji lastnik|Previous owner|IMPORTED HISTORY)/i.test(rawText)
  )
}

const importBuckets = (rows: any[]) => rows.reduce((buckets: Record<string, number>, row: any) => {
  const key = row?.created_at ? String(row.created_at).slice(0, 16) : ''
  if (key) buckets[key] = (buckets[key] || 0) + 1
  return buckets
}, {})

const splitRowsBySource = (rows: any[]) => {
  const buckets = importBuckets(rows)
  const imported: any[] = []
  const garageBase: any[] = []
  rows.forEach((row) => {
    const key = row?.created_at ? String(row.created_at).slice(0, 16) : ''
    const looksLikeBulkImport = key && (buckets[key] || 0) >= 3
    if (isImportedDashboardRow(row) || looksLikeBulkImport) imported.push(row)
    else garageBase.push(row)
  })
  return { imported, garageBase }
}

const importedConsumptionValue = (row: any) => {
  const rawText = `${row?.opis || ''} ${row?.postaja || ''} ${row?.kategorija || ''}`
  const match = rawText.match(/(?:Poraba|Consumption|Efficiency)\s*:\s*([0-9]+(?:[,.][0-9]+)?)/i)
  if (!match) return null
  const parsed = Number(match[1].replace(',', '.'))
  return Number.isFinite(parsed) && parsed > 0 && parsed < 100 ? parsed : null
}

const averageKnownConsumption = (rows: any[]) => {
  const values = rows.map(importedConsumptionValue).filter((value): value is number => value !== null)
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

const consumptionSegment = (rows: any[]) => {
  const sorted = rows
    .filter((row) => numberValue(row.km) > 0 && fuelLitersValue(row) > 0)
    .sort((a, b) => numberValue(a.km) - numberValue(b.km))

  if (sorted.length < 2) {
    return { average: averageKnownConsumption(rows), distance: 0, liters: 0 }
  }

  let distance = 0
  let liters = 0
  for (let i = 1; i < sorted.length; i++) {
    const diff = numberValue(sorted[i].km) - numberValue(sorted[i - 1].km)
    if (diff <= 0) continue
    distance += diff
    liters += fuelLitersValue(sorted[i])
  }

  return {
    average: distance > 0 ? (liters / distance) * 100 : averageKnownConsumption(rows),
    distance,
    liters,
  }
}

const combineConsumptionSegments = (segments: Array<{ average: number | null; distance: number; liters: number }>) => {
  const measured = segments.filter((segment) => segment.distance > 0 && segment.liters > 0)
  const distance = measured.reduce((sum, segment) => sum + segment.distance, 0)
  const liters = measured.reduce((sum, segment) => sum + segment.liters, 0)
  if (distance > 0) return (liters / distance) * 100

  const known = segments.map((segment) => segment.average).filter((value): value is number => value !== null)
  if (known.length === 0) return null
  return known.reduce((sum, value) => sum + value, 0) / known.length
}

const readCostCache = (carId: string) => {
  const keys = [`garagebase_stroski_cache_${carId}`, `garagebase_fuel_history_cache_${carId}`]
  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key)
      const parsed = raw ? JSON.parse(raw) : null
      const gorivo = Array.isArray(parsed?.gorivo) ? parsed.gorivo : Array.isArray(parsed?.rows) ? parsed.rows : []
      const servisi = Array.isArray(parsed?.servisi) ? parsed.servisi : []
      const expenses = Array.isArray(parsed?.expenses) ? parsed.expenses : []
      if (gorivo.length || servisi.length || expenses.length) return { gorivo, servisi, expenses }
    } catch {}
  }
  return null
}

const readCostTotalsCache = (carId: string) => {
  try {
    const raw = localStorage.getItem(`garagebase_cost_totals_${carId}`)
    const parsed = raw ? JSON.parse(raw) : null
    const hasValue =
      numberValue(parsed?.fuelCost) > 0 ||
      numberValue(parsed?.serviceCost) > 0 ||
      numberValue(parsed?.expenseCost) > 0 ||
      numberValue(parsed?.totalCost) > 0 ||
      numberValue(parsed?.garageBaseFuelCost) > 0 ||
      numberValue(parsed?.importedFuelCost) > 0 ||
      numberValue(parsed?.fuelRows) > 0 ||
      numberValue(parsed?.serviceRows) > 0 ||
      numberValue(parsed?.expenseRows) > 0
    if (hasValue) return parsed
    const garageRaw = localStorage.getItem('garagebase_stroski_garaza_cache')
    const garageParsed = garageRaw ? JSON.parse(garageRaw) : null
    const garageTotal = numberValue(garageParsed?.stroski?.[carId])
    return garageTotal > 0 ? { totalCost: garageTotal, garageBaseFuelCost: garageTotal, fuelRows: 0 } : null
  } catch {
    return null
  }
}

const readVehicleStatsCache = (carId: string) => {
  try {
    const raw = localStorage.getItem(`garagebase_vehicle_stats_${carId}`)
    const parsed = raw ? JSON.parse(raw) : null
    const total =
      numberValue(parsed?.costs?.total) ||
      (numberValue(parsed?.fuelCost) + numberValue(parsed?.serviceCost) + numberValue(parsed?.expenseCost))
    const hasConsumption =
      numberValue(parsed?.consumption?.garageBase) > 0 ||
      numberValue(parsed?.consumption?.imported) > 0 ||
      numberValue(parsed?.consumption?.total) > 0
    if (total <= 0 && !hasConsumption) return null
    return parsed
  } catch {
    return null
  }
}

export default function Dashboard() {
  const router = useRouter()
  const activeLoadRef = useRef('')
  const [avti, setAvti] = useState<any[]>([])
  const [aktivniAvto, setAktivniAvto] = useState<any>(null)
  const [opomniki, setOpomniki] = useState<any[]>([])
  const [poraba, setPoraba] = useState<ConsumptionBreakdown>(emptyConsumption)
  const [stroski, setStroski] = useState<CostBreakdown>(emptyCosts)
  const [loading, setLoading] = useState(true)
  const [nacin, setNacin] = useState<'lite' | 'full'>('full')
  const [valuta, setValuta] = useState<GarageBaseCurrency>('EUR')
  const [jezik, setJezik] = useState<Language>('sl')
  const [liteOpomnikiPoAvtu, setLiteOpomnikiPoAvtu] = useState<Record<string, any[]>>({})
  const tx = (sl: string, en: string) => (jezik === 'en' ? en : sl)
  const datumLocale = jezik === 'en' ? 'en-US' : 'sl-SI'
  const znakValute = currencySymbol(valuta)
  const slikaVozila = (avto: any) => {
    const rawUrl = avto?.slika_url || avto?.slika || ''
    if (!rawUrl) return ''
    return imageUrlWithVersion(rawUrl, avto?.slika_updated_at || avto?.updated_at || avto?.created_at || GARAGE_CACHE_VERSION)
  }
  const renderStats = aktivniAvto?.id ? readVehicleStatsCache(aktivniAvto.id) : null
  const cachedConsumption: ConsumptionBreakdown = renderStats?.consumption
    ? {
        garageBase: renderStats.consumption.garageBase ?? null,
        imported: renderStats.consumption.imported ?? null,
        total: renderStats.consumption.total ?? null,
      }
    : emptyConsumption
  const cachedCostTotal =
    numberValue(renderStats?.costs?.total) ||
    (numberValue(renderStats?.fuelCost) + numberValue(renderStats?.serviceCost) + numberValue(renderStats?.expenseCost))
  const cachedImportedCost = numberValue(renderStats?.costs?.imported)
  const cachedCosts: CostBreakdown = {
    garageBase: numberValue(renderStats?.costs?.garageBase) || Math.max(0, cachedCostTotal - cachedImportedCost),
    imported: cachedImportedCost,
    total: cachedCostTotal,
    naKm: renderStats?.costs?.naKm ?? renderStats?.costs?.perKm ?? null,
  }
  const stateHasConsumption = poraba.total !== null || poraba.garageBase !== null || poraba.imported !== null
  const stateHasCosts = stroski.total > 0 || stroski.garageBase > 0 || stroski.imported > 0
  const renderPoraba = stateHasConsumption ? poraba : cachedConsumption
  const renderStroski = stateHasCosts ? stroski : cachedCosts
  const hasConsumptionBreakdown = renderPoraba.total !== null || renderPoraba.garageBase !== null || renderPoraba.imported !== null
  const hasCostBreakdown = renderStroski.total > 0 || renderStroski.garageBase > 0 || renderStroski.imported > 0
  const consumptionText = (value: number | null) => value !== null ? `${value.toFixed(1)} L/100` : '-'

  useEffect(() => {
    const init = async () => {
      ensureVehicleStatsCacheVersion(VEHICLE_STATS_CACHE_VERSION)
      let jeLite = false
      const settingsRaw = localStorage.getItem('garagebase_nastavitve')
      if (settingsRaw) {
        try {
          const settings = JSON.parse(settingsRaw)
          jeLite = settings.nacin === 'lite'
          setNacin(jeLite ? 'lite' : 'full')
          setValuta(settings.valuta === 'USD' ? 'USD' : 'EUR')
          setJezik(settings.jezik === 'en' || settings.language === 'en' ? 'en' : getStoredLanguage())
        } catch {}
      }
      if (!settingsRaw) setJezik(getStoredLanguage())
      const params = new URLSearchParams(window.location.search)
      const carIdFromUrl = params.get('car')
      const parsedCache = readGarageCache()
      if (parsedCache && !carIdFromUrl) {
        const cachedCars = Array.isArray(parsedCache.avti)
          ? parsedCache.avti.filter((car: any) => car?.arhivirano !== true)
          : []
        if (cachedCars.length > 0) {
          setAvti(cachedCars)
          setAktivniAvto(cachedCars[0])
          setLoading(false)
        }
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/'); return }
      let selectedCar: any = null
      if (carIdFromUrl) {
        const { data } = await supabase
          .from('cars').select('*')
          .eq('user_id', user.id)
          .eq('id', carIdFromUrl)
          .maybeSingle()
        selectedCar = data || null
      }
      const archiveMode = Boolean(selectedCar?.arhivirano)
      let { data: avtiData, error: avtiError } = await supabase
        .from('cars').select('*').eq('user_id', user.id)
        .eq('arhivirano', archiveMode)
        .order('vrstni_red', { ascending: true })
      if (avtiError) {
        const fallback = await supabase
          .from('cars').select('*').eq('user_id', user.id)
          .order('vrstni_red', { ascending: true })
        avtiData = fallback.data || []
      }
      let cars = (avtiData || []).filter((car: any) => Boolean(car?.arhivirano) === archiveMode || car.id === selectedCar?.id)
      if (selectedCar && !cars.some((car: any) => car.id === selectedCar.id)) {
        cars = [selectedCar, ...cars]
      }
      setAvti(cars)
      if (!archiveMode) {
        const previousGarageCache = localStorage.getItem('garagebase_garaza_cache')
        let previousOpomniki = {}
        try { previousOpomniki = previousGarageCache ? JSON.parse(previousGarageCache).opomniki || {} : {} } catch {}
        localStorage.setItem('garagebase_garaza_cache', JSON.stringify({ version: GARAGE_CACHE_VERSION, avti: cars, opomniki: previousOpomniki, arhiv: false, savedAt: Date.now() }))
      }
      if (cars.length > 0) {
        const izbrani = carIdFromUrl
          ? cars.find((a: any) => a.id === carIdFromUrl) || selectedCar || cars[0]
          : cars[0]
        setAktivniAvto(izbrani)
        setLoading(false)
        if (jeLite) await naloziLitePodatke(cars.map((a: any) => a.id), izbrani.id)
        await naloziPodatke(izbrani.id, izbrani.km_trenutni || 0, izbrani.km_ob_vnosu || 0)
      }
      setLoading(false)
    }
    init()
  }, [])

  const naloziLitePodatke = async (carIds: string[] | string, activeCarId?: string) => {
    const ids = Array.isArray(carIds) ? carIds : [carIds]
    const selectedId = activeCarId || ids[0]
    const cachedGrouped: Record<string, any[]> = {}

    ids.forEach((id) => {
      const cached = localStorage.getItem(`garagebase_dashboard_cache_${id}`)
      if (!cached) return
      try {
        const parsed = JSON.parse(cached)
        if (Array.isArray(parsed.opomniki)) cachedGrouped[id] = parsed.opomniki
      } catch {}
    })

    if (Object.keys(cachedGrouped).length > 0) {
      setLiteOpomnikiPoAvtu((prev) => ({ ...prev, ...cachedGrouped }))
      if (selectedId && cachedGrouped[selectedId]) setOpomniki(cachedGrouped[selectedId])
    }

    if (ids.length === 0) return
    const { data } = await supabase
      .from('reminders')
      .select('*')
      .in('car_id', ids)
      .order('datum', { ascending: true })

    const grouped: Record<string, any[]> = {}
    ;(data || []).forEach((op: any) => {
      if (!op.car_id) return
      if (!grouped[op.car_id]) grouped[op.car_id] = []
      grouped[op.car_id].push(op)
    })

    const completeGrouped: Record<string, any[]> = {}
    ids.forEach((id) => {
      const opData = grouped[id] || []
      completeGrouped[id] = opData
      let previousVehicleCache = {}
      try {
        const previousRaw = localStorage.getItem(`garagebase_dashboard_cache_${id}`)
        previousVehicleCache = previousRaw ? JSON.parse(previousRaw) : {}
      } catch {}
      localStorage.setItem(`garagebase_dashboard_cache_${id}`, JSON.stringify({ ...previousVehicleCache, opomniki: opData, savedAt: Date.now() }))
    })

    setLiteOpomnikiPoAvtu(completeGrouped)
    if (selectedId) setOpomniki(completeGrouped[selectedId] || [])
  }

  const naloziStatistikoVozila = async (carId: string, kmStart: number = 0, kmObVnosu: number = 0) => {
    const { data: sessionData } = await supabase.auth.getSession()
    if (activeLoadRef.current !== carId) return { poraba: emptyConsumption, stroski: emptyCosts, fuelRows: [] }
    const token = sessionData.session?.access_token
    const cachedStats = readVehicleStatsCache(carId)
    let cachedFallback: { poraba: ConsumptionBreakdown; stroski: CostBreakdown } | null = null
    let apiFallback: { poraba: ConsumptionBreakdown; stroski: CostBreakdown } | null = null

    if (token) {
      try {
        const response = await fetch(`/api/vehicle-stats?car=${encodeURIComponent(carId)}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        })
        const payload = await response.json()
        if (response.ok && payload?.ok && payload?.stats && statsHasRealValues(payload.stats)) {
          if (activeLoadRef.current !== carId) return { poraba: emptyConsumption, stroski: emptyCosts, fuelRows: [] }
          const stats = payload.stats
          const nextPoraba = {
            garageBase: stats.consumption?.garageBase ?? null,
            imported: stats.consumption?.imported ?? null,
            total: stats.consumption?.total ?? null,
          }
          const hasApiConsumption = nextPoraba.total !== null || nextPoraba.garageBase !== null || nextPoraba.imported !== null
          const nextStroski = {
            garageBase: numberValue(stats.costs?.garageBase),
            imported: numberValue(stats.costs?.imported),
            total: numberValue(stats.costs?.total),
            naKm: stats.costs?.perKm ?? null,
          }
          apiFallback = { poraba: nextPoraba, stroski: nextStroski }
          localStorage.setItem(`garagebase_vehicle_stats_${carId}`, JSON.stringify({
            fuelCost: numberValue(stats.costs?.fuel),
            serviceCost: numberValue(stats.costs?.service),
            expenseCost: numberValue(stats.costs?.expense),
            fuelLiters: numberValue(stats.liters),
            fuelRows: numberValue(stats.rows?.fuel),
            rows: {
              fuel: numberValue(stats.rows?.fuel),
              service: numberValue(stats.rows?.service),
              expense: numberValue(stats.rows?.expense),
            },
            liters: numberValue(stats.liters),
            consumption: nextPoraba,
            costs: nextStroski,
            savedAt: Date.now(),
          }))
          setStroski(nextStroski)
          if (hasApiConsumption) {
            setPoraba(nextPoraba)
            return { poraba: nextPoraba, stroski: nextStroski, fuelRows: [] }
          }
        } else if (response.ok && payload?.ok && payload?.stats && statsHasData(payload.stats)) {
          if (activeLoadRef.current !== carId) return { poraba: emptyConsumption, stroski: emptyCosts, fuelRows: [] }
        } else {
          console.warn('[GarageBase dashboard] server statistics failed', payload?.error)
        }
      } catch (error) {
        console.warn('[GarageBase dashboard] server statistics unavailable', error)
      }
    }

    if (cachedStats?.costs || cachedStats?.consumption) {
      if (activeLoadRef.current !== carId) return { poraba: emptyConsumption, stroski: emptyCosts, fuelRows: [] }
      const cachedCostTotal =
        numberValue(cachedStats?.costs?.total) ||
        (numberValue(cachedStats?.fuelCost) + numberValue(cachedStats?.serviceCost) + numberValue(cachedStats?.expenseCost))
      const cachedPoraba = cachedStats?.consumption
        ? {
            garageBase: cachedStats.consumption.garageBase ?? null,
            imported: cachedStats.consumption.imported ?? null,
            total: cachedStats.consumption.total ?? null,
          }
        : emptyConsumption
      const cachedStroski = {
        garageBase: numberValue(cachedStats?.costs?.garageBase) || cachedCostTotal,
        imported: numberValue(cachedStats?.costs?.imported),
        total: cachedCostTotal,
        naKm: cachedStats?.costs?.naKm ?? null,
      }
      cachedFallback = { poraba: cachedPoraba, stroski: cachedStroski }
      if (cachedPoraba.total !== null || cachedPoraba.garageBase !== null || cachedPoraba.imported !== null) setPoraba(cachedPoraba)
      if (cachedStroski.total > 0 || cachedStroski.garageBase > 0 || cachedStroski.imported > 0) setStroski(cachedStroski)
    }

    const [fuelRes, serviceRes, expenseRes] = await Promise.all([
      supabase
        .from('fuel_logs')
        .select('*')
        .eq('car_id', carId)
        .order('km', { ascending: true }),
      supabase
        .from('service_logs')
        .select('*')
        .eq('car_id', carId),
      supabase
        .from('expenses')
        .select('*')
        .eq('car_id', carId),
    ])
    if (activeLoadRef.current !== carId) return { poraba: emptyConsumption, stroski: emptyCosts, fuelRows: [] }

    if (fuelRes.error || serviceRes.error || expenseRes.error) {
      console.warn('[GarageBase dashboard] statistics fetch failed', fuelRes.error?.message, serviceRes.error?.message, expenseRes.error?.message)
    }

    let fuelRows = fuelRes.data || []
    let serviceRows = serviceRes.data || []
    let expenseRows = expenseRes.data || []
    if (fuelRows.length === 0 && serviceRows.length === 0 && expenseRows.length === 0) {
      try {
        const cached = readCostCache(carId)
        if (cached) {
          fuelRows = cached.gorivo
          serviceRows = cached.servisi
          expenseRows = cached.expenses
        }
      } catch {}
    }
    const directStats = buildVehicleStats(fuelRows, serviceRows, expenseRows, {
      km_trenutni: kmStart,
      km_ob_vnosu: kmObVnosu,
    })
    const totalsCache = readCostTotalsCache(carId)
    const cachedFuelCost = numberValue(totalsCache?.fuelCost)
    const cachedServiceCost = numberValue(totalsCache?.serviceCost)
    const cachedExpenseCost = numberValue(totalsCache?.expenseCost)
    const cachedTotalsCost = numberValue(totalsCache?.totalCost) || cachedFuelCost + cachedServiceCost + cachedExpenseCost
    const cachedGarageBaseFuelCost = numberValue(totalsCache?.garageBaseFuelCost)
    const cachedImportedFuelCost = numberValue(totalsCache?.importedFuelCost)
    const cachedTotalCost = cachedFallback?.stroski.total || apiFallback?.stroski.total || 0
    const finalTotalCost = directStats.costs.total > 0 ? directStats.costs.total : cachedTotalsCost || cachedTotalCost
    const finalGarageBaseCost = directStats.costs.garageBase > 0
      ? directStats.costs.garageBase
      : cachedGarageBaseFuelCost || cachedFallback?.stroski.garageBase || apiFallback?.stroski.garageBase || (cachedFuelCost > 0 && cachedImportedFuelCost === 0 ? cachedFuelCost : 0)
    const finalImportedCost = directStats.costs.imported > 0
      ? directStats.costs.imported
      : cachedImportedFuelCost || cachedFallback?.stroski.imported || apiFallback?.stroski.imported || 0
    const nextPoraba = {
      garageBase: directStats.consumption.garageBase ?? cachedFallback?.poraba.garageBase ?? apiFallback?.poraba.garageBase ?? null,
      imported: directStats.consumption.imported ?? cachedFallback?.poraba.imported ?? apiFallback?.poraba.imported ?? null,
      total: directStats.consumption.total ?? cachedFallback?.poraba.total ?? apiFallback?.poraba.total ?? null,
    }
    const nextStroski = {
      garageBase: finalGarageBaseCost,
      imported: finalImportedCost,
      total: finalTotalCost,
      naKm: directStats.costs.perKm ?? cachedFallback?.stroski.naKm ?? apiFallback?.stroski.naKm ?? (kmStart > kmObVnosu && finalTotalCost > 0 ? finalTotalCost / (kmStart - kmObVnosu) : null),
    }
    setPoraba(nextPoraba)
    setStroski(nextStroski)
    localStorage.setItem(`garagebase_vehicle_stats_${carId}`, JSON.stringify({
      fuelCost: directStats.costs.fuel || cachedFuelCost,
      serviceCost: directStats.costs.service,
      expenseCost: directStats.costs.expense,
      fuelLiters: directStats.liters || numberValue(totalsCache?.fuelLiters),
      fuelRows: directStats.rows.fuel || numberValue(totalsCache?.fuelRows),
      rows: directStats.rows,
      liters: directStats.liters || numberValue(totalsCache?.fuelLiters),
      consumption: nextPoraba,
      costs: nextStroski,
      savedAt: Date.now(),
    }))
    return { poraba: nextPoraba, stroski: nextStroski, fuelRows }
  }

  const naloziPodatke = async (carId: string, avtoKmStart: number = 0, kmObVnosu: number = 0) => {
    activeLoadRef.current = carId
    const shouldApply = () => activeLoadRef.current === carId
    const cached = localStorage.getItem(`garagebase_dashboard_cache_${carId}`)
    if (cached) {
      try {
        const parsed = JSON.parse(cached)
        if (Array.isArray(parsed.opomniki)) setOpomniki(parsed.opomniki)
        if (parsed.poraba) {
          const cachedPoraba = 'total' in parsed.poraba
            ? parsed.poraba
            : { ...emptyConsumption, total: parsed.poraba.skupaj ?? null }
          if (cachedPoraba.total !== null || cachedPoraba.garageBase !== null || cachedPoraba.imported !== null) setPoraba(cachedPoraba)
        }
        if (parsed.stroski) {
          const cachedStroski = 'total' in parsed.stroski
            ? parsed.stroski
            : { ...emptyCosts, total: parsed.stroski.skupaj || 0, naKm: parsed.stroski.naKm ?? null }
          if (numberValue(cachedStroski.total) > 0 || numberValue(cachedStroski.garageBase) > 0 || numberValue(cachedStroski.imported) > 0) setStroski(cachedStroski)
        }
      } catch {}
    }
    const trustedCachedStats = readVehicleStatsCache(carId)
    const cachedStats = trustedCachedStats ? JSON.stringify(trustedCachedStats) : null
    if (cachedStats) {
      try {
        const parsed = JSON.parse(cachedStats)
        if (parsed.costs && numberValue(parsed.costs.total) > 0) {
          setStroski({
            garageBase: numberValue(parsed.costs.garageBase),
            imported: numberValue(parsed.costs.imported),
            total: numberValue(parsed.costs.total),
            naKm: parsed.costs.naKm ?? null,
          })
        } else {
          const cachedCostTotal = numberValue(parsed.fuelCost) + numberValue(parsed.serviceCost) + numberValue(parsed.expenseCost)
          if (cachedCostTotal > 0) setStroski({ garageBase: cachedCostTotal, imported: 0, total: cachedCostTotal, naKm: null })
        }
      } catch {}
    }

    const [opRes] = await Promise.all([
      supabase.from('reminders').select('*').eq('car_id', carId).order('datum', { ascending: true }),
    ])

    const opData = opRes.data || []
    if (!shouldApply()) return
    setOpomniki(opData)

    const stats = await naloziStatistikoVozila(carId, avtoKmStart, kmObVnosu)
    if (!shouldApply()) return
    const nextPoraba = stats.poraba
    const nextStroski = stats.stroski
    localStorage.setItem(`garagebase_dashboard_cache_${carId}`, JSON.stringify({ opomniki: opData, poraba: nextPoraba, stroski: nextStroski, savedAt: Date.now() }))
  }
  const preklopAvto = async (avto: any) => {
    if (!avto?.id) return
    if (avto.id === aktivniAvto?.id) return
    setAktivniAvto(avto)
    setOpomniki([])
    setPoraba({ garageBase: null, imported: null, total: null })
    setStroski({ garageBase: 0, imported: 0, total: 0, naKm: null })
    router.push(`/dashboard?car=${encodeURIComponent(avto.id)}`)
    if (nacin === 'lite') await naloziLitePodatke(avti.map((a: any) => a.id), avto.id)
    await naloziPodatke(avto.id, avto.km_trenutni || 0, avto.km_ob_vnosu || 0)
  }

  const dniDo = (datum: string) => {
    if (!datum) return null
    return Math.ceil((new Date(datum).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
  }

  const kmDo = (kmOpomnik: number) => {
    if (!aktivniAvto?.km_trenutni) return null
    return kmOpomnik - aktivniAvto.km_trenutni
  }

  // Barva glede na dni
  const barvaZaDni = (dni: number | null) => {
    if (dni === null) return { text: 'text-[#5a5a80]', bg: 'bg-[#13131f]', border: 'border-[#1e1e32]' }
    if (dni <= 7) return { text: 'text-[#ef4444]', bg: 'bg-[#ef444411]', border: 'border-[#ef444433]' }
    if (dni <= 30) return { text: 'text-[#f59e0b]', bg: 'bg-[#f59e0b11]', border: 'border-[#f59e0b33]' }
    return { text: 'text-[#3ecfcf]', bg: 'bg-[#3ecfcf11]', border: 'border-[#3ecfcf33]' }
  }

  // Barva glede na km
  const barvaZaKm = (preostaloKm: number | null) => {
    if (preostaloKm === null) return { text: 'text-[#5a5a80]', bg: 'bg-[#13131f]', border: 'border-[#1e1e32]' }
    if (preostaloKm <= 500) return { text: 'text-[#ef4444]', bg: 'bg-[#ef444411]', border: 'border-[#ef444433]' }
    if (preostaloKm <= 1500) return { text: 'text-[#f59e0b]', bg: 'bg-[#f59e0b11]', border: 'border-[#f59e0b33]' }
    return { text: 'text-[#3ecfcf]', bg: 'bg-[#3ecfcf11]', border: 'border-[#3ecfcf33]' }
  }

  // Skupna barva — vzame slabšo
  const skupnaBarva = (dni: number | null, preostaloKm: number | null) => {
    const bdni = barvaZaDni(dni)
    const bkm = barvaZaKm(preostaloKm)
    if (bdni.text === 'text-[#ef4444]' || bkm.text === 'text-[#ef4444]')
      return { text: 'text-[#ef4444]', bg: 'bg-[#ef444411]', border: 'border-[#ef444433]' }
    if (bdni.text === 'text-[#f59e0b]' || bkm.text === 'text-[#f59e0b]')
      return { text: 'text-[#f59e0b]', bg: 'bg-[#f59e0b11]', border: 'border-[#f59e0b33]' }
    return { text: 'text-[#3ecfcf]', bg: 'bg-[#3ecfcf11]', border: 'border-[#3ecfcf33]' }
  }

  type LiteStatus = 'grey' | 'green' | 'orange' | 'red'
  const liteStatusRank: Record<LiteStatus, number> = { grey: 0, green: 1, orange: 2, red: 3 }
  const liteStatusStyle: Record<LiteStatus, { border: string; bg: string; text: string; ring: string }> = {
    grey: { border: 'border-[#343446]', bg: 'bg-[#141421]', text: 'text-[#a0a0b8]', ring: 'ring-[#343446]' },
    green: { border: 'border-[#22c55e]', bg: 'bg-[#22c55e14]', text: 'text-[#4ade80]', ring: 'ring-[#22c55e]' },
    orange: { border: 'border-[#f59e0b]', bg: 'bg-[#f59e0b14]', text: 'text-[#fbbf24]', ring: 'ring-[#f59e0b]' },
    red: { border: 'border-[#ef4444]', bg: 'bg-[#ef444414]', text: 'text-[#f87171]', ring: 'ring-[#ef4444]' },
  }
  const tipBadge: Record<string, string> = { registracija: 'REG', vinjeta: 'VIN', tehnicni: 'TEH', servis: 'SRV', zavarovanje: 'ZAV', gume: 'GUM' }
  const tipIkona: Record<string, string> = {
    registracija: '📋',
    vinjeta: '🛣️',
    tehnicni: '🔍',
    servis: '🔧',
    zavarovanje: '🛡️',
    gume: '⚫',
    drugo: '✏️',
  }
  const tipNaziv: Record<string, string> = {
    registracija: tx('Registracija', 'Registration'),
    vinjeta: tx('Vinjeta', 'Vignette'),
    tehnicni: tx('Tehnični pregled', 'Roadworthiness test'),
    servis: tx('Servis', 'Service'),
    zavarovanje: tx('Zavarovanje', 'Insurance'),
    gume: tx('Gume', 'Tires'),
    drugo: tx('Drugo', 'Other'),
  }
  const liteTipNaziv = (tip?: string) => tipNaziv[tip || ''] || tip || tx('Opomnik', 'Reminder')
  const statusZaOpomnik = (op: any, avto: any): LiteStatus => {
    const dni = dniDo(op.datum)
    const km = op.km_opomnik && avto?.km_trenutni ? op.km_opomnik - avto.km_trenutni : null
    if ((dni !== null && dni <= 7) || (km !== null && km <= 500)) return 'red'
    if ((dni !== null && dni <= 30) || (km !== null && km <= 1500)) return 'orange'
    if (dni !== null || km !== null) return 'green'
    return 'grey'
  }
  const statusZaAvto = (avto: any): LiteStatus => {
    const list = liteOpomnikiPoAvtu[avto.id] || []
    if (list.length === 0) return 'grey'
    return list.reduce((worst: LiteStatus, op: any) => {
      const next = statusZaOpomnik(op, avto)
      return liteStatusRank[next] > liteStatusRank[worst] ? next : worst
    }, 'green')
  }
  const statusOznaka = (status: LiteStatus) => {
    if (status === 'red') return tx('Nujni opomniki', 'Urgent reminders')
    if (status === 'orange') return tx('Kmalu zapade', 'Due soon')
    if (status === 'green') return tx('V redu', 'All good')
    return tx('Brez opomnikov', 'No reminders')
  }
  const nujniOpomniki = opomniki
    .map((op) => ({ ...op, dni: dniDo(op.datum), km: op.km_opomnik ? kmDo(op.km_opomnik) : null }))
    .sort((a, b) => Math.min(a.dni ?? 9999, a.km ?? 999999) - Math.min(b.dni ?? 9999, b.km ?? 999999))
    .slice(0, 3)
  const vinjetaOpomnik = opomniki
    .filter((op) => String(op.tip || '').toLowerCase().includes('vinjet'))
    .sort((a, b) => new Date(a.datum || '9999-12-31').getTime() - new Date(b.datum || '9999-12-31').getTime())[0]
  const vinjetaDatum = vinjetaOpomnik?.datum ? new Date(vinjetaOpomnik.datum).toLocaleDateString(datumLocale) : ''
  const vinjetaLabel = vinjetaDatum ? `${tx('Vinjeta do', 'Vignette until')} ${vinjetaDatum}` : ''

  if (nacin === 'lite' && aktivniAvto) {
    const aktivniStatus = statusZaAvto(aktivniAvto)
    const aktivnoIme = vehicleDisplayName(aktivniAvto, tx('Vozilo', 'Vehicle'))
    const prikazOpomnikov = opomniki.slice(0, 4)

    return (
      <div className="min-h-screen bg-[#080810] px-4 py-6 pb-24">
        <div className="flex items-center gap-3 mb-5">
          <BackButton href="/garaza" />
          <div>
            <h1 className="text-xl font-bold text-white">Lite</h1>
            <p className="text-[#8a8aa6] text-sm">{tx('Hitri način za vsakdanjo uporabo', 'Quick mode for daily use')}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          {avti.map((avto) => {
            const status = statusZaAvto(avto)
            const active = aktivniAvto?.id === avto.id
            const ime = vehicleDisplayName(avto, tx('Vozilo', 'Vehicle'))
            return (
              <button
                key={avto.id}
                onClick={() => preklopAvto(avto)}
                className={`rounded-2xl border p-1.5 text-left transition-all ${liteStatusStyle[status].border} ${liteStatusStyle[status].bg} ${active ? `ring-2 ${liteStatusStyle[status].ring}` : ''}`}
                aria-label={ime}
              >
                <div className="aspect-[4/3] overflow-hidden rounded-xl bg-[#11111d]">
                  {slikaVozila(avto) ? (
                    <img src={slikaVozila(avto)} alt={ime} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center px-2 text-center text-xs font-black text-white">{ime}</div>
                  )}
                </div>
                <p className="mt-1 truncate px-1 text-[11px] font-bold text-white">{ime}</p>
              </button>
            )
          })}
        </div>

        <div className={`rounded-2xl border overflow-hidden mb-4 ${liteStatusStyle[aktivniStatus].border} bg-[#0f0f1a]`}>
          {slikaVozila(aktivniAvto) && <img src={slikaVozila(aktivniAvto)} alt={aktivnoIme} loading="lazy" decoding="async" className="h-40 w-full object-cover" />}
          <div className="p-5">
            <p className={`mb-2 text-xs font-black uppercase tracking-wider ${liteStatusStyle[aktivniStatus].text}`}>{statusOznaka(aktivniStatus)}</p>
            <h2 className="text-2xl font-black text-white">{aktivnoIme}</h2>
            <p className="mt-1 text-sm text-[#a0a0b8]">{[aktivniAvto.letnik, aktivniAvto.gorivo].filter(Boolean).join(' - ')}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          <a href={`/gorivo?car=${aktivniAvto.id}`} className="rounded-2xl bg-[#6c5cff] p-4 text-center font-black text-white shadow-lg shadow-[#6c5cff33]">
            <span className="block text-xs uppercase text-white/70">{tx('Gorivo', 'Fuel')}</span>
            {tx('Pregled', 'Overview')}
          </a>
          <a href={`/servis?car=${aktivniAvto.id}`} className="rounded-2xl bg-[#f59e0b] p-4 text-center font-black text-white shadow-lg shadow-[#f59e0b22]">
            <span className="block text-xs uppercase text-white/70">{tx('Servis', 'Service')}</span>
            {tx('Pregled', 'Overview')}
          </a>
          <a href={`/vnos-stroska?car=${aktivniAvto.id}`} className="rounded-2xl bg-[#20c7c7] p-4 text-center font-black text-[#061014]">
            <span className="block text-xs uppercase text-[#061014]/60">{tx('Stroški', 'Costs')}</span>
            + {tx('Strošek', 'Expense')}
          </a>
          <a href={`/opomniki?car=${aktivniAvto.id}`} className="rounded-2xl border border-[#2d2d44] bg-[#141421] p-4 text-center font-black text-white">
            <span className="block text-xs uppercase text-white/50">{tx('Opomniki', 'Reminders')}</span>
            + {tx('Opomnik', 'Reminder')}
          </a>
        </div>

        <div className="rounded-2xl border border-[#202033] bg-[#0f0f1a] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-wider text-[#8a8aa6]">{tx('Najbližji opomniki', 'Closest reminders')}</h3>
            <span className="text-xs text-[#6d6d86]">{opomniki.length}</span>
          </div>
          {prikazOpomnikov.length === 0 ? (
            <p className="rounded-xl border border-[#303040] bg-[#141421] p-4 text-sm font-bold text-[#a0a0b8]">{tx('To vozilo še nima opomnikov.', 'This vehicle has no reminders yet.')}</p>
          ) : (
            <div className="space-y-2">
              {prikazOpomnikov.map((op: any) => {
                const status = statusZaOpomnik(op, aktivniAvto)
                const dni = dniDo(op.datum)
                const km = op.km_opomnik && aktivniAvto?.km_trenutni ? op.km_opomnik - aktivniAvto.km_trenutni : null
                const vrednost = dni !== null ? `${dni} d` : km !== null ? `${km} km` : '-'
                return (
                  <div key={op.id} className={`flex items-center gap-3 rounded-xl border p-3 ${liteStatusStyle[status].border} ${liteStatusStyle[status].bg}`}>
                    <span className={`min-w-11 rounded-lg border px-2 py-1 text-center text-[10px] font-black ${liteStatusStyle[status].border} ${liteStatusStyle[status].text}`}>{tipBadge[op.tip] || 'REM'}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-white">{liteTipNaziv(op.tip)}</p>
                      <p className="truncate text-xs text-[#8a8aa6]">{op.datum ? new Date(op.datum).toLocaleDateString(datumLocale) : tx('KM opomnik', 'Mileage reminder')}</p>
                    </div>
                    <span className={`text-sm font-black ${liteStatusStyle[status].text}`}>{vrednost}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <HomeButton />
      </div>
    )
  }
  return (
    <div className="min-h-screen bg-[#080810] px-4 py-6 pb-24 xl:px-8">
      <div className="w-full max-w-none lg:mx-auto lg:max-w-6xl">

      <div className="flex items-center gap-3 mb-5">
        <BackButton href="/garaza" />
        <div>
          <h1 className="text-2xl font-bold text-white lg:text-3xl">
            Garage<span className="text-[#6c63ff]">Base</span>
          </h1>
          <p className="mt-1 hidden text-sm font-semibold text-[#8a8aa8] lg:block">{tx('Pregled izbranega vozila in hitre akcije.', 'Selected vehicle overview and quick actions.')}</p>
        </div>
      </div>

      {loading && avti.length === 0 && (
        <div className="space-y-4 animate-pulse">
          <div className="h-9 bg-[#13131f] border border-[#1e1e32] rounded-xl" />
          <div className="h-[260px] bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl" />
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map(i => <div key={i} className="h-20 bg-[#13131f] rounded-xl" />)}
          </div>
        </div>
      )}

      {!loading && avti.length === 0 ? (
        <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-8 text-center">
          <p className="text-5xl mb-4">🚗</p>
          <p className="text-white font-semibold text-lg mb-2">{tx('Dodaj prvi avto', 'Add your first vehicle')}</p>
          <p className="text-[#5a5a80] text-sm mb-6">{tx('Zacni z vnosom svojega vozila', 'Start by adding your vehicle')}</p>
          <button onClick={() => router.push('/dodaj-avto')}
            className="bg-[#6c63ff] text-white font-semibold px-8 py-3 rounded-xl hover:bg-[#5a52e0] transition-colors">
            + {tx('Dodaj avto', 'Add vehicle')}
          </button>
        </div>
      ) : (
        <>
          <div className="flex gap-2 mb-5 overflow-x-auto pb-1"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {avti.map((avto) => (
              <button key={avto.id} onClick={() => preklopAvto(avto)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                  aktivniAvto?.id === avto.id
                    ? 'bg-[#6c63ff22] border-[#6c63ff66] text-[#a09aff]'
                    : 'bg-transparent border-[#1e1e32] text-[#3a3a5a] hover:text-[#5a5a80]'
                }`}>
                {vehicleDisplayName(avto, tx('Vozilo', 'Vehicle'))}
              </button>
            ))}
            <button onClick={() => router.push('/dodaj-avto')}
              className="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold bg-transparent border border-dashed border-[#1e1e32] text-[#3a3a5a] hover:text-[#5a5a80] transition-all">
              + Dodaj
            </button>
          </div>

          {aktivniAvto && (
            <>
              <div key={`desktop-${aktivniAvto.id}`} className="hidden lg:grid grid-cols-[320px_minmax(0,1fr)] bg-gradient-to-br from-[#12111f] to-[#0b0b12] border border-[#2a2a40] rounded-[28px] overflow-hidden mb-6 shadow-2xl shadow-black/20">
                <div className="relative min-h-[300px] bg-[#07070d] border-r border-[#1e1e32] flex items-center justify-center p-4">
                  {slikaVozila(aktivniAvto) ? (
                    <img src={slikaVozila(aktivniAvto)} alt={vehicleDisplayName(aktivniAvto, tx('Vozilo', 'Vehicle'))}
                      loading="eager" decoding="async" className="h-full max-h-[300px] w-full rounded-2xl bg-[#111827] object-contain" />
                  ) : (
                    <div className="w-full h-full min-h-[300px] rounded-xl bg-gradient-to-br from-[#1a1630] to-[#080810] flex items-center justify-center text-6xl">
                      🚗
                    </div>
                  )}
                </div>

                <div className="p-7 flex flex-col gap-5">
                  <div className="flex justify-between items-start gap-6">
                    <div>
                      <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2">{tx('Izbrano vozilo', 'Selected vehicle')}</p>
                      <h2 className="text-white font-bold text-4xl leading-tight">
                        {vehicleDisplayName(aktivniAvto, tx('Vozilo', 'Vehicle'))}
                      </h2>
                      <p className="text-[#8080a0] text-base mt-3">
                        {[aktivniAvto.letnik, aktivniAvto.gorivo, aktivniAvto.barva].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    {aktivniAvto.tablica && (
                      <div className="flex flex-col items-center flex-shrink-0">
                        <div className="bg-[#003399] rounded-t-md px-2 py-1 flex items-center gap-1 w-full justify-center">
                          <span className="text-yellow-300 text-[8px]">★</span>
                          <span className="text-white text-[8px] font-bold tracking-wider">SI</span>
                        </div>
                        <div className="bg-white rounded-b-md px-4 py-2 border-2 border-[#003399] border-t-0">
                          <span className="text-black font-bold text-lg tracking-widest font-mono">
                            {aktivniAvto.tablica.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-[#13131f] border border-[#1e1e32] rounded-xl p-4">
                      <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2">{tx('Kilometri', 'Mileage')}</p>
                      <p className="text-white font-bold text-2xl">{aktivniAvto.km_trenutni ? aktivniAvto.km_trenutni.toLocaleString() : '-'} km</p>
                      {vinjetaLabel && (
                        <p className="mt-3 inline-flex rounded-full border border-[#16a34a66] bg-[#16a34a22] px-2.5 py-1 text-xs font-black text-[#4ade80]">
                          {vinjetaLabel}
                        </p>
                      )}
                    </div>
                    <button onClick={() => router.push('/gorivo?car=' + aktivniAvto.id)} className="bg-[#13131f] border border-[#1e1e32] rounded-xl p-4 text-left hover:border-[#3ecfcf] transition-all">
                      <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-3">{tx('Poraba', 'Consumption')}</p>
                      <div className="space-y-2">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-[#3ecfcf] text-xs font-bold uppercase">{tx('Skupaj', 'Total')}</span>
                          <span className="text-white font-bold text-lg">{consumptionText(renderPoraba.total)}</span>
                        </div>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-[#a09aff] text-xs font-bold uppercase">{tx('GarageBase vnosi', 'GarageBase entries')}</span>
                          <span className="text-[#c8c4ff] font-semibold">{consumptionText(renderPoraba.garageBase)}</span>
                        </div>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-[#86efac] text-xs font-bold uppercase">{tx('Uvozena zgodovina', 'Imported history')}</span>
                          <span className="text-[#bbf7d0] font-semibold">{consumptionText(renderPoraba.imported)}</span>
                        </div>
                      </div>
                    </button>
                    <button onClick={() => router.push('/stroski?car=' + aktivniAvto.id)} className="bg-[#13131f] border border-[#1e1e32] rounded-xl p-4 text-left hover:border-[#6c63ff] transition-all">
                      <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-3">{tx('Stroski', 'Costs')}</p>
                      <div className="space-y-2">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-[#3ecfcf] text-xs font-bold uppercase">{tx('Skupaj', 'Total')}</span>
                          <span className="text-white font-bold text-lg">{renderStroski.total > 0 ? formatMoney(renderStroski.total, valuta) : '-'}</span>
                        </div>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-[#a09aff] text-xs font-bold uppercase">{tx('GarageBase vnosi', 'GarageBase entries')}</span>
                          <span className="text-[#c8c4ff] font-semibold">{renderStroski.garageBase > 0 ? formatMoney(renderStroski.garageBase, valuta) : '-'}</span>
                        </div>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-[#86efac] text-xs font-bold uppercase">{tx('Uvozena zgodovina', 'Imported history')}</span>
                          <span className="text-[#bbf7d0] font-semibold">{renderStroski.imported > 0 ? formatMoney(renderStroski.imported, valuta) : '-'}</span>
                        </div>
                      </div>
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-auto">
                    <button onClick={() => router.push('/gorivo?car=' + aktivniAvto.id)} className="bg-[#13131f] border border-[#1e1e32] text-[#5a5a80] py-4 rounded-xl hover:border-[#3ecfcf] hover:text-[#3ecfcf] transition-all flex items-center justify-center gap-3 font-semibold"><span className="text-xl">⛽</span>{tx('Gorivo', 'Fuel')}</button>
                    <button onClick={() => router.push('/servis?car=' + aktivniAvto.id)} className="bg-[#13131f] border border-[#1e1e32] text-[#5a5a80] py-4 rounded-xl hover:border-[#f59e0b] hover:text-[#f59e0b] transition-all flex items-center justify-center gap-3 font-semibold"><span className="text-xl">🔧</span>{tx('Servis', 'Service')}</button>
                    <button onClick={() => router.push('/opomniki?car=' + aktivniAvto.id)} className="bg-[#13131f] border border-[#1e1e32] text-[#5a5a80] py-4 rounded-xl hover:border-[#6c63ff] hover:text-[#6c63ff] transition-all flex items-center justify-center gap-3 font-semibold"><span className="text-xl">🔔</span>{tx('Opomniki', 'Reminders')}</button>
                    <button onClick={() => router.push('/stroski?car=' + aktivniAvto.id)} className="bg-[#13131f] border border-[#1e1e32] text-[#5a5a80] py-4 rounded-xl hover:border-[#3ecfcf] hover:text-[#3ecfcf] transition-all flex items-center justify-center gap-3 font-semibold"><span className="text-xl">📊</span>{tx('Stroski', 'Costs')}</button>
                    <button onClick={() => router.push('/nastavitve-avta?car=' + aktivniAvto.id)} className="bg-[#13131f] border border-[#1e1e32] text-[#5a5a80] py-4 rounded-xl hover:border-[#5a5a80] hover:text-white transition-all flex items-center justify-center gap-3 font-semibold"><span className="text-xl">⚙️</span>{tx('Nastavitve', 'Settings')}</button>
                    <button onClick={() => router.push('/report?car=' + aktivniAvto.id)} className="bg-[#6c63ff22] border border-[#6c63ff55] text-[#a09aff] py-4 rounded-xl hover:border-[#6c63ff] transition-all flex items-center justify-center gap-3 font-semibold"><span className="text-xl">📄</span>Report</button>
                  </div>
                </div>
              </div>

              <div key={`mobile-${aktivniAvto.id}`} className="lg:hidden bg-gradient-to-br from-[#1a1630] to-[#0f0f1a] border border-[#2a2a40] rounded-2xl overflow-hidden mb-4">

                {slikaVozila(aktivniAvto) && (
                  <div className="relative h-36 overflow-hidden">
                    <img src={slikaVozila(aktivniAvto)} alt={vehicleDisplayName(aktivniAvto, tx('Vozilo', 'Vehicle'))}
                      loading="eager" decoding="async" className="h-full w-full bg-[#111827] object-contain object-center" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#1a1630] via-transparent to-transparent" />
                  </div>
                )}

                <div className="p-5 pb-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-white font-bold text-xl">
                        {vehicleDisplayName(aktivniAvto, tx('Vozilo', 'Vehicle'))}
                      </h2>
                      <p className="text-[#5a5a80] text-sm mt-1">
                        {[aktivniAvto.letnik, aktivniAvto.gorivo, aktivniAvto.barva].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    {aktivniAvto.tablica && (
                      <div className="flex flex-col items-center">
                        <div className="bg-[#003399] rounded-t-md px-1.5 py-0.5 flex items-center gap-1 w-full justify-center">
                          <span className="text-yellow-300 text-[7px]">★</span>
                          <span className="text-white text-[7px] font-bold tracking-wider">SI</span>
                        </div>
                        <div className="bg-white rounded-b-md px-3 py-1 border-2 border-[#003399] border-t-0">
                          <span className="text-black font-bold text-sm tracking-widest font-mono">
                            {aktivniAvto.tablica.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="px-5 pb-4 grid grid-cols-3 gap-2.5">
                  <button onClick={() => router.push(`/gorivo?car=${aktivniAvto.id}`)}
                    className="bg-[#13131f] border border-[#1e1e32] text-[#3ecfcf] py-3.5 rounded-2xl hover:border-[#3ecfcf] transition-all flex flex-col items-center gap-1.5">
                    <span className="text-2xl leading-none">⛽</span><span className="text-[12px] font-black text-[#d8d8e8]">{tx('Gorivo', 'Fuel')}</span>
                  </button>
                  <button onClick={() => router.push(`/servis?car=${aktivniAvto.id}`)}
                    className="bg-[#13131f] border border-[#1e1e32] text-[#f59e0b] py-3.5 rounded-2xl hover:border-[#f59e0b] transition-all flex flex-col items-center gap-1.5">
                    <span className="text-2xl leading-none">🔧</span><span className="text-[12px] font-black text-[#d8d8e8]">{tx('Servis', 'Service')}</span>
                  </button>
                  <button onClick={() => router.push(`/opomniki?car=${aktivniAvto.id}`)}
                    className="bg-[#13131f] border border-[#1e1e32] text-[#6c63ff] py-3.5 rounded-2xl hover:border-[#6c63ff] transition-all flex flex-col items-center gap-1.5">
                    <span className="text-2xl leading-none">🔔</span><span className="text-[12px] font-black text-[#d8d8e8]">{tx('Opomniki', 'Reminders')}</span>
                  </button>
                  <button onClick={() => router.push(`/stroski?car=${aktivniAvto.id}`)}
                    className="bg-[#13131f] border border-[#1e1e32] text-[#22c55e] py-3.5 rounded-2xl hover:border-[#22c55e] transition-all flex flex-col items-center gap-1.5">
                    <span className="text-2xl leading-none">📊</span><span className="text-[12px] font-black text-[#d8d8e8]">{tx('Stroski', 'Costs')}</span>
                  </button>
                  <button onClick={() => router.push(`/nastavitve-avta?car=${aktivniAvto.id}`)}
                    className="bg-[#13131f] border border-[#1e1e32] text-[#94a3b8] py-3.5 rounded-2xl hover:border-[#94a3b8] transition-all flex flex-col items-center gap-1.5">
                    <span className="text-2xl leading-none">⚙️</span><span className="text-[12px] font-black text-[#d8d8e8]">{tx('Nastavitve', 'Settings')}</span>
                  </button>
                  <button onClick={() => router.push(`/report?car=${aktivniAvto.id}`)}
                    className="bg-[#13131f] border border-[#6c63ff44] text-[#6c63ff] py-3.5 rounded-2xl hover:border-[#6c63ff] hover:bg-[#6c63ff22] transition-all flex flex-col items-center gap-1.5">
                    <span className="text-2xl leading-none">📄</span><span className="text-[12px] font-black text-[#d8d8e8]">Report</span>
                  </button>
                </div>

                {aktivniAvto.km_trenutni && (
                  <div className="mx-5 mb-4 bg-[#13131f] rounded-xl p-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-1">{tx('Trenutni km', 'Current mileage')}</p>
                        <p className="text-white font-bold text-2xl">{aktivniAvto.km_trenutni.toLocaleString()} km</p>
                        {vinjetaLabel && (
                          <p className="mt-2 inline-flex rounded-full border border-[#16a34a66] bg-[#16a34a22] px-2.5 py-1 text-[11px] font-black text-[#4ade80]">
                            {vinjetaLabel}
                          </p>
                        )}
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-[#1a1a2e] border border-[#2a2a40] flex items-center justify-center text-2xl">
                        🛣️
                      </div>
                    </div>
                  </div>
                )}

                {hasConsumptionBreakdown && (
                  <button
                    type="button"
                    onClick={() => router.push(`/gorivo?car=${aktivniAvto.id}`)}
                    className="mx-5 mb-4 w-[calc(100%-2.5rem)] rounded-2xl bg-[#13131f] p-4 text-left shadow-[0_16px_36px_rgba(0,0,0,0.22)] transition-transform active:scale-[0.99]"
                  >
                    <div className="mb-3 flex items-center gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#6c63ff22] text-2xl">⛽</span>
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#7d829a]">{tx('Poraba goriva', 'Fuel consumption')}</p>
                        <p className="text-sm font-semibold text-[#d8d8e8]">{tx('Pregled po viru vnosa', 'Breakdown by source')}</p>
                      </div>
                    </div>
                    {renderPoraba.imported !== null ? (
                      <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-xl border border-[#6c63ff66] bg-[#6c63ff22] p-3 shadow-[inset_4px_0_0_rgba(108,99,255,0.95)]">
                          <p className="text-[10px] font-black uppercase tracking-wider text-[#a09aff]">{tx('Naši vnosi', 'Our entries')}</p>
                          <p className="mt-1 text-lg font-black text-[#c8c4ff]">{consumptionText(renderPoraba.garageBase)}</p>
                        </div>
                        <div className="rounded-xl border border-[#16a34a66] bg-[#16a34a22] p-3 shadow-[inset_4px_0_0_rgba(22,163,74,0.95)]">
                          <p className="text-[10px] font-black uppercase tracking-wider text-[#86efac]">{tx('Uvoz', 'Import')}</p>
                          <p className="mt-1 text-lg font-black text-[#bbf7d0]">{consumptionText(renderPoraba.imported)}</p>
                        </div>
                        <div className="rounded-xl border border-[#2a2a40] bg-[#0f0f1a] p-3 shadow-[inset_4px_0_0_rgba(62,207,207,0.95)]">
                          <p className="text-[10px] font-black uppercase tracking-wider text-[#3ecfcf]">{tx('Skupaj', 'Total')}</p>
                          <p className="mt-1 text-lg font-black text-white">{consumptionText(renderPoraba.total)}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl bg-white/[0.08] p-4">
                        <p className="text-[10px] font-black uppercase tracking-wider text-[#3ecfcf]">{tx('Skupaj', 'Total')}</p>
                        <p className="mt-1 text-3xl font-black text-white">{consumptionText(renderPoraba.total ?? renderPoraba.garageBase)}</p>
                      </div>
                    )}
                  </button>
                )}

                {/* Kalkulator stroškov €/km */}
                {hasCostBreakdown && (
                  <div onClick={() => router.push(`/stroski?car=${aktivniAvto.id}`)} className="mx-5 mb-4 bg-[#13131f] rounded-xl p-4 cursor-pointer">
                    <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-3">{tx('Stroski vozila', 'Vehicle costs')}</p>
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-[#3ecfcf] text-xs mb-0.5">{tx('Skupaj', 'Total')}</p>
          <p className="text-white font-bold text-xl">{formatMoney(renderStroski.total, valuta)}</p>
                        <div className="mt-2 flex flex-col gap-1.5">
                          <p className="inline-flex w-fit rounded-full border border-[#6c63ff66] bg-[#6c63ff22] px-2.5 py-1 text-[11px] font-black text-[#a09aff]">
                            {tx('GarageBase vnosi', 'GarageBase entries')}: {renderStroski.garageBase > 0 ? formatMoney(renderStroski.garageBase, valuta) : '-'}
                          </p>
                          <p className="inline-flex w-fit rounded-full border border-[#16a34a66] bg-[#16a34a22] px-2.5 py-1 text-[11px] font-black text-[#4ade80]">
                            {tx('Uvozena zgodovina', 'Imported history')}: {renderStroski.imported > 0 ? formatMoney(renderStroski.imported, valuta) : '-'}
                          </p>
                        </div>
                      </div>
                      {renderStroski.naKm !== null && (
                        <div className="text-right">
                          <p className="text-[#5a5a80] text-xs mb-0.5">{tx('Cena na km', 'Cost per km')}</p>
          <p className="text-[#6c63ff] font-bold text-xl">{renderStroski.naKm.toFixed(3)} {znakValute}/km</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Opomniki z dni in km prikazom */}
              {opomniki.length > 0 && (
                <div className="mb-4">
                  <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-3">{tx('Opomniki', 'Reminders')}</p>
                  <div className="flex flex-col gap-2">
                    {opomniki.map((op) => {
                      const dni = dniDo(op.datum)
                      const preostaloKm = op.km_opomnik ? kmDo(op.km_opomnik) : null
                      const b = skupnaBarva(dni, preostaloKm)
                      return (
                        <div key={op.id} className={`${b.bg} border ${b.border} rounded-xl p-3.5`}>
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                              <span className="text-xl">{tipIkona[op.tip] || '🔔'}</span>
                              <p className="text-white text-sm font-semibold">{tipNaziv[op.tip] || op.tip}</p>
                            </div>
                          </div>

                          {/* Datum vrstica */}
                          {op.datum && (
                            <div className="flex justify-between items-center mt-2">
                              <p className="text-[#5a5a80] text-xs">
                                📅 {new Date(op.datum).toLocaleDateString('sl-SI')}
                              </p>
                              {dni !== null && (
                                <div className="text-right">
                                  {dni >= 0 ? (
                                    <p className={`${barvaZaDni(dni).text} font-bold text-lg leading-none`}>
                                      {dni} <span className="text-xs font-normal">dni</span>
                                    </p>
                                  ) : (
                                    <p className="text-[#ef4444] font-bold text-lg leading-none">
                                      +{Math.abs(dni)} <span className="text-xs font-normal">dni zamude</span>
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Km vrstica */}
                          {op.km_opomnik && preostaloKm !== null && (
                            <div className="flex justify-between items-center mt-1">
                              <p className="text-[#5a5a80] text-xs">
                                🛣️ pri {op.km_opomnik.toLocaleString()} km
                              </p>
                              <div className="text-right">
                                {preostaloKm >= 0 ? (
                                  <p className={`${barvaZaKm(preostaloKm).text} font-bold text-lg leading-none`}>
                                    {preostaloKm.toLocaleString()} <span className="text-xs font-normal">km še</span>
                                  </p>
                                ) : (
                                  <p className="text-[#ef4444] font-bold text-lg leading-none">
                                    +{Math.abs(preostaloKm).toLocaleString()} <span className="text-xs font-normal">km prekoračeno</span>
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      </div>
      <HomeButton />
    </div>
  )
}
