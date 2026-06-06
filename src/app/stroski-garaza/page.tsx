'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { BottomNav, BackButton } from '@/lib/nav'
import { useLanguage } from '@/lib/i18n'
import { type GarageBaseCurrency, currencySymbol, getCurrencyFromSettings } from '@/lib/currency'
import { buildVehicleStats } from '@/lib/vehicle-costs'
import { vehicleDisplayName } from '@/lib/vehicle-display'
import { GARAGE_CACHE_MAX_AGE_MS, GARAGE_CACHE_VERSION, imageUrlWithVersion, readGarageCache } from '@/lib/vehicle-cache'

const COSTS_GARAGE_CACHE_KEY = 'garagebase_stroski_garaza_cache_v4'
type CostSummary = { garageBase: number; imported: number; total: number }
type GarageCostCar = Record<string, unknown> & {
  id: string
  user_id?: string
  znamka?: string | null
  model?: string | null
  letnik?: number | string | null
  gorivo?: string | null
  slika_url?: string | null
  slika?: string | null
  slika_updated_at?: string | null
  updated_at?: string | null
  created_at?: string | null
  arhivirano?: boolean | null
}
type CostSourceRow = Record<string, unknown> & {
  car_id?: string
}

const emptyCostSummary = (): CostSummary => ({ garageBase: 0, imported: 0, total: 0 })

const normalizeCostSummary = (value: unknown): CostSummary => {
  if (typeof value === 'number') return { garageBase: value, imported: 0, total: value }
  const source = typeof value === 'object' && value ? value as Partial<CostSummary> : {}
  const garageBase = Number(source.garageBase || 0)
  const imported = Number(source.imported || 0)
  const total = Number(source.total || garageBase + imported || 0)
  return {
    garageBase: Number.isFinite(garageBase) ? garageBase : 0,
    imported: Number.isFinite(imported) ? imported : 0,
    total: Number.isFinite(total) ? total : 0,
  }
}

