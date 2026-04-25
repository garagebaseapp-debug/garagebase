'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { HomeButton, BackButton } from '@/lib/nav'

export default function ZgodovinaGoriva() {
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
      const { data: gorivo } = await supabase.from('fuel_logs').select('*').eq('car_id', carId).order('km', { ascending: true })
      setVnosi(gorivo || [])
      setLoading(false)
    }
    init()
  }, [])

  const izracunajPorabo = (index: number) => {
    const trenutni = vnosi[index]
    const prejsnjiKm = index === 0 ? (avto?.km_trenutni || 0) : vnosi[index - 1].km
    const kmRazlika = trenutni.km - prejsnjiKm
    if (kmRazlika <= 0) return null
    return (trenutni.litri / kmRazlika) * 100
  }

  const skupajLitrov = vnosi.reduce((sum, v) => sum + (v.litri || 0), 0)
  const skupajEurov = vnosi.reduce((sum, v) => sum + (v.cena_skupaj || 0), 0)

  const tipGorivaIkona = (tip: string) => {
    if (tip === '95') return { label: '95', bg: 'bg-[#16a34a]', text: 'text-white' }
    if (tip === '100') return { label: '100', bg: 'bg-[#2563eb]', text: 'text-white' }
    if (tip === 'diesel') return { label: 'D', bg: 'bg-[#333333]', text: 'text-[#aaaaaa]' }
    return null
  }

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
          <h1 className="text-xl font-bold text-white">⛽ Gorivo</h1>
          {avto && <p className="text-[#5a5a80] text-xs">{avto.znamka} {avto.model}</p>}
        </div>
      </div>

      {vnosi.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-3">
            <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-1">Litrov</p>
            <p className="text-white font-bold text-lg">{skupajLitrov.toFixed(0)}<span className="text-[#5a5a80] text-xs font-normal"> L</span></p>
          </div>
          <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-3">
            <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-1">Skupaj</p>
            <p className="text-white font-bold text-lg">{skupajEurov.toFixed(0)}<span className="text-[#5a5a80] text-xs font-normal"> €</span></p>
          </div>
          <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-3">
            <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-1">Tankanij</p>
            <p className="text-white font-bold text-lg">{vnosi.length}</p>
          </div>
        </div>
      )}

      <button onClick={() => window.location.href = `/vnos-goriva?car=${avto?.id}`}
        className="w-full bg-[#6c63ff] hover:bg-[#5a52e0] text-white font-semibold py-3 rounded-xl transition-colors mb-6">
        + Dodaj tankanje
      </button>

      {vnosi.length === 0 ? (
        <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-6 text-center">
          <p className="text-4xl mb-3">⛽</p>
          <p className="text-white font-semibold mb-1">Še ni tankanij</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {[...vnosi].reverse().map((vnos, reversedIndex) => {
            const index = vnosi.length - 1 - reversedIndex
            const poraba = izracunajPorabo(index)
            const tipIkona = tipGorivaIkona(vnos.tip_goriva)
            return (
              <div key={vnos.id} className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    {/* Tip goriva badge */}
                    {tipIkona && (
                      <div className={`w-8 h-8 rounded-lg ${tipIkona.bg} flex items-center justify-center flex-shrink-0`}>
                        <span className={`${tipIkona.text} font-bold text-xs`}>{tipIkona.label}</span>
                      </div>
                    )}
                    <div>
                      <p className="text-white font-semibold">{new Date(vnos.datum).toLocaleDateString('sl-SI')}</p>
                      <p className="text-[#5a5a80] text-xs mt-0.5">{vnos.km?.toLocaleString()} km{vnos.postaja && ` · ${vnos.postaja}`}</p>
                    </div>
                  </div>
                  {vnos.cena_skupaj && <span className="text-[#3ecfcf] font-bold">{vnos.cena_skupaj.toFixed(2)} €</span>}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-[#13131f] rounded-xl p-2.5">
                    <p className="text-[#5a5a80] text-xs mb-1">Litri</p>
                    <p className="text-white font-semibold text-sm">{vnos.litri} L</p>
                  </div>
                  {vnos.cena_na_liter && (
                    <div className="bg-[#13131f] rounded-xl p-2.5">
                      <p className="text-[#5a5a80] text-xs mb-1">Cena/L</p>
                      <p className="text-white font-semibold text-sm">{vnos.cena_na_liter} €</p>
                    </div>
                  )}
                  <div className={`rounded-xl p-2.5 ${poraba ? 'bg-[#6c63ff22] border border-[#6c63ff33]' : 'bg-[#13131f]'}`}>
                    <p className="text-[#5a5a80] text-xs mb-1">Poraba</p>
                    <p className={`font-semibold text-sm ${poraba ? 'text-[#a09aff]' : 'text-[#5a5a80]'}`}>
                      {poraba ? `${poraba.toFixed(1)} L/100` : '—'}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
      <HomeButton />
    </div>
  )
}