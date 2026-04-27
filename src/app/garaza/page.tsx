'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { BottomNav } from '@/lib/nav'

const tipIkona: any = { registracija: '📋', vinjeta: '🛣️', tehnicni: '🔍', servis: '🔧', zavarovanje: '🛡️', gume: '⚫' }

export default function Garaza() {
  const [avti, setAvti] = useState<any[]>([])
  const [opomniki, setOpomniki] = useState<{ [key: string]: any[] }>({})
  const [loading, setLoading] = useState(true)
  const [urejanje, setUrejanje] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [prikaz, setPrikaz] = useState('srednje')
  const [gridNastavitve, setGridNastavitve] = useState({
    tablica: true, km: true, opomnik: true, letnik: false, gorivo: false,
    opomnikRdeci: true, opomnikRumeni: true, opomnikZeleni: false
  })
  const [listaNastavitve, setListaNastavitve] = useState({
    letnik: true, gorivo: true, km: true, opomnik: true, tablica: true,
    opomnikRdeci: true, opomnikRumeni: true, opomnikZeleni: false
  })
  const dragOver = useRef<number | null>(null)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/'; return }

      const { data } = await supabase
        .from('cars').select('*').eq('user_id', user.id)
        .order('created_at', { ascending: false })
      setAvti(data || [])

      if (data && data.length > 0) {
        const opomnikMap: { [key: string]: any[] } = {}
        for (const avto of data) {
          const { data: opData } = await supabase
            .from('reminders').select('*').eq('car_id', avto.id)
            .order('datum', { ascending: true })
          opomnikMap[avto.id] = opData || []
        }
        setOpomniki(opomnikMap)
      }

      const shranjene = localStorage.getItem('garagebase_nastavitve')
      if (shranjene) {
        const n = JSON.parse(shranjene)
        setPrikaz(n.prikazGaraze || 'srednje')
        if (n.gridNastavitve) setGridNastavitve(prev => ({ ...prev, ...n.gridNastavitve }))
        if (n.listaNastavitve) setListaNastavitve(prev => ({ ...prev, ...n.listaNastavitve }))
      }

      setLoading(false)
    }
    init()

    const handler = (e: any) => { e.preventDefault(); setInstallPrompt(e) }
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

  const barvaOpomnika = (carId: string) => {
    const ops = opomniki[carId] || []
    let minDni = Infinity
    for (const op of ops) {
      if (!op.datum) continue
      const dni = Math.ceil((new Date(op.datum).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
      if (dni < minDni) minDni = dni
    }
    if (minDni === Infinity) return null
    if (minDni <= 7) return 'rdeča'
    if (minDni <= 30) return 'rumena'
    return 'zelena'
  }

  const barvaBorder = (barva: string | null) => {
    if (barva === 'rdeča') return 'border-[#ef4444]'
    if (barva === 'rumena') return 'border-[#f59e0b]'
    if (barva === 'zelena') return 'border-[#16a34a]'
    return 'border-[#2a2a40]'
  }

  const dniBgBarva = (dni: number) => {
    if (dni <= 7) return 'bg-[#ef4444]'
    if (dni <= 30) return 'bg-[#f59e0b]'
    return 'bg-[#16a34a]'
  }

  const karticaVisina = () => {
    if (prikaz === 'malo') return { height: '14vh', minHeight: '100px', maxHeight: '140px' }
    if (prikaz === 'veliko') return { height: '28vh', minHeight: '180px', maxHeight: '240px' }
    return { height: '20vh', minHeight: '130px', maxHeight: '180px' }
  }

  const OpomnikiBadgi = ({ carId, max, nastavitve }: { carId: string, max: number, nastavitve: any }) => {
    const ops = opomniki[carId] || []
    const filtrirani = ops
      .filter((op: any) => op.datum)
      .map((op: any) => ({
        ...op,
        dni: Math.ceil((new Date(op.datum).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
      }))
      .filter((op: any) => {
        if (op.dni <= 7) return nastavitve.opomnikRdeci !== false
        if (op.dni <= 30) return nastavitve.opomnikRumeni !== false
        return nastavitve.opomnikZeleni === true
      })
      .sort((a: any, b: any) => a.dni - b.dni)
      .slice(0, max)

    if (filtrirani.length === 0) return null

    return (
      <>
        {filtrirani.map((op: any) => (
          <div key={op.id} className={`rounded-md px-1 py-0.5 ${dniBgBarva(op.dni)} flex items-center gap-0.5`}>
            <span className="text-[8px]">{tipIkona[op.tip] || '🔔'}</span>
            <span className="text-white font-bold text-[8px]">{op.dni}d</span>
          </div>
        ))}
      </>
    )
  }

  if (loading) return (
    <div className="min-h-screen bg-[#080810] flex items-center justify-center">
      <p className="text-[#5a5a80]">Nalaganje...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#080810] flex flex-col pb-20">

      <div className="flex justify-between items-center px-5 py-5 flex-shrink-0">
        <h1 className="text-2xl font-bold text-white">
          Garage<span className="text-[#6c63ff]">Base</span>
        </h1>
        <div className="flex gap-2 items-center flex-wrap justify-end">
          {installPrompt && (
            <button onClick={handleInstall}
              className="bg-[#3ecfcf22] border border-[#3ecfcf44] text-[#3ecfcf] text-xs font-semibold px-3 py-2 rounded-xl hover:bg-[#3ecfcf33] transition-colors">
              📲 Namesti
            </button>
          )}
          {/* Gumb uredi — prikaže se za vse načine prikaza če je več kot 1 avto */}
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
      ) : prikaz === 'grid' ? (
        <div className="flex-1 overflow-y-auto px-3 pt-2">
          <div className="grid grid-cols-3 gap-2">
            {avti.map((avto, index) => {
              const barva = barvaOpomnika(avto.id)
              return (
                <div key={avto.id}
                  draggable={urejanje}
                  onDragStart={() => onDragStart(index)}
                  onDragEnter={() => onDragEnter(index)}
                  onDragEnd={onDragEnd}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => !urejanje && (window.location.href = `/dashboard?car=${avto.id}`)}
                  className={`relative rounded-xl overflow-hidden border-2 ${barvaBorder(barva)} aspect-square transition-all ${
                    urejanje ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                  } ${dragIndex === index ? 'opacity-50 scale-95' : 'opacity-100'}`}>
                  {avto.slika_url ? (
                    <img src={avto.slika_url} alt={avto.znamka}
                      className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-[#1a1630] to-[#080810]" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

                  {/* Urejanje indikator v gridu */}
                  {urejanje && (
                    <div className="absolute top-1 left-1 bg-black/60 rounded-md px-1 py-0.5">
                      <span className="text-white text-[10px]">⠿</span>
                    </div>
                  )}

                  {gridNastavitve.opomnik && !urejanje && (
                    <div className="absolute top-1 right-1 flex flex-col gap-0.5 items-end">
                      <OpomnikiBadgi carId={avto.id} max={3} nastavitve={gridNastavitve} />
                    </div>
                  )}

                  <div className="absolute bottom-0 left-0 right-0 p-1.5">
                    <p className="text-white font-bold text-[10px] leading-tight truncate">
                      {avto.znamka.charAt(0).toUpperCase() + avto.znamka.slice(1)} {avto.model.toUpperCase()}
                    </p>
                    {gridNastavitve.letnik && avto.letnik && (
                      <p className="text-white/60 text-[8px]">{avto.letnik}</p>
                    )}
                    {gridNastavitve.gorivo && avto.gorivo && (
                      <p className="text-white/60 text-[8px]">{avto.gorivo}</p>
                    )}
                    {gridNastavitve.km && avto.km_trenutni && (
                      <p className="text-[#3ecfcf] text-[9px] font-semibold">{avto.km_trenutni.toLocaleString()} km</p>
                    )}
                    {gridNastavitve.tablica && avto.tablica && (
                      <div className="mt-0.5 bg-white rounded px-1 inline-block">
                        <span className="text-black font-bold text-[7px] tracking-wider font-mono">
                          {avto.tablica.toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {!urejanje && (
              <div onClick={() => window.location.href = '/dodaj-avto'}
                className="aspect-square rounded-xl border-2 border-dashed border-[#2a2a40] flex items-center justify-center cursor-pointer hover:border-[#6c63ff] transition-colors">
                <div className="text-center">
                  <p className="text-[#3a3a5a] text-2xl">+</p>
                  <p className="text-[#3a3a5a] text-[9px]">Dodaj</p>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {avti.map((avto, index) => {
            const barva = barvaOpomnika(avto.id)
            return (
              <div key={avto.id}
                draggable={urejanje}
                onDragStart={() => onDragStart(index)}
                onDragEnter={() => onDragEnter(index)}
                onDragEnd={onDragEnd}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => !urejanje && (window.location.href = `/dashboard?car=${avto.id}`)}
                className={`relative overflow-hidden transition-all ${
                  urejanje ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                } ${dragIndex === index ? 'opacity-50 scale-95' : 'opacity-100'}`}
                style={karticaVisina()}>
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

                {urejanje && <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#3ecfcf]" />}
                {urejanje && <div className="absolute top-3 right-3 text-white/50 text-lg">⠿</div>}

                <div className="absolute bottom-0 left-0 right-0 p-4 flex justify-between items-end">
                  <div>
                    <h2 className="text-white font-bold text-lg leading-tight"
                      style={{ textShadow: '0 1px 8px rgba(0,0,0,0.9), 0 0 20px rgba(0,0,0,0.8)' }}>
                      {avto.znamka.charAt(0).toUpperCase() + avto.znamka.slice(1)}{' '}
                      {avto.model.toUpperCase()}
                    </h2>
                    <p className="text-white/55 text-xs drop-shadow">
                      {[
                        listaNastavitve.letnik && avto.letnik,
                        listaNastavitve.gorivo && avto.gorivo,
                        listaNastavitve.km && avto.km_trenutni && `${avto.km_trenutni.toLocaleString()} km`
                      ].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 mb-0.5">
                    {listaNastavitve.opomnik && (
                      <div className="flex flex-wrap gap-1 justify-end max-w-[130px]">
                        <OpomnikiBadgi carId={avto.id} max={4} nastavitve={listaNastavitve} />
                      </div>
                    )}
                    {listaNastavitve.tablica && avto.tablica && (
                      <div className="flex flex-col items-center">
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
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-px bg-[#2a2a40]" />
              </div>
            )
          })}

          {!urejanje && (
            <div onClick={() => window.location.href = '/dodaj-avto'}
              className="relative cursor-pointer overflow-hidden flex items-center justify-center border-t border-[#1a1a28]"
              style={{ height: '10vh', minHeight: '70px' }}>
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