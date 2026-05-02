'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { HomeButton, BackButton } from '@/lib/nav'
import { type GarageBaseCurrency, formatMoney, getCurrencyFromSettings } from '@/lib/currency'

export default function ServisDetajl() {
  const [servis, setServis] = useState<any>(null)
  const [avto, setAvto] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [odprtaSlika, setOdprtaSlika] = useState<string | null>(null)
  const [valuta, setValuta] = useState<GarageBaseCurrency>('EUR')

  useEffect(() => {
    const init = async () => {
      setValuta(getCurrencyFromSettings())
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/'; return }

      const params = new URLSearchParams(window.location.search)
      const servisId = params.get('id')
      const carId = params.get('car')

      if (!servisId || !carId) { window.location.href = '/garaza'; return }

      const { data: servisData } = await supabase
        .from('service_logs').select('*').eq('id', servisId).single()
      setServis(servisData)

      const { data: avtoData } = await supabase
        .from('cars').select('*').eq('id', carId).single()
      setAvto(avtoData)

      setLoading(false)
    }
    init()
  }, [])

  if (loading) return (
    <div className="min-h-screen bg-[#080810] flex items-center justify-center">
      <p className="text-[#5a5a80]">Nalaganje...</p>
    </div>
  )

  if (!servis) return (
    <div className="min-h-screen bg-[#080810] flex items-center justify-center">
      <p className="text-[#5a5a80]">Servis ni najden</p>
    </div>
  )

  const slike = servis.foto_url ? servis.foto_url.split(',').filter(Boolean) : []
  const jeNaknaden = servis.opis?.includes('[Naknadno vnešeno:')
  const opisBrezOznake = servis.opis?.replace(/\s*\[Naknadno vnešeno:.*?\]/, '') || ''
  const datumVnosa = servis.opis?.match(/\[Naknadno vnešeno: (.*?)\]/)?.[1] || null

  return (
    <div className="min-h-screen bg-[#080810] px-4 py-6 pb-24">

      {/* Lightbox */}
      {odprtaSlika && (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4"
          onClick={() => setOdprtaSlika(null)}>
          <img src={odprtaSlika} alt="Račun"
            className="max-w-full max-h-full object-contain rounded-xl" />
          <button className="absolute top-4 right-4 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white text-xl"
            onClick={() => setOdprtaSlika(null)}>✕</button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <BackButton href={`/zgodovina-servisa?car=${avto?.id}`} />
        <div>
          <h1 className="text-xl font-bold text-white">🔧 Detajli servisa</h1>
          {avto && <p className="text-[#5a5a80] text-xs">{avto.znamka} {avto.model}</p>}
        </div>
      </div>

      {/* Naknadno opozorilo */}
      {jeNaknaden && (
        <div className="bg-[#f59e0b22] border border-[#f59e0b44] rounded-xl p-3 mb-4 flex items-center gap-2">
          <span>⚠️</span>
          <p className="text-[#f59e0b] text-xs">Naknadno vnešen servis — datum vnosa: {datumVnosa}</p>
        </div>
      )}

      {/* Glavna kartica */}
      <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5 mb-4">

        {/* Datum in cena */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-white font-bold text-xl">
              {new Date(servis.datum).toLocaleDateString('sl-SI')}
            </p>
            <p className="text-[#5a5a80] text-sm mt-1">
              {servis.km?.toLocaleString()} km
            </p>
          </div>
          {servis.cena && (
            <div className="text-right">
              <p className="text-[#f59e0b] font-bold text-2xl">{formatMoney(servis.cena, valuta)}</p>
            </div>
          )}
        </div>

        {/* Servis ime */}
        {servis.servis && (
          <div className="bg-[#13131f] rounded-xl p-3 mb-3">
            <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-1">Servis</p>
            <p className="text-white text-sm font-semibold">{servis.servis}</p>
          </div>
        )}

        {/* Opis dela */}
        <div className="bg-[#13131f] rounded-xl p-3 mb-3">
          <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-1">Opravljeno delo</p>
          <p className="text-white text-sm">{opisBrezOznake}</p>
        </div>

      </div>

      {/* Slike računov */}
      {slike.length > 0 && (
        <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5 mb-4">
          <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-3">
            📎 Računi ({slike.length})
          </p>
          <div className="grid grid-cols-3 gap-3">
            {slike.map((url: string, index: number) => (
              <div key={index} onClick={() => setOdprtaSlika(url)}
                className="relative rounded-xl overflow-hidden aspect-square cursor-pointer hover:opacity-80 transition-opacity border border-[#2a2a40]">
                <img src={url} alt={`Račun ${index + 1}`}
                  className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                  <span className="text-white text-2xl">🔍</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {slike.length === 0 && (
        <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5 mb-4 text-center">
          <p className="text-[#3a3a5a] text-sm">Ni priloženih računov</p>
        </div>
      )}

      <HomeButton />
    </div>
  )
}
