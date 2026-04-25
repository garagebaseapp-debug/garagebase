'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { HomeButton, BackButton } from '@/lib/nav'

export default function Stroski() {
  const [avto, setAvto] = useState<any>(null)
  const [gorivo, setGorivo] = useState<any[]>([])
  const [servisi, setServisi] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'vse' | 'gorivo' | 'servis' | 'ostalo'>('vse')

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/'; return }
      const params = new URLSearchParams(window.location.search)
      const carId = params.get('car')
      if (!carId) { window.location.href = '/stroski-garaza'; return }
      const { data: avtoData } = await supabase.from('cars').select('*').eq('id', carId).single()
      setAvto(avtoData)
      const { data: gorivoData } = await supabase.from('fuel_logs').select('*').eq('car_id', carId).order('datum', { ascending: false })
      setGorivo(gorivoData || [])
      const { data: servisData } = await supabase.from('service_logs').select('*').eq('car_id', carId).order('datum', { ascending: false })
      setServisi(servisData || [])
      const { data: expensesData } = await supabase.from('expenses').select('*').eq('car_id', carId).order('datum', { ascending: false })
      setExpenses((expensesData || []).filter((e: any) => e.kategorija !== 'km_sprememba'))
      setLoading(false)
    }
    init()
  }, [])

  const skupajGorivo = gorivo.reduce((sum, v) => sum + (v.cena_skupaj || 0), 0)
  const skupajServis = servisi.reduce((sum, v) => sum + (v.cena || 0), 0)
  const skupajExpenses = expenses.reduce((sum, v) => sum + (v.znesek || 0), 0)
  const skupajVse = skupajGorivo + skupajServis + skupajExpenses
  const kmPrevozeni = avto?.km_trenutni || 0
  const strosekNaKm = kmPrevozeni > 0 ? (skupajVse / kmPrevozeni).toFixed(3) : null

  const kategorijaIkona: { [key: string]: string } = {
    registracija: '📋', vinjeta: '🛣️', zavarovanje: '🛡️', gume: '⚫',
    tehnicni: '🔍', izredno: '🔨', lizing: '🏦'
  }

  // Združeni vnosi za filter
  const vsiVnosi = [
    ...gorivo.map(v => ({ ...v, _tip: 'gorivo' })),
    ...servisi.map(v => ({ ...v, _tip: 'servis' })),
    ...expenses.map(v => ({ ...v, _tip: 'ostalo' })),
  ].sort((a, b) => new Date(b.datum).getTime() - new Date(a.datum).getTime())

  const filtrirani = vsiVnosi.filter(v => filter === 'vse' || v._tip === filter)

  if (loading) return (
    <div className="min-h-screen bg-[#080810] flex items-center justify-center">
      <p className="text-[#5a5a80]">Nalaganje...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#080810] px-4 py-6 pb-24">

      <div className="flex items-center gap-3 mb-6">
        <BackButton href="/stroski-garaza" />
        <div>
          <h1 className="text-xl font-bold text-white">📊 Stroški</h1>
          {avto && <p className="text-[#5a5a80] text-xs">{avto.znamka} {avto.model}</p>}
        </div>
      </div>

      {/* Skupaj */}
      <div className="bg-[#0f0f1a] border border-[#6c63ff44] rounded-2xl p-6 mb-4">
        <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2">Skupni stroški</p>
        <p className="text-white font-bold text-4xl mb-1">{skupajVse.toFixed(2)} €</p>
        {strosekNaKm && <p className="text-[#5a5a80] text-sm">{strosekNaKm} €/km · {kmPrevozeni.toLocaleString()} km skupaj</p>}
      </div>

      {/* Razčlenitev — klikabilna */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <button onClick={() => setFilter(filter === 'gorivo' ? 'vse' : 'gorivo')}
          className={`rounded-2xl p-3 border transition-all text-left ${filter === 'gorivo' ? 'bg-[#3ecfcf22] border-[#3ecfcf66]' : 'bg-[#0f0f1a] border-[#1e1e32]'}`}>
          <p className="text-2xl mb-2">⛽</p>
          <p className={`text-xs uppercase tracking-wider mb-1 ${filter === 'gorivo' ? 'text-[#3ecfcf]' : 'text-[#5a5a80]'}`}>Gorivo</p>
          <p className={`font-bold text-lg ${filter === 'gorivo' ? 'text-[#3ecfcf]' : 'text-white'}`}>{skupajGorivo.toFixed(0)} €</p>
          <p className="text-[#5a5a80] text-xs">{gorivo.length}x</p>
        </button>
        <button onClick={() => setFilter(filter === 'servis' ? 'vse' : 'servis')}
          className={`rounded-2xl p-3 border transition-all text-left ${filter === 'servis' ? 'bg-[#f59e0b22] border-[#f59e0b66]' : 'bg-[#0f0f1a] border-[#1e1e32]'}`}>
          <p className="text-2xl mb-2">🔧</p>
          <p className={`text-xs uppercase tracking-wider mb-1 ${filter === 'servis' ? 'text-[#f59e0b]' : 'text-[#5a5a80]'}`}>Servisi</p>
          <p className={`font-bold text-lg ${filter === 'servis' ? 'text-[#f59e0b]' : 'text-white'}`}>{skupajServis.toFixed(0)} €</p>
          <p className="text-[#5a5a80] text-xs">{servisi.length}x</p>
        </button>
        <button onClick={() => setFilter(filter === 'ostalo' ? 'vse' : 'ostalo')}
          className={`rounded-2xl p-3 border transition-all text-left ${filter === 'ostalo' ? 'bg-[#6c63ff22] border-[#6c63ff66]' : 'bg-[#0f0f1a] border-[#1e1e32]'}`}>
          <p className="text-2xl mb-2">💰</p>
          <p className={`text-xs uppercase tracking-wider mb-1 ${filter === 'ostalo' ? 'text-[#a09aff]' : 'text-[#5a5a80]'}`}>Ostalo</p>
          <p className={`font-bold text-lg ${filter === 'ostalo' ? 'text-[#a09aff]' : 'text-white'}`}>{skupajExpenses.toFixed(0)} €</p>
          <p className="text-[#5a5a80] text-xs">{expenses.length}x</p>
        </button>
      </div>

      {/* Dodaj strošek gumb */}
      <button onClick={() => window.location.href = `/vnos-stroska?car=${avto?.id}`}
        className="w-full bg-[#3ecfcf] hover:bg-[#2eb8b8] text-black font-semibold py-3 rounded-xl transition-colors mb-4">
        + Dodaj strošek
      </button>

      {/* Filter oznaka */}
      {filter !== 'vse' && (
        <div className="flex items-center justify-between mb-3">
          <p className="text-[#5a5a80] text-xs uppercase tracking-wider">
            Filtrirano: {filter === 'gorivo' ? '⛽ Gorivo' : filter === 'servis' ? '🔧 Servisi' : '💰 Ostalo'}
          </p>
          <button onClick={() => setFilter('vse')} className="text-[#6c63ff] text-xs">
            Počisti filter ✕
          </button>
        </div>
      )}

      {/* Združeni seznam */}
      <div className="flex flex-col gap-3">
        {filtrirani.length === 0 ? (
          <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-6 text-center">
            <p className="text-white font-semibold mb-1">Ni vnosov</p>
          </div>
        ) : (
          filtrirani.map((v, i) => {
            if (v._tip === 'gorivo') return (
              <div key={`g-${v.id}`} className="bg-[#0f0f1a] border border-[#1e1e32] rounded-xl p-4 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className="text-lg">⛽</span>
                  <div>
                    <p className="text-white text-sm font-semibold">{new Date(v.datum).toLocaleDateString('sl-SI')}</p>
                    <p className="text-[#5a5a80] text-xs">{v.litri} L · {v.km?.toLocaleString()} km{v.postaja ? ` · ${v.postaja}` : ''}</p>
                  </div>
                </div>
                <p className="text-[#3ecfcf] font-semibold">{v.cena_skupaj?.toFixed(2) || '—'} €</p>
              </div>
            )
            if (v._tip === 'servis') return (
              <div key={`s-${v.id}`} className="bg-[#0f0f1a] border border-[#1e1e32] rounded-xl p-4 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className="text-lg">🔧</span>
                  <div>
                    <p className="text-white text-sm font-semibold">{new Date(v.datum).toLocaleDateString('sl-SI')}</p>
                    <p className="text-[#5a5a80] text-xs">{v.opis?.replace(/\s*\[Naknadno.*?\]/, '').substring(0, 35)}{v.servis ? ` · ${v.servis}` : ''}</p>
                  </div>
                </div>
                <p className="text-[#f59e0b] font-semibold">{v.cena?.toFixed(2) || '—'} €</p>
              </div>
            )
            return (
              <div key={`e-${v.id}`} className="bg-[#0f0f1a] border border-[#1e1e32] rounded-xl p-4 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{kategorijaIkona[v.kategorija] || '💰'}</span>
                  <div>
                    <p className="text-white text-sm font-semibold capitalize">{v.kategorija}</p>
                    <p className="text-[#5a5a80] text-xs">{new Date(v.datum).toLocaleDateString('sl-SI')}</p>
                    {v.opis && <p className="text-[#5a5a80] text-xs mt-0.5">{v.opis}</p>}
                  </div>
                </div>
                <p className="text-[#a09aff] font-semibold">{v.znesek?.toFixed(2)} €</p>
              </div>
            )
          })
        )}
      </div>

      <HomeButton />
    </div>
  )
}