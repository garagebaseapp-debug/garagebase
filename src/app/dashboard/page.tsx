'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [avti, setAvti] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/'; return }
      setUser(user)

      const { data } = await supabase
        .from('cars')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      setAvti(data || [])
      setLoading(false)
    }
    init()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  if (loading) return (
    <div className="min-h-screen bg-[#080810] flex items-center justify-center">
      <p className="text-[#5a5a80]">Nalaganje...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#080810] px-4 py-6 max-w-md mx-auto pb-24">

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">
          Garage<span className="text-[#6c63ff]">Base</span>
        </h1>
        <button onClick={handleLogout} className="text-[#5a5a80] text-sm hover:text-white transition-colors">
          Odjava
        </button>
      </div>

      {/* Avti */}
      {avti.length === 0 ? (
        <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-6 text-center">
          <p className="text-4xl mb-3">🚗</p>
          <p className="text-white font-semibold mb-1">Dodaj prvi avto</p>
          <p className="text-[#5a5a80] text-sm mb-4">Začni z vnosom svojega vozila</p>
          <button
            onClick={() => window.location.href = '/dodaj-avto'}
            className="bg-[#6c63ff] text-white text-sm font-semibold px-6 py-2 rounded-xl hover:bg-[#5a52e0] transition-colors">
            + Dodaj avto
          </button>
        </div>
      ) : (
        <>
          {avti.map((avto) => (
            <div key={avto.id} className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5 mb-4">

              {/* Avto naziv */}
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-white font-bold text-lg">
                    {avto.znamka.charAt(0).toUpperCase() + avto.znamka.slice(1)}{' '}
                    {avto.model.toUpperCase()}
                  </h2>
                  <p className="text-[#5a5a80] text-sm">
                    {avto.letnik && `${avto.letnik} · `}
                    {avto.gorivo}
                    {avto.barva && ` · ${avto.barva}`}
                  </p>
                </div>
                {avto.tablica && (
                  <span className="bg-[#6c63ff22] border border-[#6c63ff44] text-[#a09aff] text-xs font-bold px-3 py-1 rounded-lg">
                    {avto.tablica.toUpperCase()}
                  </span>
                )}
              </div>

              {/* KM */}
              {avto.km_trenutni && (
                <div className="bg-[#13131f] rounded-xl p-3 mb-3">
                  <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-1">Trenutni km</p>
                  <p className="text-white font-bold text-xl">{avto.km_trenutni.toLocaleString()} km</p>
                </div>
              )}

              {/* Akcijski gumbi — 4 gumbi */}
              <div className="grid grid-cols-2 gap-2 mt-3">
                <button
                  onClick={() => window.location.href = `/zgodovina-goriva?car=${avto.id}`}
                  className="bg-[#13131f] border border-[#1e1e32] text-[#5a5a80] text-sm py-2 rounded-xl hover:border-[#3ecfcf] hover:text-[#3ecfcf] transition-colors">
                  ⛽ Gorivo
                </button>
                <button
                  onClick={() => window.location.href = `/zgodovina-servisa?car=${avto.id}`}
                  className="bg-[#13131f] border border-[#1e1e32] text-[#5a5a80] text-sm py-2 rounded-xl hover:border-[#f59e0b] hover:text-[#f59e0b] transition-colors">
                  🔧 Servis
                </button>
                <button
                  onClick={() => window.location.href = `/opomniki?car=${avto.id}`}
                  className="bg-[#13131f] border border-[#1e1e32] text-[#5a5a80] text-sm py-2 rounded-xl hover:border-[#6c63ff] hover:text-[#6c63ff] transition-colors">
                  🔔 Opomniki
                </button>
                <button
                  onClick={() => window.location.href = `/stroski?car=${avto.id}`}
                  className="bg-[#13131f] border border-[#1e1e32] text-[#5a5a80] text-sm py-2 rounded-xl hover:border-[#3ecfcf] hover:text-[#3ecfcf] transition-colors">
                  📊 Stroški
                </button>
              </div>
            </div>
          ))}

          {/* Dodaj avto gumb */}
          <button
            onClick={() => window.location.href = '/dodaj-avto'}
            className="w-full border border-dashed border-[#2a2a40] text-[#5a5a80] py-3 rounded-2xl hover:border-[#6c63ff] hover:text-[#6c63ff] transition-colors text-sm">
            + Dodaj še en avto
          </button>
        </>
      )}

      {/* Bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#0f0f1a] border-t border-[#1e1e32] flex justify-around py-3 px-4">
        <button
          onClick={() => window.location.href = '/dashboard'}
          className="flex flex-col items-center gap-1">
          <span className="text-xl">🏠</span>
          <span className="text-[9px] uppercase tracking-wider text-[#6c63ff] font-semibold">Domov</span>
        </button>
        <button
          onClick={() => window.location.href = '/vnos-goriva'}
          className="flex flex-col items-center gap-1">
          <span className="text-xl">⛽</span>
          <span className="text-[9px] uppercase tracking-wider text-[#3a3a5a]">Gorivo</span>
        </button>
        <button
          onClick={() => window.location.href = '/vnos-servisa'}
          className="flex flex-col items-center gap-1">
          <span className="text-xl">🔧</span>
          <span className="text-[9px] uppercase tracking-wider text-[#3a3a5a]">Servis</span>
        </button>
        <button
          onClick={() => window.location.href = '/stroski'}
          className="flex flex-col items-center gap-1">
          <span className="text-xl">📊</span>
          <span className="text-[9px] uppercase tracking-wider text-[#3a3a5a]">Stroški</span>
        </button>
        <button className="flex flex-col items-center gap-1">
          <span className="text-xl">⚙️</span>
          <span className="text-[9px] uppercase tracking-wider text-[#3a3a5a]">Več</span>
        </button>
      </div>

    </div>
  )
}