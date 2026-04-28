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
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/'; return }
      const { data: avtiData } = await supabase.from('cars').select('*').eq('user_id', user.id).order('vrstni_red', { ascending: true })
      if (avtiData && avtiData.length > 0) {
        setAvti(avtiData)
        const stroskoviMap: { [key: string]: number } = {}
        for (const avto of avtiData) {
          const { data: gorivo } = await supabase.from('fuel_logs').select('cena_skupaj').eq('car_id', avto.id)
          const { data: servisi } = await supabase.from('service_logs').select('cena').eq('car_id', avto.id)
          const skupajGorivo = (gorivo || []).reduce((s: number, v: any) => s + (v.cena_skupaj || 0), 0)
          const skupajServis = (servisi || []).reduce((s: number, v: any) => s + (v.cena || 0), 0)
          stroskoviMap[avto.id] = skupajGorivo + skupajServis
        }
        setStroski(stroskoviMap)
      }
      setLoading(false)
    }
    init()
  }, [])

  if (loading) return (
    <div className="min-h-screen bg-[#080810] flex items-center justify-center">
      <p className="text-[#5a5a80]">Nalaganje...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#080810] flex flex-col pb-20">

      <div className="flex items-center gap-3 px-5 py-5 flex-shrink-0">
        <BackButton href="/garaza" />
        <h1 className="text-2xl font-bold text-white">📊 Stroški</h1>
      </div>

      <div className="flex-1 overflow-y-auto">
        {avti.map((avto, index) => (
          <div key={avto.id} onClick={() => window.location.href = `/stroski?car=${avto.id}`}
            className="relative cursor-pointer overflow-hidden bg-[#0f0f1a] border-t border-[#1a1a28] flex"
            style={{ height: '24dvh', minHeight: '165px', maxHeight: '210px' }}>
            <div className="relative w-1/2 h-full flex-shrink-0 overflow-hidden">
              {avto.slika_url ? (
                <img src={avto.slika_url} alt={`${avto.znamka} ${avto.model}`}
                  className="absolute inset-0 w-full h-full object-cover object-center" />
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