export default function StroškiGaraza() {
  const router = useRouter()
  const { language } = useLanguage()
  const tx = (sl: string, en: string) => language === 'en' ? en : sl
  const [avti, setAvti] = useState<GarageCostCar[]>([])
  const [stroski, setStroski] = useState<{ [key: string]: CostSummary }>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [valuta, setValuta] = useState<GarageBaseCurrency>('EUR')
  const slikaVozila = (avto: GarageCostCar) => {
    const rawUrl = avto?.slika_url || avto?.slika || ''
    if (!rawUrl) return ''
    return imageUrlWithVersion(rawUrl, avto?.slika_updated_at || avto?.updated_at || avto?.created_at || GARAGE_CACHE_VERSION)
  }

  useEffect(() => {
    const init = async () => {
      let hasUsableCache = false
      try {
        setLoadError('')
        setValuta(getCurrencyFromSettings())
        const parsedGarage = readGarageCache()
        if (parsedGarage) {
          const cachedCars = Array.isArray(parsedGarage.avti)
            ? (parsedGarage.avti as GarageCostCar[]).filter((car) => car?.arhivirano !== true)
            : []
          if (cachedCars.length > 0) {
            hasUsableCache = true
            setAvti(cachedCars)
            setLoading(false)
          }
        }

        const cachedCosts = localStorage.getItem(COSTS_GARAGE_CACHE_KEY)
        if (cachedCosts) {
          try {
            const parsed = JSON.parse(cachedCosts)
            const savedAt = Number(parsed?.savedAt || 0)
            const age = Date.now() - savedAt
            const fresh = Number.isFinite(age) && age >= 0 && age <= GARAGE_CACHE_MAX_AGE_MS
            if (fresh && parsed.stroski) {
              const normalized: { [key: string]: CostSummary } = {}
              Object.entries(parsed.stroski).forEach(([carId, value]) => {
                normalized[carId] = normalizeCostSummary(value)
              })
              setStroski(normalized)
            }
          } catch {}
        }

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { window.location.href = '/'; return }

        let { data: avtiData, error: avtiError } = await supabase
          .from('cars').select('*').eq('user_id', user.id)
          .or('arhivirano.is.null,arhivirano.eq.false')
          .order('vrstni_red', { ascending: true })
        if (avtiError) {
          const fallback = await supabase
            .from('cars').select('*').eq('user_id', user.id)
            .order('vrstni_red', { ascending: true })
          if (fallback.error) throw fallback.error
          avtiData = ((fallback.data || []) as GarageCostCar[]).filter((car) => car?.arhivirano !== true)
        }
        const cars = ((avtiData || []) as GarageCostCar[]).filter((car) => car?.arhivirano !== true)
        setAvti(cars)

        const stroskoviMap: { [key: string]: CostSummary } = {}
        for (const avto of cars) stroskoviMap[avto.id] = emptyCostSummary()

        if (cars.length > 0) {
          const ids = cars.map((avto) => avto.id)
          const [gorivoRes, servisiRes, expensesRes] = await Promise.all([
            supabase.from('fuel_logs').select('id,car_id,datum,km,litri,cena_skupaj,cena_na_liter,postaja,created_at,import_batch_id,source_owner_label,polni_rezervar').in('car_id', ids),
            supabase.from('service_logs').select('id,car_id,datum,km,cena,servis,opis,created_at,import_batch_id,source_owner_label').in('car_id', ids),
            supabase.from('expenses').select('id,car_id,datum,znesek,kategorija,opis,created_at,import_batch_id,source_owner_label').in('car_id', ids),
          ])
          const queryError = gorivoRes.error || servisiRes.error || expensesRes.error
          if (queryError) throw queryError

          for (const avto of cars) {
            const fuelRows = ((gorivoRes.data || []) as CostSourceRow[]).filter((row) => row.car_id === avto.id)
            const serviceRows = ((servisiRes.data || []) as CostSourceRow[]).filter((row) => row.car_id === avto.id)
            const expenseRows = ((expensesRes.data || []) as CostSourceRow[]).filter((row) => row.car_id === avto.id)
            const stats = buildVehicleStats(fuelRows, serviceRows, expenseRows, avto).costs
            stroskoviMap[avto.id] = {
              garageBase: stats.garageBase,
              imported: stats.imported,
              total: stats.total,
            }
          }
        }

        setStroski(stroskoviMap)
        localStorage.setItem('garagebase_garaza_cache', JSON.stringify({ version: GARAGE_CACHE_VERSION, avti: cars, arhiv: false, savedAt: Date.now() }))
        localStorage.setItem(COSTS_GARAGE_CACHE_KEY, JSON.stringify({ stroski: stroskoviMap, savedAt: Date.now() }))
      } catch (error) {
        console.warn('[GarageBase costs garage] load failed', error)
        setLoadError(hasUsableCache
          ? tx('Stroskov trenutno ni bilo mogoce posodobiti. Prikazani so zadnji shranjeni podatki.', 'Costs could not be updated right now. Showing the last saved data.')
          : tx('Stroskov trenutno ni bilo mogoce naloziti. Poskusi znova.', 'Costs could not be loaded right now. Try again.'))
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [language])

  const costForCar = (carId: string) => normalizeCostSummary(stroski[carId])
  const skupniGarageBase = avti.reduce((sum, avto) => sum + costForCar(avto.id).garageBase, 0)
  const skupniUvoz = avti.reduce((sum, avto) => sum + costForCar(avto.id).imported, 0)
  const skupniStrosek = avti.reduce((sum, avto) => sum + costForCar(avto.id).total, 0)
  const najdrazjeVozilo = [...avti].sort((a, b) => costForCar(b.id).total - costForCar(a.id).total)[0]
  const maxStrosek = Math.max(1, ...avti.map((avto) => costForCar(avto.id).total))

  return (
    <div className="min-h-screen bg-[#080810] flex flex-col pb-20">

      <div className="flex items-center gap-3 px-5 py-5 flex-shrink-0">
        <BackButton href="/garaza" />
        <h1 className="text-2xl font-bold text-white">📊 Stroški</h1>
      </div>

      {loadError && (
        <div className="mx-5 mb-4 rounded-2xl border border-[#f2a13a55] bg-[#f2a13a14] px-4 py-3 text-sm font-semibold text-[#f2a13a]">
          {loadError}
        </div>
      )}

      {loading && avti.length === 0 && (
        <div className="px-5 pb-4 space-y-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-[165px] rounded-2xl bg-[#0f0f1a] border border-[#1e1e32] overflow-hidden flex animate-pulse">
              <div className="w-1/2 bg-[#151527]" />
              <div className="w-1/2 p-4 space-y-3">
                <div className="h-5 bg-[#24243a] rounded w-3/4" />
                <div className="h-4 bg-[#1d1d30] rounded w-1/2" />
                <div className="h-8 bg-[#1d1d30] rounded mt-8" />
              </div>
            </div>
          ))}
        </div>
      )}

      {avti.length > 0 && (
        <div className="mx-auto hidden w-full max-w-5xl flex-1 px-0 xl:block">
          <div className="mb-7 grid grid-cols-3 gap-4">
            <button onClick={() => router.push('/vnos-stroska')} className="rounded-3xl border border-[#1e1e32] bg-[#0f0f1a] p-5 text-left shadow-xl shadow-black/10">
              <p className="text-sm font-black text-[#8a8aa8]">{tx('Skupni stroški', 'Total costs')}</p>
              <p className="mt-3 text-3xl font-black text-white">{skupniStrosek.toFixed(0)} {currencySymbol(valuta)}</p>
              <p className="mt-2 text-xs font-bold text-[#c8c4ff]">{tx('GarageBase vnosi', 'GarageBase entries')}: {skupniGarageBase.toFixed(0)} {currencySymbol(valuta)}</p>
              <p className="text-xs font-bold text-[#86efac]">{tx('Uvozena zgodovina', 'Imported history')}: {skupniUvoz.toFixed(0)} {currencySymbol(valuta)}</p>
            </button>
            <button onClick={() => najdrazjeVozilo && router.push(`/stroski?car=${najdrazjeVozilo.id}`)} className="rounded-3xl border border-[#1e1e32] bg-[#0f0f1a] p-5 text-left shadow-xl shadow-black/10">
              <p className="text-sm font-black text-[#8a8aa8]">{tx('Največ stroškov', 'Highest cost')}</p>
              <p className="mt-3 truncate text-2xl font-black text-white">{najdrazjeVozilo ? vehicleDisplayName(najdrazjeVozilo) : '-'}</p>
            </button>
            <button onClick={() => router.push('/garaza')} className="rounded-3xl border border-[#1e1e32] bg-[#0f0f1a] p-5 text-left shadow-xl shadow-black/10">
              <p className="text-sm font-black text-[#8a8aa8]">{tx('Vozil v pregledu', 'Vehicles in overview')}</p>
              <p className="mt-3 text-3xl font-black text-white">{avti.length}</p>
            </button>
          </div>

          <div className="rounded-[28px] border border-[#1e1e32] bg-[#0f0f1a] p-5 shadow-xl shadow-black/10">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-black text-white">{tx('Stroški po vozilih', 'Costs by vehicle')}</h2>
              <button onClick={() => router.push('/vnos-stroska')} className="rounded-2xl bg-[#6c63ff] px-5 py-3 text-sm font-black text-white shadow-lg shadow-[#6c63ff33]">
                + {tx('Dodaj strošek', 'Add expense')}
              </button>
            </div>
            <div className="space-y-3">
              {avti.map((avto) => {
                const summary = costForCar(avto.id)
                const cost = summary.total
                const width = Math.max(4, Math.round((cost / maxStrosek) * 100))
                return (
                  <button key={avto.id} onClick={() => router.push(`/stroski?car=${avto.id}`)} className="grid w-full grid-cols-[72px_minmax(0,1fr)_150px] items-center gap-4 rounded-2xl border border-[#1e1e32] bg-[#11111d] p-3 text-left transition-colors hover:border-[#6c63ff66]">
                    <div className="h-14 overflow-hidden rounded-xl bg-[#151527]">
                      {slikaVozila(avto) ? <img src={slikaVozila(avto)} alt={vehicleDisplayName(avto)} className="h-full w-full object-cover" loading="lazy" decoding="async" /> : null}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-base font-black text-white">{vehicleDisplayName(avto)}</p>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#24243a]">
                        <div className="h-full rounded-full bg-[#6c63ff]" style={{ width: `${width}%` }} />
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-black text-[#3ecfcf]">{cost.toFixed(0)} {currencySymbol(valuta)}</p>
                      <p className="text-xs font-semibold text-[#8a8aa8]">{tx('skupaj', 'total')}</p>
                      <p className="text-[11px] font-semibold text-[#c8c4ff]">GarageBase: {summary.garageBase.toFixed(0)} {currencySymbol(valuta)}</p>
                      {summary.imported > 0 && <p className="text-[11px] font-semibold text-[#86efac]">{tx('uvoz', 'import')}: {summary.imported.toFixed(0)} {currencySymbol(valuta)}</p>}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {!loading && avti.length === 0 && (
        <div className="flex-1 flex items-center justify-center px-5 text-center">
          <div>
            <p className="text-white font-semibold text-xl mb-2">{tx('Ni vozil', 'No vehicles')}</p>
            <p className="text-[#5a5a80] text-sm">{tx('Dodaj avto, da vidis stroske.', 'Add a vehicle to see costs.')}</p>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto xl:hidden">
        {avti.map((avto, index) => (
          <div key={avto.id} onClick={() => router.push(`/stroski?car=${avto.id}`)}
            className="relative cursor-pointer overflow-hidden bg-[#0f0f1a] border-t border-[#1a1a28] flex"
            style={{ height: '24dvh', minHeight: '165px', maxHeight: '210px' }}>
            <div className="relative w-1/2 h-full flex-shrink-0 overflow-hidden">
              {slikaVozila(avto) ? (
                <img src={slikaVozila(avto)} alt={vehicleDisplayName(avto)}
                  loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover object-center" />
              ) : (
                <div className={`absolute inset-0 ${index % 2 === 0 ? 'bg-gradient-to-br from-[#1a1630] via-[#13131f] to-[#080810]' : 'bg-gradient-to-br from-[#0f1a16] via-[#13131f] to-[#080810]'}`} />
              )}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#0f0f1a]/25" />
            </div>
            <div className="w-1/2 h-full p-3 flex flex-col justify-between border-l border-[#1e1e32] min-w-0">
              <div>
                <h2 className="text-white font-bold text-base leading-tight line-clamp-2">
                  {vehicleDisplayName(avto)}
                </h2>
                <p className="text-[#5a5a80] text-xs mt-1">{[avto.letnik, avto.gorivo].filter(Boolean).join(' · ')}</p>
              </div>
              <div className="text-right">
                    <p className="text-[#3ecfcf] font-bold text-xl">{costForCar(avto.id).total.toFixed(0)} {currencySymbol(valuta)}</p>
                <p className="text-[#5a5a80] text-xs">{tx('skupaj', 'total')}</p>
                <p className="text-[#c8c4ff] text-[11px]">GarageBase: {costForCar(avto.id).garageBase.toFixed(0)} {currencySymbol(valuta)}</p>
                {costForCar(avto.id).imported > 0 && <p className="text-[#86efac] text-[11px]">{tx('uvoz', 'import')}: {costForCar(avto.id).imported.toFixed(0)} {currencySymbol(valuta)}</p>}
              </div>
            </div>
          </div>
        ))}
      </div>

      <BottomNav aktivna="stroski" />
    </div>
  )
}
