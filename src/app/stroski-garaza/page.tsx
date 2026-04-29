'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BottomNav, BackButton } from '@/lib/nav'

export default function StroškiGaraza() {
  const [avti, setAvti] = useState<any[]>([])
  const [stroski, setStroski] = useState<{ [key: string]: number }>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      const cachedGarage = localStorage.getItem('garagebase_garaza_cache')
      if (cachedGarage) {
        try {
          const parsed = JSON.parse(cachedGarage)
          if (Array.isArray(parsed.avti)) {
            setAvti(parsed.avti)
            setLoading(false)
          }
        } catch {}
      }

      const cachedCosts = localStorage.getItem('garagebase_stroski_garaza_cache')
      if (cachedCosts) {
        try {
          const parsed = JSON.parse(cachedCosts)
          if (parsed.stroski) setStroski(parsed.stroski)
        } catch {}
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/'; return }

      const started = performance.now()
      const { data: avtiData } = await supabase.from('cars').select('*').eq('user_id', user.id).order('vrstni_red', { ascending: true })
      const cars = avtiData || []
      setAvti(cars)

      const stroskoviMap: { [key: string]: number } = {}
      for (const avto of cars) stroskoviMap[avto.id] = 0

      if (cars.length > 0) {
        const ids = cars.map((avto: any) => avto.id)
        const [gorivoRes, servisiRes] = await Promise.all([
          supabase.from('fuel_logs').select('car_id,cena_skupaj').in('car_id', ids),
          supabase.from('service_logs').select('car_id,cena').in('car_id', ids),
        ])

        for (const row of gorivoRes.data || []) {
          stroskoviMap[row.car_id] = (stroskoviMap[row.car_id] || 0) + (row.cena_skupaj || 0)
        }
        for (const row of servisiRes.data || []) {
          stroskoviMap[row.car_id] = (stroskoviMap[row.car_id] || 0) + (row.cena || 0)
        }
      }

      setStroski(stroskoviMap)
      localStorage.setItem('garagebase_garaza_cache', JSON.stringify({ avti: cars, savedAt: Date.now() }))
      localStorage.setItem('garagebase_stroski_garaza_cache', JSON.stringify({ stroski: stroskoviMap, savedAt: Date.now() }))
      console.info(`[GarageBase speed] stroski-garaza load ${Math.round(performance.now() - started)}ms, cars ${cars.length}`)
      setLoading(false)
    }
    init()
  }, [])
  return (
    <div className="min-h-screen bg-[#080810] flex flex-col pb-20">

      <div className="flex items-center gap-3 px-5 py-5 flex-shrink-0">
        <BackButton href="/garaza" />
        <h1 className="text-2xl font-bold text-white">📊 Stroški</h1>
      </div>

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

      {!loading && avti.length === 0 && (
        <div className="flex-1 flex items-center justify-center px-5 text-center">
          <div>
            <p className="text-white font-semibold text-xl mb-2">Ni vozil</p>
            <p className="text-[#5a5a80] text-sm">Dodaj avto, da vidiš stroške.</p>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {avti.map((avto, index) => (
          <div key={avto.id} onClick={() => window.location.href = `/stroski?car=${avto.id}`}
            className="relative cursor-pointer overflow-hidden bg-[#0f0f1a] border-t border-[#1a1a28] flex"
            style={{ height: '24dvh', minHeight: '165px', maxHeight: '210px' }}>
            <div className="relative w-1/2 h-full flex-shrink-0 overflow-hidden">
              {avto.slika_url ? (
                <img src={avto.slika_url} alt={`${avto.znamka} ${avto.model}`}
                  loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover object-center" />
              ) : (
                <div className={`absolute inset-0 ${index % 2 === 0 ? 'bg-gradient-to-br from-[#1a1630] via-[#13131f] to-[#080810]' : 'bg-gradient-to-br from-[#0f1a16] via-[#13131f] to-[#080810]'}`} />
              )}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#0f0f1a]/25" />
            </div>
            <div className="w-1/2 h-full p-3 flex flex-col justify-between border-l border-[#1e1e32] min-w-0">
              <div>
                <h2 className="text-white font-bold text-base leading-tight line-clamp-2">
                  {avto.znamka.charAt(0).toUpperCase() + avto.znamka.slice(1)}{' '}{avto.model.toUpperCase()}
                </h2>
                <p className="text-[#5a5a80] text-xs mt-1">{[avto.letnik, avto.gorivo].filter(Boolean).join(' · ')}</p>
              </div>
              <div className="text-right">
                <p className="text-[#3ecfcf] font-bold text-xl">{(stroski[avto.id] || 0).toFixed(0)} €</p>
                <p className="text-[#5a5a80] text-xs">skupaj</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <BottomNav aktivna="stroski" />
    </div>
  )
}