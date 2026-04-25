'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { BottomNav } from '@/lib/nav'

export default function Garaza() {
  const [avti, setAvti] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [urejanje, setUrejanje] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const dragOver = useRef<number | null>(null)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/'; return }
      const { data } = await supabase
        .from('cars').select('*').eq('user_id', user.id)
        .order('created_at', { ascending: false })
      setAvti(data || [])
      setLoading(false)
    }
    init()

    const handler = (e: any) => {
      e.preventDefault()
      setInstallPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!installPrompt) return
    installPrompt.prompt()
    const result = await installPrompt.userChoice
    if (result.outcome === 'accepted') setInstallPrompt(null)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const onDragStart = (index: number) => setDragIndex(index)

  const onDragEnter = (index: number) => {
    dragOver.current = index
    if (dragIndex === null || dragIndex === index) return
    const noviAvti = [...avti]
    const [premaknjeni] = noviAvti.splice(dragIndex, 1)
    noviAvti.splice(index, 0, premaknjeni)
    setDragIndex(index)
    setAvti(noviAvti)
  }

  const onDragEnd = async () => {
    setDragIndex(null)
    dragOver.current = null
    for (let i = 0; i < avti.length; i++) {
      await supabase.from('cars').update({ vrstni_red: i }).eq('id', avti[i].id)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-[#080810] flex items-center justify-center">
      <p className="text-[#5a5a80]">Nalaganje...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#080810] flex flex-col pb-20">

      {/* Header */}
      <div className="flex justify-between items-center px-5 py-5 flex-shrink-0">
        <h1 className="text-2xl font-bold text-white">
          Garage<span className="text-[#6c63ff]">Base</span>
        </h1>
        <div className="flex gap-2 items-center flex-wrap justify-end">
          {installPrompt && (
            <button onClick={handleInstall}
              className="bg-[#3ecfcf22] border border-[#3ecfcf44] text-[#3ecfcf] text-xs font-semibold px-3 py-2 rounded-xl hover:bg-[#3ecfcf33] transition-colors flex items-center gap-1.5">
              📲 Namesti
            </button>
          )}
          {avti.length > 1 && (
            <button onClick={() => setUrejanje(!urejanje)}
              className={`text-sm font-semibold px-3 py-2 rounded-xl transition-colors ${
                urejanje ? 'bg-[#3ecfcf] text-black' : 'bg-[#13131f] border border-[#1e1e32] text-[#5a5a80]'
              }`}>
              {urejanje ? '✓ Končaj' : '⇅ Uredi'}
            </button>
          )}
          <button onClick={() => window.location.href = '/dodaj-avto'}
            className="bg-[#6c63ff] text-white text-sm font-semibold px-3 py-2 rounded-xl hover:bg-[#5a52e0] transition-colors">
            + Avto
          </button>
          <button onClick={handleLogout}
            className="text-[#5a5a80] text-sm hover:text-white transition-colors">
            Odjava
          </button>
        </div>
      </div>

      {urejanje && (
        <p className="text-center text-[#5a5a80] text-xs mb-2 px-5">
          Povleci avte da spreminjaš vrstni red
        </p>
      )}

      {avti.length === 0 ? (
        <div className="flex-1 flex items-center justify-center px-5">
          <div className="text-center">
            <p className="text-6xl mb-4">🚗</p>
            <p className="text-white font-semibold text-xl mb-2">Tvoja garaža je prazna</p>
            <p className="text-[#5a5a80] text-sm mb-6">Dodaj prvi avto in začni slediti stroškom</p>
            <button onClick={() => window.location.href = '/dodaj-avto'}
              className="bg-[#6c63ff] text-white font-semibold px-8 py-3 rounded-xl hover:bg-[#5a52e0] transition-colors">
              + Dodaj avto
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {avti.map((avto, index) => (
            <div
              key={avto.id}
              draggable={urejanje}
              onDragStart={() => onDragStart(index)}
              onDragEnter={() => onDragEnter(index)}
              onDragEnd={onDragEnd}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => !urejanje && (window.location.href = `/dashboard?car=${avto.id}`)}
              className={`relative overflow-hidden transition-all ${
                urejanje ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
              } ${dragIndex === index ? 'opacity-50 scale-95' : 'opacity-100'}`}
              style={{ height: '20vh', minHeight: '130px', maxHeight: '180px' }}
            >
              {avto.slika_url ? (
                <img src={avto.slika_url} alt={`${avto.znamka} ${avto.model}`}
                  className="absolute inset-0 w-full h-full object-cover object-center" />
              ) : (
                <div className={`absolute inset-0 ${
                  index % 2 === 0
                    ? 'bg-gradient-to-br from-[#1a1630] via-[#13131f] to-[#080810]'
                    : 'bg-gradient-to-br from-[#0f1a16] via-[#13131f] to-[#080810]'
                }`} />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
              <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${urejanje ? 'bg-[#3ecfcf]' : 'bg-[#2a2a40]'}`} />
              {urejanje && <div className="absolute top-3 right-3 text-white/50 text-lg">⠿</div>}
              <div className="absolute bottom-0 left-0 right-0 p-4 flex justify-between items-end">
                <div>
                  <h2 className="text-white font-bold text-lg leading-tight drop-shadow-lg">
                    {avto.znamka.charAt(0).toUpperCase() + avto.znamka.slice(1)}{' '}
                    {avto.model.toUpperCase()}
                  </h2>
                  <p className="text-white/55 text-xs drop-shadow">
                    {[avto.letnik, avto.gorivo].filter(Boolean).join(' · ')}
                    {avto.km_trenutni && ` · ${avto.km_trenutni.toLocaleString()} km`}
                  </p>
                </div>
                {avto.tablica && (
                  <div className="flex flex-col items-center mb-0.5">
                    <div className="bg-[#003399] rounded-t-sm px-1 py-0.5 flex items-center gap-0.5 w-full justify-center">
                      <span className="text-yellow-300 text-[6px]">★</span>
                      <span className="text-white text-[6px] font-bold">SI</span>
                    </div>
                    <div className="bg-white rounded-b-sm px-2 py-0.5 border border-[#003399] border-t-0">
                      <span className="text-black font-bold text-xs tracking-widest font-mono">
                        {avto.tablica.toUpperCase()}
                      </span>
                    </div>
                  </div>
                )}
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-px bg-[#2a2a40]" />
            </div>
          ))}

          {!urejanje && (
            <div
              onClick={() => window.location.href = '/dodaj-avto'}
              className="relative cursor-pointer overflow-hidden flex items-center justify-center border-t border-[#1a1a28]"
              style={{ height: '10vh', minHeight: '70px' }}
            >
              <div className="absolute inset-0 bg-[#080810]" />
              <div className="relative flex items-center gap-2">
                <span className="text-[#3a3a5a] text-2xl">+</span>
                <span className="text-[#3a3a5a] text-sm">Dodaj avto</span>
              </div>
            </div>
          )}
        </div>
      )}

      <BottomNav aktivna="garaza" />
    </div>
  )
}