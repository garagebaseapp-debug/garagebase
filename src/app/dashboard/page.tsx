'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { HomeButton, BackButton } from '@/lib/nav'
import { type GarageBaseCurrency, currencySymbol, formatMoney } from '@/lib/currency'
import { getStoredLanguage, type Language } from '@/lib/i18n'

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
const DASHBOARD_BUILD = 'dashboard-2026-05-11-1500'

const numberValue = (value: unknown) => {
  const parsed = Number(String(value ?? '').replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : 0
}

const isImportedDashboardRow = (row: any) => {
  const rawText = `${row?.opis || ''} ${row?.postaja || ''} ${row?.kategorija || ''}`
  return Boolean(
    row?.import_batch_id ||
    row?.source_owner_label ||
    /\[(?:Drivvo|CSV|Naknadno|Prejsnji lastnik|Previous owner|IMPORTED HISTORY)/i.test(rawText)
  )
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

const averageConsumption = (rows: any[]) => {
  const sorted = rows
    .filter((row) => numberValue(row.km) > 0 && numberValue(row.litri) > 0)
    .sort((a, b) => numberValue(a.km) - numberValue(b.km))

  if (sorted.length < 2) return null

  let distance = 0
  let liters = 0
  for (let i = 1; i < sorted.length; i++) {
    const diff = numberValue(sorted[i].km) - numberValue(sorted[i - 1].km)
    if (diff <= 0) continue
    distance += diff
    liters += numberValue(sorted[i].litri)
  }

  return distance > 0 ? (liters / distance) * 100 : null
}

const dashboardConsumption = (rows: any[]) => averageConsumption(rows) ?? averageKnownConsumption(rows)

export default function Dashboard() {
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
  const [debugStats, setDebugStats] = useState({ fuel: 0, service: 0, expense: 0, liters: 0, cost: 0 })
  const tx = (sl: string, en: string) => (jezik === 'en' ? en : sl)
  const datumLocale = jezik === 'en' ? 'en-US' : 'sl-SI'
  const znakValute = currencySymbol(valuta)
  const hasConsumptionBreakdown = poraba.total !== null || poraba.garageBase !== null || poraba.imported !== null
  const hasCostBreakdown = stroski.total > 0 || stroski.garageBase > 0 || stroski.imported > 0
  const consumptionText = (value: number | null) => value !== null ? `${value.toFixed(1)} L/100` : '-'

  useEffect(() => {
    const init = async () => {
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
      const cached = localStorage.getItem('garagebase_garaza_cache')
      if (cached) {
        try {
          const parsed = JSON.parse(cached)
          if (Array.isArray(parsed.avti) && parsed.avti.length > 0) {
            setAvti(parsed.avti)
            const cachedCar = carIdFromUrl
              ? parsed.avti.find((a: any) => a.id === carIdFromUrl) || parsed.avti[0]
              : parsed.avti[0]
            setAktivniAvto(cachedCar)
            setLoading(false)
          }
        } catch {}
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/'; return }
      const started = performance.now()
      const { data: avtiData } = await supabase
        .from('cars').select('*').eq('user_id', user.id)
        .order('vrstni_red', { ascending: true })
      const cars = avtiData || []
      setAvti(cars)
      const previousGarageCache = localStorage.getItem('garagebase_garaza_cache')
      let previousOpomniki = {}
      try { previousOpomniki = previousGarageCache ? JSON.parse(previousGarageCache).opomniki || {} : {} } catch {}
      localStorage.setItem('garagebase_garaza_cache', JSON.stringify({ avti: cars, opomniki: previousOpomniki, savedAt: Date.now() }))
      if (cars.length > 0) {
        const izbrani = carIdFromUrl
          ? cars.find((a: any) => a.id === carIdFromUrl) || cars[0]
          : cars[0]
        setAktivniAvto(izbrani)
        setLoading(false)
        if (jeLite) await naloziLitePodatke(cars.map((a: any) => a.id), izbrani.id)
        await naloziPodatke(izbrani.id, izbrani.km_trenutni || 0, izbrani.km_ob_vnosu || 0)
      }
      console.info(`[GarageBase speed] dashboard cars ${Math.round(performance.now() - started)}ms, cars ${cars.length}`)
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
    const started = performance.now()
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
      localStorage.setItem(`garagebase_dashboard_cache_${id}`, JSON.stringify({ opomniki: opData, savedAt: Date.now() }))
    })

    setLiteOpomnikiPoAvtu(completeGrouped)
    if (selectedId) setOpomniki(completeGrouped[selectedId] || [])
    console.info(`[GarageBase speed] lite dashboard ${Math.round(performance.now() - started)}ms, cars ${ids.length}`)
  }

  const naloziStatistikoVozila = async (carId: string, kmStart: number = 0, kmObVnosu: number = 0) => {
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token

    if (token) {
      try {
        const response = await fetch(`/api/vehicle-stats?car=${encodeURIComponent(carId)}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        })
        const payload = await response.json()
        if (response.ok && payload?.ok && payload?.stats) {
          const stats = payload.stats
          const nextPoraba = {
            garageBase: stats.consumption?.garageBase ?? null,
            imported: stats.consumption?.imported ?? null,
            total: stats.consumption?.total ?? null,
          }
          const nextStroski = {
            garageBase: numberValue(stats.costs?.garageBase),
            imported: numberValue(stats.costs?.imported),
            total: numberValue(stats.costs?.total),
            naKm: stats.costs?.perKm ?? null,
          }
          setDebugStats({
            fuel: numberValue(stats.rows?.fuel),
            service: numberValue(stats.rows?.service),
            expense: numberValue(stats.rows?.expense),
            liters: numberValue(stats.liters),
            cost: numberValue(stats.costs?.total),
          })
          setPoraba(nextPoraba)
          setStroski(nextStroski)
          localStorage.setItem(`garagebase_vehicle_stats_${carId}`, JSON.stringify({
            fuelCost: numberValue(stats.costs?.fuel),
            serviceCost: numberValue(stats.costs?.service),
            expenseCost: numberValue(stats.costs?.expense),
            fuelLiters: numberValue(stats.liters),
            fuelRows: numberValue(stats.rows?.fuel),
            consumption: nextPoraba,
            costs: nextStroski,
            savedAt: Date.now(),
          }))
          return { poraba: nextPoraba, stroski: nextStroski, fuelRows: [] }
        }
        console.warn('[GarageBase dashboard] server statistics failed', payload?.error)
      } catch (error) {
        console.warn('[GarageBase dashboard] server statistics unavailable', error)
      }
    }

    const [fuelRes, serviceRes, expenseRes] = await Promise.all([
      supabase
        .from('fuel_logs')
        .select('km,litri,cena_skupaj')
        .eq('car_id', carId)
        .order('km', { ascending: true }),
      supabase
        .from('service_logs')
        .select('cena')
        .eq('car_id', carId),
      supabase
        .from('expenses')
        .select('znesek')
        .eq('car_id', carId),
    ])

    if (fuelRes.error || serviceRes.error || expenseRes.error) {
      console.warn('[GarageBase dashboard] statistics fetch failed', fuelRes.error?.message, serviceRes.error?.message, expenseRes.error?.message)
    }

    const fuelRows = fuelRes.data || []
    const serviceRows = serviceRes.data || []
    const expenseRows = expenseRes.data || []
    const debugLiters = fuelRows.reduce((sum: number, row: any) => sum + numberValue(row.litri), 0)
    const debugFuelCost = fuelRows.reduce((sum: number, row: any) => sum + numberValue(row.cena_skupaj), 0)
    const debugServiceCost = serviceRows.reduce((sum: number, row: any) => sum + numberValue(row.cena), 0)
    const debugExpenseCost = expenseRows.reduce((sum: number, row: any) => sum + numberValue(row.znesek), 0)
    setDebugStats({
      fuel: fuelRows.length,
      service: serviceRows.length,
      expense: expenseRows.length,
      liters: debugLiters,
      cost: debugFuelCost + debugServiceCost + debugExpenseCost,
    })
    const importedFuel: any[] = []
    const garageBaseFuel = fuelRows
    const nextPoraba = {
      garageBase: dashboardConsumption(garageBaseFuel),
      imported: dashboardConsumption(importedFuel),
      total: dashboardConsumption(fuelRows),
    }
    const costOf = (rows: any[], key: string) => rows.reduce((sum: number, row: any) => sum + numberValue(row[key]), 0)
    const garageBaseCosts = costOf(garageBaseFuel, 'cena_skupaj') + costOf(serviceRows, 'cena') + costOf(expenseRows, 'znesek')
    const importedCosts = 0
    const totalCosts = garageBaseCosts + importedCosts
    const kmPrevozeni = kmStart - kmObVnosu
    const nextStroski = {
      garageBase: garageBaseCosts,
      imported: importedCosts,
      total: totalCosts,
      naKm: kmPrevozeni > 0 ? totalCosts / kmPrevozeni : null,
    }
    setPoraba(nextPoraba)
    setStroski(nextStroski)
    return { poraba: nextPoraba, stroski: nextStroski, fuelRows }
  }

  const naloziPodatke = async (carId: string, avtoKmStart: number = 0, kmObVnosu: number = 0) => {
    const cached = localStorage.getItem(`garagebase_dashboard_cache_${carId}`)
    if (cached) {
      try {
        const parsed = JSON.parse(cached)
        if (Array.isArray(parsed.opomniki)) setOpomniki(parsed.opomniki)
        if (parsed.poraba) {
          setPoraba('total' in parsed.poraba
            ? parsed.poraba
            : { ...emptyConsumption, total: parsed.poraba.skupaj ?? null }
          )
        }
        if (parsed.stroski) {
          setStroski('total' in parsed.stroski
            ? parsed.stroski
            : { ...emptyCosts, total: parsed.stroski.skupaj || 0, naKm: parsed.stroski.naKm ?? null }
          )
        }
      } catch {}
    }
    const cachedStats = localStorage.getItem(`garagebase_vehicle_stats_${carId}`)
    if (cachedStats) {
      try {
        const parsed = JSON.parse(cachedStats)
        const cachedCostTotal = numberValue(parsed.fuelCost) + numberValue(parsed.serviceCost) + numberValue(parsed.expenseCost)
        if (cachedCostTotal > 0) setStroski({ garageBase: cachedCostTotal, imported: 0, total: cachedCostTotal, naKm: null })
      } catch {}
    }

    const started = performance.now()
    const [opRes] = await Promise.all([
      supabase.from('reminders').select('*').eq('car_id', carId).order('datum', { ascending: true }),
    ])

    const opData = opRes.data || []
    setOpomniki(opData)

    const stats = await naloziStatistikoVozila(carId, avtoKmStart, kmObVnosu)
    const nextPoraba = stats.poraba
    const nextStroski = stats.stroski
    localStorage.setItem(`garagebase_dashboard_cache_${carId}`, JSON.stringify({ opomniki: opData, poraba: nextPoraba, stroski: nextStroski, savedAt: Date.now() }))
    console.info(`[GarageBase speed] dashboard data ${Math.round(performance.now() - started)}ms`)
  }
  const preklopAvto = async (avto: any) => {
    setAktivniAvto(avto)
    setPoraba(emptyConsumption)
    setStroski(emptyCosts)
    if (nacin === 'lite') {
      const cachedOpomniki = liteOpomnikiPoAvtu[avto.id]
      if (cachedOpomniki) setOpomniki(cachedOpomniki)
      else await naloziLitePodatke(avti.map((a: any) => a.id), avto.id)
    }
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

  if (nacin === 'lite' && aktivniAvto) {
    const aktivniStatus = statusZaAvto(aktivniAvto)
    const aktivnoIme = `${aktivniAvto.znamka || ''} ${aktivniAvto.model || ''}`.trim() || tx('Vozilo', 'Vehicle')
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
            const ime = `${avto.znamka || ''} ${avto.model || ''}`.trim() || tx('Vozilo', 'Vehicle')
            return (
              <button
                key={avto.id}
                onClick={() => preklopAvto(avto)}
                className={`rounded-2xl border p-1.5 text-left transition-all ${liteStatusStyle[status].border} ${liteStatusStyle[status].bg} ${active ? `ring-2 ${liteStatusStyle[status].ring}` : ''}`}
                aria-label={ime}
              >
                <div className="aspect-[4/3] overflow-hidden rounded-xl bg-[#11111d]">
                  {avto.slika_url ? (
                    <img src={avto.slika_url} alt={ime} loading="lazy" decoding="async" className="h-full w-full object-cover" />
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
          {(aktivniAvto.slika_url || aktivniAvto.slika) && <img src={aktivniAvto.slika_url || aktivniAvto.slika} alt={aktivnoIme} loading="lazy" decoding="async" className="h-40 w-full object-cover" />}
          <div className="p-5">
            <p className={`mb-2 text-xs font-black uppercase tracking-wider ${liteStatusStyle[aktivniStatus].text}`}>{statusOznaka(aktivniStatus)}</p>
            <h2 className="text-2xl font-black text-white">{aktivnoIme}</h2>
            <p className="mt-1 text-sm text-[#a0a0b8]">{[aktivniAvto.letnik, aktivniAvto.gorivo].filter(Boolean).join(' - ')}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          <a href={`/vnos-goriva?car=${aktivniAvto.id}`} className="rounded-2xl bg-[#6c5cff] p-4 text-center font-black text-white shadow-lg shadow-[#6c5cff33]">
            <span className="block text-xs uppercase text-white/70">{tx('Gorivo', 'Fuel')}</span>
            + {tx('Tankanje', 'Fill-up')}
          </a>
          <a href={`/vnos-servisa?car=${aktivniAvto.id}`} className="rounded-2xl bg-[#f59e0b] p-4 text-center font-black text-white shadow-lg shadow-[#f59e0b22]">
            <span className="block text-xs uppercase text-white/70">{tx('Servis', 'Service')}</span>
            + {tx('Servis', 'Service')}
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
    <div className="min-h-screen bg-[#080810] px-4 py-6 pb-24">

      <div className="flex items-center gap-3 mb-5">
        <BackButton href="/garaza" />
        <h1 className="text-2xl font-bold text-white">
          Garage<span className="text-[#6c63ff]">Base</span>
        </h1>
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
          <p className="text-white font-semibold text-lg mb-2">Dodaj prvi avto</p>
          <p className="text-[#5a5a80] text-sm mb-6">Začni z vnosom svojega vozila</p>
          <button onClick={() => window.location.href = '/dodaj-avto'}
            className="bg-[#6c63ff] text-white font-semibold px-8 py-3 rounded-xl hover:bg-[#5a52e0] transition-colors">
            + Dodaj avto
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
                {avto.znamka.charAt(0).toUpperCase() + avto.znamka.slice(1)} {avto.model.toUpperCase()}
              </button>
            ))}
            <button onClick={() => window.location.href = '/dodaj-avto'}
              className="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold bg-transparent border border-dashed border-[#1e1e32] text-[#3a3a5a] hover:text-[#5a5a80] transition-all">
              + Dodaj
            </button>
          </div>

          {aktivniAvto && (
            <>
              <div className="hidden lg:grid grid-cols-[minmax(340px,0.9fr)_minmax(520px,1.1fr)] bg-gradient-to-br from-[#12111f] to-[#0b0b12] border border-[#2a2a40] rounded-2xl overflow-hidden mb-6">
                <div className="relative min-h-[360px] bg-[#07070d] border-r border-[#1e1e32] flex items-center justify-center p-6">
                  {aktivniAvto.slika_url ? (
                    <img src={aktivniAvto.slika_url} alt="Avto"
                      loading="eager" decoding="async" className="max-w-full max-h-[330px] object-contain rounded-xl" />
                  ) : (
                    <div className="w-full h-full min-h-[300px] rounded-xl bg-gradient-to-br from-[#1a1630] to-[#080810] flex items-center justify-center text-6xl">
                      🚗
                    </div>
                  )}
                </div>

                <div className="p-8 flex flex-col gap-6">
                  <div className="flex justify-between items-start gap-6">
                    <div>
                      <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2">Izbrano vozilo</p>
                      <h2 className="text-white font-bold text-4xl leading-tight">
                        {aktivniAvto.znamka.charAt(0).toUpperCase() + aktivniAvto.znamka.slice(1)}{' '}
                        {aktivniAvto.model.toUpperCase()}
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

                  <div className="grid grid-cols-[0.9fr_1.25fr_1.25fr] gap-3">
                    <div className="bg-[#13131f] border border-[#1e1e32] rounded-xl p-4">
                      <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2">{tx('Kilometri', 'Mileage')}</p>
                      <p className="text-white font-bold text-2xl">{aktivniAvto.km_trenutni ? aktivniAvto.km_trenutni.toLocaleString() : '-'} km</p>
                    </div>
                    <div className="bg-[#13131f] border border-[#1e1e32] rounded-xl p-4">
                      <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-3">{tx('Poraba', 'Consumption')}</p>
                      <div className="space-y-2">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-[#3ecfcf] text-xs font-bold uppercase">{tx('Skupaj', 'Total')}</span>
                          <span className="text-white font-bold text-lg">{consumptionText(poraba.total)}</span>
                        </div>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-[#a09aff] text-xs font-bold uppercase">{tx('GarageBase vnosi', 'GarageBase entries')}</span>
                          <span className="text-[#c8c4ff] font-semibold">{consumptionText(poraba.garageBase)}</span>
                        </div>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-[#86efac] text-xs font-bold uppercase">{tx('Uvozena zgodovina', 'Imported history')}</span>
                          <span className="text-[#bbf7d0] font-semibold">{consumptionText(poraba.imported)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="bg-[#13131f] border border-[#1e1e32] rounded-xl p-4">
                      <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-3">{tx('Stroski', 'Costs')}</p>
                      <div className="space-y-2">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-[#3ecfcf] text-xs font-bold uppercase">{tx('Skupaj', 'Total')}</span>
                          <span className="text-white font-bold text-lg">{stroski.total > 0 ? formatMoney(stroski.total, valuta) : '-'}</span>
                        </div>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-[#a09aff] text-xs font-bold uppercase">{tx('GarageBase vnosi', 'GarageBase entries')}</span>
                          <span className="text-[#c8c4ff] font-semibold">{stroski.garageBase > 0 ? formatMoney(stroski.garageBase, valuta) : '-'}</span>
                        </div>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-[#86efac] text-xs font-bold uppercase">{tx('Uvozena zgodovina', 'Imported history')}</span>
                          <span className="text-[#bbf7d0] font-semibold">{stroski.imported > 0 ? formatMoney(stroski.imported, valuta) : '-'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="text-[#5a5a80] text-[10px]">
                    {DASHBOARD_BUILD} · fuel/service/expense: {debugStats.fuel}/{debugStats.service}/{debugStats.expense} · L {debugStats.liters.toFixed(2)} · {znakValute} {debugStats.cost.toFixed(2)}
                  </p>

                  <div className="grid grid-cols-3 gap-3 mt-auto">
                    <button onClick={() => window.location.href = '/zgodovina-goriva?car=' + aktivniAvto.id} className="bg-[#13131f] border border-[#1e1e32] text-[#5a5a80] py-4 rounded-xl hover:border-[#3ecfcf] hover:text-[#3ecfcf] transition-all flex items-center justify-center gap-3 font-semibold"><span className="text-xl">⛽</span>Gorivo</button>
                    <button onClick={() => window.location.href = '/zgodovina-servisa?car=' + aktivniAvto.id} className="bg-[#13131f] border border-[#1e1e32] text-[#5a5a80] py-4 rounded-xl hover:border-[#f59e0b] hover:text-[#f59e0b] transition-all flex items-center justify-center gap-3 font-semibold"><span className="text-xl">🔧</span>Servis</button>
                    <button onClick={() => window.location.href = '/opomniki?car=' + aktivniAvto.id} className="bg-[#13131f] border border-[#1e1e32] text-[#5a5a80] py-4 rounded-xl hover:border-[#6c63ff] hover:text-[#6c63ff] transition-all flex items-center justify-center gap-3 font-semibold"><span className="text-xl">🔔</span>Opomniki</button>
                    <button onClick={() => window.location.href = '/stroski?car=' + aktivniAvto.id} className="bg-[#13131f] border border-[#1e1e32] text-[#5a5a80] py-4 rounded-xl hover:border-[#3ecfcf] hover:text-[#3ecfcf] transition-all flex items-center justify-center gap-3 font-semibold"><span className="text-xl">📊</span>Stroški</button>
                    <button onClick={() => window.location.href = '/nastavitve-avta?car=' + aktivniAvto.id} className="bg-[#13131f] border border-[#1e1e32] text-[#5a5a80] py-4 rounded-xl hover:border-[#5a5a80] hover:text-white transition-all flex items-center justify-center gap-3 font-semibold"><span className="text-xl">⚙️</span>Nastavitve</button>
                    <button onClick={() => window.location.href = '/report?car=' + aktivniAvto.id} className="bg-[#6c63ff22] border border-[#6c63ff55] text-[#a09aff] py-4 rounded-xl hover:border-[#6c63ff] transition-all flex items-center justify-center gap-3 font-semibold"><span className="text-xl">📄</span>Report</button>
                  </div>
                </div>
              </div>

              <div className="lg:hidden bg-gradient-to-br from-[#1a1630] to-[#0f0f1a] border border-[#2a2a40] rounded-2xl overflow-hidden mb-4">

                {aktivniAvto.slika_url && (
                  <div className="relative h-36 overflow-hidden">
                    <img src={aktivniAvto.slika_url} alt="Avto"
                      loading="eager" decoding="async" className="w-full h-full object-cover object-center" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#1a1630] via-transparent to-transparent" />
                  </div>
                )}

                <div className="p-5 pb-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-white font-bold text-xl">
                        {aktivniAvto.znamka.charAt(0).toUpperCase() + aktivniAvto.znamka.slice(1)}{' '}
                        {aktivniAvto.model.toUpperCase()}
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

                {aktivniAvto.km_trenutni && (
                  <div className="mx-5 mb-4 bg-[#13131f] rounded-xl p-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-1">Trenutni km</p>
                        <p className="text-white font-bold text-2xl">{aktivniAvto.km_trenutni.toLocaleString()} km</p>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-[#1a1a2e] border border-[#2a2a40] flex items-center justify-center text-2xl">
                        🛣️
                      </div>
                    </div>
                  </div>
                )}

                {hasConsumptionBreakdown && (
                  <div className="mx-5 mb-4 grid grid-cols-1 gap-3">
                    {poraba.total !== null && (
                      <div className="bg-[#13131f] rounded-xl p-3">
                        <p className="text-[#3ecfcf] text-xs uppercase tracking-wider mb-1">{tx('Skupaj', 'Total')}</p>
                        <p className="text-white font-bold text-lg">{poraba.total.toFixed(1)} <span className="text-[#5a5a80] text-xs font-normal">L/100</span></p>
                      </div>
                    )}
                    {poraba.garageBase !== null && (
                      <div className="bg-[#13131f] rounded-xl p-3">
                        <p className="text-[#a09aff] text-xs uppercase tracking-wider mb-1">{tx('GarageBase vnosi', 'GarageBase entries')}</p>
                        <p className="text-[#c8c4ff] font-bold text-lg">{poraba.garageBase.toFixed(1)} <span className="text-[#5a5a80] text-xs font-normal">L/100</span></p>
                      </div>
                    )}
                    {poraba.imported !== null && (
                      <div className="bg-[#13131f] rounded-xl p-3">
                        <p className="text-[#86efac] text-xs uppercase tracking-wider mb-1">{tx('Uvozena zgodovina', 'Imported history')}</p>
                        <p className="text-[#bbf7d0] font-bold text-lg">{poraba.imported.toFixed(1)} <span className="text-[#5a5a80] text-xs font-normal">L/100</span></p>
                      </div>
                    )}
                  </div>
                )}

                {/* Kalkulator stroškov €/km */}
                {hasCostBreakdown && (
                  <div className="mx-5 mb-4 bg-[#13131f] rounded-xl p-4">
                    <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-3">{tx('Stroski vozila', 'Vehicle costs')}</p>
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-[#3ecfcf] text-xs mb-0.5">{tx('Skupaj', 'Total')}</p>
          <p className="text-white font-bold text-xl">{formatMoney(stroski.total, valuta)}</p>
                        <p className="text-[#a09aff] text-xs mt-1">{tx('GarageBase vnosi', 'GarageBase entries')}: {stroski.garageBase > 0 ? formatMoney(stroski.garageBase, valuta) : '-'}</p>
                        <p className="text-[#86efac] text-xs">{tx('Uvozena zgodovina', 'Imported history')}: {stroski.imported > 0 ? formatMoney(stroski.imported, valuta) : '-'}</p>
                      </div>
                      {stroski.naKm !== null && (
                        <div className="text-right">
                          <p className="text-[#5a5a80] text-xs mb-0.5">{tx('Cena na km', 'Cost per km')}</p>
          <p className="text-[#6c63ff] font-bold text-xl">{stroski.naKm.toFixed(3)} {znakValute}/km</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <p className="mx-5 mb-4 text-[#5a5a80] text-[10px]">
                  {DASHBOARD_BUILD} · fuel/service/expense: {debugStats.fuel}/{debugStats.service}/{debugStats.expense} · L {debugStats.liters.toFixed(2)} · {znakValute} {debugStats.cost.toFixed(2)}
                </p>

                <div className="px-5 pb-5 grid grid-cols-6 gap-2">
                  <button onClick={() => window.location.href = `/zgodovina-goriva?car=${aktivniAvto.id}`}
                    className="bg-[#13131f] border border-[#1e1e32] text-[#5a5a80] text-base py-3 rounded-xl hover:border-[#3ecfcf] hover:text-[#3ecfcf] transition-all flex flex-col items-center gap-1">
                    <span>⛽</span><span className="text-[11px]">Gorivo</span>
                  </button>
                  <button onClick={() => window.location.href = `/zgodovina-servisa?car=${aktivniAvto.id}`}
                    className="bg-[#13131f] border border-[#1e1e32] text-[#5a5a80] text-base py-3 rounded-xl hover:border-[#f59e0b] hover:text-[#f59e0b] transition-all flex flex-col items-center gap-1">
                    <span>🔧</span><span className="text-[11px]">Servis</span>
                  </button>
                  <button onClick={() => window.location.href = `/opomniki?car=${aktivniAvto.id}`}
                    className="bg-[#13131f] border border-[#1e1e32] text-[#5a5a80] text-base py-3 rounded-xl hover:border-[#6c63ff] hover:text-[#6c63ff] transition-all flex flex-col items-center gap-1">
                    <span>🔔</span><span className="text-[11px]">Opomniki</span>
                  </button>
                  <button onClick={() => window.location.href = `/stroski?car=${aktivniAvto.id}`}
                    className="bg-[#13131f] border border-[#1e1e32] text-[#5a5a80] text-base py-3 rounded-xl hover:border-[#3ecfcf] hover:text-[#3ecfcf] transition-all flex flex-col items-center gap-1">
                    <span>📊</span><span className="text-[11px]">Stroški</span>
                  </button>
                  <button onClick={() => window.location.href = `/nastavitve-avta?car=${aktivniAvto.id}`}
                    className="bg-[#13131f] border border-[#1e1e32] text-[#5a5a80] text-base py-3 rounded-xl hover:border-[#5a5a80] hover:text-white transition-all flex flex-col items-center gap-1">
                    <span>⚙️</span><span className="text-[11px]">Nastavitve</span>
                  </button>
                  <button onClick={() => window.location.href = `/report?car=${aktivniAvto.id}`}
                    className="bg-[#13131f] border border-[#6c63ff44] text-[#6c63ff] text-base py-3 rounded-xl hover:border-[#6c63ff] hover:bg-[#6c63ff22] transition-all flex flex-col items-center gap-1">
                    <span>📄</span><span className="text-[11px]">Report</span>
                  </button>
                </div>
              </div>

              {/* Opomniki z dni in km prikazom */}
              {opomniki.length > 0 && (
                <div className="mb-4">
                  <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-3">Opomniki</p>
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

      <HomeButton />
    </div>
  )
}
