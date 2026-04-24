'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { HomeButton, BackButton } from '@/lib/nav'

export default function ZgodovinaServisa() {
  const [vnosi, setVnosi] = useState<any[]>([])
  const [avto, setAvto] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/'; return }
      const params = new URLSearchParams(window.location.search)
      const carId = params.get('car')
      if (!carId) { window.location.href = '/garaza'; return }
      const { data: avtoData } = await supabase.from('cars').select('*').eq('id', carId).single()
      setAvto(avtoData)
      const { data: servisi } = await supabase.from('service_logs').select('*').eq('car_id', carId).order('datum', { ascending: false })
      setVnosi(servisi || [])
      setLoading(false)
    }
    init()
  }, [])

  const skupajEurov = vnosi.reduce((sum, v) => sum + (v.cena || 0), 0)

  if (loading) return (
    <div className="min-h-screen bg-[#080810] flex items-center justify-center">
      <p className="text-[#5a5a80]">Nalaganje...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#080810] px-4 py-6 pb-24">

      <div className="flex items-center gap-3 mb-6">
        <BackButton />
        <div>
          <h1 className="text-xl font-bold text-white">🔧 Servisna knjiga</h1>
          {avto && <p className="text-[#5a5a80] text-xs">{avto.znamka} {avto.model}</p>}
        </div>
      </div>

      {vnosi.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-4">
            <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-1">Skupaj servisov</p>
            <p className="text-white font-bold text-xl">{vnosi.length}</p>
          </div>
          <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-4">
            <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-1">Skupaj strošek</p>
            <p className="text-white font-bold text-xl">{skupajEurov.toFixed(2)} €</p>
          </div>
        </div>
      )}

      <button onClick={() => window.location.href = `/vnos-servisa?car=${avto?.id}`}
        className="w-full bg-[#f59e0b] hover:bg-[#d97706] text-white font-semibold py-3 rounded-xl transition-colors mb-6">
        + Dodaj servis
      </button>

      {vnosi.length === 0 ? (
        <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-6 text-center">
          <p className="text-4xl mb-3">🔧</p>
          <p className="text-white font-semibold mb-1">Še ni servisov</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {vnosi.map((vnos) => {
            const imaSlike = vnos.foto_url && vnos.foto_url.length > 0
            const jeNaknaden = vnos.opis?.includes('[Naknadno vnešeno:')
            const opisBrezOznake = vnos.opis?.replace(/\s*\[Naknadno vnešeno:.*?\]/, '') || ''

            return (
              <div key={vnos.id}
                onClick={() => window.location.href = `/servis-detajl?id=${vnos.id}&car=${avto?.id}`}
                className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-4 cursor-pointer hover:border-[#f59e0b33] transition-colors active:scale-[0.99]">

                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-white font-semibold">
                        {new Date(vnos.datum).toLocaleDateString('sl-SI')}
                      </p>
                      {jeNaknaden && (
                        <span className="text-[#f59e0b] text-xs bg-[#f59e0b22] px-1.5 py-0.5 rounded-md">⚠️ naknadno</span>
                      )}
                    </div>
                    <p className="text-[#5a5a80] text-xs mt-0.5">
                      {vnos.km?.toLocaleString()} km{vnos.servis && ` · ${vnos.servis}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {imaSlike && <span className="text-[#5a5a80] text-sm">📎</span>}
                    {vnos.cena && <span className="text-[#f59e0b] font-bold">{vnos.cena.toFixed(2)} €</span>}
                  </div>
                </div>

                <div className="bg-[#13131f] rounded-xl p-3 mt-2">
                  <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-1">Opravljeno delo</p>
                  <p className="text-white text-sm">{opisBrezOznake}</p>
                </div>

                <p className="text-[#3a3a5a] text-xs mt-2 text-right">Tapni za detajle →</p>
              </div>
            )
          })}
        </div>
      )}

      <HomeButton />
    </div>
  )
}