'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BottomNav, BackButton } from '@/lib/nav'
import { useLanguage } from '@/lib/i18n'
import { type GarageBaseCurrency, currencySymbol, getCurrencyFromSettings } from '@/lib/currency'
import { buildVehicleStats } from '@/lib/vehicle-costs'
import { vehicleDisplayName } from '@/lib/vehicle-display'
import { GARAGE_CACHE_MAX_AGE_MS, GARAGE_CACHE_VERSION, imageUrlWithVersion, readGarageCache } from '@/lib/vehicle-cache'

const COSTS_GARAGE_CACHE_KEY = 'garagebase_stroski_garaza_cache_v2'

export default function StroškiGaraza() {
  const { language } = useLanguage()
  const tx = (sl: string, en: string) => language === 'en' ? en : sl
  const [avti, setAvti] = useState<any[]>([])
  const [stroski, setStroski] = useState<{ [key: string]: number }>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [valuta, setValuta] = useState<GarageBaseCurrency>('EUR')
  const slikaVozila = (avto: any) => {
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
            ? parsedGarage.avti.filter((car: any) => car?.arhivirano !== true)
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
            if (fresh && parsed.stroski) setStroski(parsed.stroski)
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
          avtiData = (fallback.data || []).filter((car: any) => car?.arhivirano !== true)
        }
        const cars = (avtiData || []).filter((car: any) => car?.arhivirano !== true)
        setAvti(cars)

        const stroskoviMap: { [key: string]: number } = {}
        for (const avto of cars) stroskoviMap[avto.id] = 0

        if (cars.length > 0) {
          const ids = cars.map((avto: any) => avto.id)
          const [gorivoRes, servisiRes, expensesRes] = await Promise.all([
            supabase.from('fuel_logs').select('car_id,cena_skupaj,litri,cena_na_liter,import_batch_id,source_owner_label,created_at').in('car_id', ids),
            supabase.from('service_logs').select('car_id,cena,import_batch_id,source_owner_label,created_at').in('car_id', ids),
            supabase.from('expenses').select('car_id,znesek,kategorija,import_batch_id,source_owner_label,created_at').in('car_id', ids),
          ])
          const queryError = gorivoRes.error || servisiRes.error || expensesRes.error
          if (queryError) throw queryError

          for (const avto of cars) {
            const fuelRows = (gorivoRes.data || []).filter((row: any) => row.car_id === avto.id)
            const serviceRows = (servisiRes.data || []).filter((row: any) => row.car_id === avto.id)
            const expenseRows = (expensesRes.data || []).filter((row: any) => row.car_id === avto.id)
            stroskoviMap[avto.id] = buildVehicleStats(fuelRows, serviceRows, expenseRows, avto).costs.garageBase
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

  const skupniStrosek = avti.reduce((sum, avto) => sum + (stroski[avto.id] || 0), 0)
  const najdrazjeVozilo = [...avti].sort((a, b) => (stroski[b.id] || 0) - (stroski[a.id] || 0))[0]
  const maxStrosek = Math.max(1, ...avti.map((avto) => stroski[avto.id] || 0))

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
            <button onClick={() => window.location.href = '/vnos-stroska'} className="rounded-3xl border border-[#1e1e32] bg-[#0f0f1a] p-5 text-left shadow-xl shadow-black/10">
              <p className="text-sm font-black text-[#8a8aa8]">{tx('Skupni stroški', 'Total costs')}</p>
              <p className="mt-3 text-3xl font-black text-white">{skupniStrosek.toFixed(0)} {currencySymbol(valuta)}</p>
            </button>
            <button onClick={() => najdrazjeVozilo && (window.location.href = `/stroski?car=${najdrazjeVozilo.id}`)} className="rounded-3xl border border-[#1e1e32] bg-[#0f0f1a] p-5 text-left shadow-xl shadow-black/10">
              <p className="text-sm font-black text-[#8a8aa8]">{tx('Največ stroškov', 'Highest cost')}</p>
              <p className="mt-3 truncate text-2xl font-black text-white">{najdrazjeVozilo ? vehicleDisplayName(najdrazjeVozilo) : '-'}</p>
            </button>
            <button onClick={() => window.location.href = '/garaza'} className="rounded-3xl border border-[#1e1e32] bg-[#0f0f1a] p-5 text-left shadow-xl shadow-black/10">
              <p className="text-sm font-black text-[#8a8aa8]">{tx('Vozil v pregledu', 'Vehicles in overview')}</p>
              <p className="mt-3 text-3xl font-black text-white">{avti.length}</p>
            </button>
          </div>

          <div className="rounded-[28px] border border-[#1e1e32] bg-[#0f0f1a] p-5 shadow-xl shadow-black/10">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-black text-white">{tx('Stroški po vozilih', 'Costs by vehicle')}</h2>
              <button onClick={() => window.location.href = '/vnos-stroska'} className="rounded-2xl bg-[#6c63ff] px-5 py-3 text-sm font-black text-white shadow-lg shadow-[#6c63ff33]">
                + {tx('Dodaj strošek', 'Add expense')}
              </button>
            </div>
            <div className="space-y-3">
              {avti.map((avto) => {
                const cost = stroski[avto.id] || 0
                const width = Math.max(4, Math.round((cost / maxStrosek) * 100))
                return (
                  <button key={avto.id} onClick={() => window.location.href = `/stroski?car=${avto.id}`} className="grid w-full grid-cols-[72px_minmax(0,1fr)_150px] items-center gap-4 rounded-2xl border border-[#1e1e32] bg-[#11111d] p-3 text-left transition-colors hover:border-[#6c63ff66]">
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
          <div key={avto.id} onClick={() => window.location.href = `/stroski?car=${avto.id}`}
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
                    <p className="text-[#3ecfcf] font-bold text-xl">{(stroski[avto.id] || 0).toFixed(0)} {currencySymbol(valuta)}</p>
                <p className="text-[#5a5a80] text-xs">{tx('skupaj', 'total')}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <BottomNav aktivna="stroski" />
    </div>
  )
}
