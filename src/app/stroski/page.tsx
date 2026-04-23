'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { HomeButton, BackButton } from '@/lib/nav'

export default function Stroski() {
  const [avto, setAvto] = useState<any>(null)
  const [gorivo, setGorivo] = useState<any[]>([])
  const [servisi, setServisi] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/'; return }
      const params = new URLSearchParams(window.location.search)
      const carId = params.get('car')
      if (!carId) { window.location.href = '/stroski-garaza'; return }
      const { data: avtoData } = await supabase.from('cars').select('*').eq('id', carId).single()
      setAvto(avtoData)
      const { data: gorivoData } = await supabase.from('fuel_logs').select('*').eq('car_id', carId)
      setGorivo(gorivoData || [])
      const { data: servisData } = await supabase.from('service_logs').select('*').eq('car_id', carId)
      setServisi(servisData || [])
      setLoading(false)
    }
    init()
  }, [])

  const skupajGorivo = gorivo.reduce((sum, v) => sum + (v.cena_skupaj || 0), 0)
  const skupajServis = servisi.reduce((sum, v) => sum + (v.cena || 0), 0)
  const skupajVse = skupajGorivo + skupajServis
  const kmPrevozeni = avto?.km_trenutni || 0
  const strosekNaKm = kmPrevozeni > 0 ? (skupajVse / kmPrevozeni).toFixed(3) : null

  if (loading) return <div className="min-h-screen bg-[#080810] flex items-center justify-center"><p className="text-[#5a5a80]">Nalaganje...</p></div>

  return (
    <div className="min-h-screen bg-[#080810] px-4 py-6 pb-24">
      <div className="flex items-center gap-3 mb-6">
        <BackButton href="/stroski-garaza" />
        <div>
          <h1 className="text-xl font-bold text-white">📊 Stroški</h1>
          {avto && <p className="text-[#5a5a80] text-xs">{avto.znamka} {avto.model}</p>}
        </div>
      </div>

      <div className="bg-[#0f0f1a] border border-[#6c63ff44] rounded-2xl p-6 mb-4">
        <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2">Skupni stroški</p>
        <p className="text-white font-bold text-4xl mb-1">{skupajVse.toFixed(2)} €</p>
        {strosekNaKm && <p className="text-[#5a5a80] text-sm">{strosekNaKm} €/km · {kmPrevozeni.toLocaleString()} km skupaj</p>}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-4">
          <p className="text-2xl mb-2">⛽</p>
          <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-1">Gorivo</p>
          <p className="text-white font-bold text-xl">{skupajGorivo.toFixed(2)} €</p>
          <p className="text-[#5a5a80] text-xs mt-1">{gorivo.length} tankanij</p>
        </div>
        <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-4">
          <p className="text-2xl mb-2">🔧</p>
          <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-1">Servisi</p>
          <p className="text-white font-bold text-xl">{skupajServis.toFixed(2)} €</p>
          <p className="text-[#5a5a80] text-xs mt-1">{servisi.length} servisov</p>
        </div>
      </div>

      <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-3">Zadnji vnosi</p>
      <div className="flex flex-col gap-3">
        {gorivo.slice(0, 3).map((v) => (
          <div key={v.id} className="bg-[#0f0f1a] border border-[#1e1e32] rounded-xl p-4 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <span className="text-lg">⛽</span>
              <div>
                <p className="text-white text-sm font-semibold">{new Date(v.datum).toLocaleDateString('sl-SI')}</p>
                <p className="text-[#5a5a80] text-xs">{v.litri} L · {v.km?.toLocaleString()} km</p>
              </div>
            </div>
            <p className="text-[#3ecfcf] font-semibold">{v.cena_skupaj?.toFixed(2) || '—'} €</p>
          </div>
        ))}
        {servisi.slice(0, 3).map((v) => (
          <div key={v.id} className="bg-[#0f0f1a] border border-[#1e1e32] rounded-xl p-4 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <span className="text-lg">🔧</span>
              <div>
                <p className="text-white text-sm font-semibold">{new Date(v.datum).toLocaleDateString('sl-SI')}</p>
                <p className="text-[#5a5a80] text-xs">{v.opis?.substring(0, 30)}...</p>
              </div>
            </div>
            <p className="text-[#f59e0b] font-semibold">{v.cena?.toFixed(2) || '—'} €</p>
          </div>
        ))}
        {gorivo.length === 0 && servisi.length === 0 && (
          <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-6 text-center">
            <p className="text-white font-semibold mb-1">Še ni vnosov</p>
          </div>
        )}
      </div>
      <HomeButton />
    </div>
  )
}