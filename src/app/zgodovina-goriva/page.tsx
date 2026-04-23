'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

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

      if (!carId) { window.location.href = '/dashboard'; return }

      // Podatki o avtu
      const { data: avtoData } = await supabase
        .from('cars')
        .select('*')
        .eq('id', carId)
        .single()

      setAvto(avtoData)

      // Tankanja
      const { data: gorivo } = await supabase
        .from('fuel_logs')
        .select('*')
        .eq('car_id', carId)
        .order('datum', { ascending: false })

      setVnosi(gorivo || [])
      setLoading(false)
    }
    init()
  }, [])

  // Izračuni
  const skupajLitrov = vnosi.reduce((sum, v) => sum + (v.litri || 0), 0)
  const skupajEurov = vnosi.reduce((sum, v) => sum + (v.cena_skupaj || 0), 0)

  if (loading) return (
    <div className="min-h-screen bg-[#080810] flex items-center justify-center">
      <p className="text-[#5a5a80]">Nalaganje...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#080810] px-4 py-6 max-w-md mx-auto pb-24">

      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => window.location.href = '/dashboard'}
          className="text-[#5a5a80] hover:text-white text-lg">←</button>
        <div>
          <h1 className="text-xl font-bold text-white">⛽ Gorivo</h1>
          {avto && <p className="text-[#5a5a80] text-xs">{avto.znamka} {avto.model}</p>}
        </div>
      </div>

      {/* Povzetek */}
      {vnosi.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-4">
            <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-1">Skupaj litrov</p>
            <p className="text-white font-bold text-xl">{skupajLitrov.toFixed(1)} L</p>
          </div>
          <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-4">
            <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-1">Skupaj strošek</p>
            <p className="text-white font-bold text-xl">{skupajEurov.toFixed(2)} €</p>
          </div>
        </div>
      )}

      {/* Gumb za dodajanje */}
      <button
        onClick={() => window.location.href = `/vnos-goriva?car=${avto?.id}`}
        className="w-full bg-[#6c63ff] hover:bg-[#5a52e0] text-white font-semibold py-3 rounded-xl transition-colors mb-6">
        + Dodaj tankanje
      </button>

      {/* Seznam tankanij */}
      {vnosi.length === 0 ? (
        <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-6 text-center">
          <p className="text-4xl mb-3">⛽</p>
          <p className="text-white font-semibold mb-1">Še ni tankanij</p>
          <p className="text-[#5a5a80] text-sm">Dodaj prvo tankanje</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {vnosi.map((vnos) => (
            <div key={vnos.id} className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-white font-semibold">{vnos.datum}</p>
                  <p className="text-[#5a5a80] text-xs mt-1">
                    {vnos.km?.toLocaleString()} km
                    {vnos.postaja && ` · ${vnos.postaja}`}
                  </p>
                </div>
                {vnos.cena_skupaj && (
                  <span className="text-[#3ecfcf] font-bold">{vnos.cena_skupaj.toFixed(2)} €</span>
                )}
              </div>
              <div className="flex gap-4 mt-2">
                <div>
                  <p className="text-[#5a5a80] text-xs">Litri</p>
                  <p className="text-white font-semibold">{vnos.litri} L</p>
                </div>
                {vnos.cena_na_liter && (
                  <div>
                    <p className="text-[#5a5a80] text-xs">Cena/L</p>
                    <p className="text-white font-semibold">{vnos.cena_na_liter} €</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}