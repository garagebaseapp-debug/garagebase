'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { HomeButton, BackButton } from '@/lib/nav'

export default function Dashboard() {
  const [avti, setAvti] = useState<any[]>([])
  const [aktivniAvto, setAktivniAvto] = useState<any>(null)
  const [opomniki, setOpomniki] = useState<any[]>([])
  const [poraba, setPoraba] = useState<{ skupaj: number | null, zadnja: number | null }>({ skupaj: null, zadnja: null })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/'; return }

      const { data: avtiData } = await supabase
        .from('cars').select('*').eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (avtiData && avtiData.length > 0) {
        setAvti(avtiData)
        const params = new URLSearchParams(window.location.search)
        const carIdFromUrl = params.get('car')
        const izbrani = carIdFromUrl
          ? avtiData.find((a: any) => a.id === carIdFromUrl) || avtiData[0]
          : avtiData[0]
        setAktivniAvto(izbrani)
        await naloziPodatke(izbrani.id, izbrani.km_trenutni || 0)
      }
      setLoading(false)
    }
    init()
  }, [])

  const naloziPodatke = async (carId: string, avtoKmStart: number = 0) => {
    const { data: opData } = await supabase
      .from('reminders').select('*').eq('car_id', carId)
      .order('datum', { ascending: true })
    setOpomniki(opData || [])

    const { data: gorivoData } = await supabase
      .from('fuel_logs').select('*').eq('car_id', carId)
      .order('km', { ascending: true })

    if (gorivoData && gorivoData.length >= 1) {
      const skupajLitrov = gorivoData.reduce((s: number, v: any) => s + (v.litri || 0), 0)
      const zadnjiKm = gorivoData[gorivoData.length - 1].km
      const skupajKm = zadnjiKm - avtoKmStart
      const skupajPoraba = skupajKm > 0 ? (skupajLitrov / skupajKm) * 100 : null
      const zadnje = gorivoData[gorivoData.length - 1]
      const predZadnje = gorivoData.length >= 2 ? gorivoData[gorivoData.length - 2] : null
      const prejsnjiKm = predZadnje ? predZadnje.km : avtoKmStart
      const kmRazlika = zadnje.km - prejsnjiKm
      const zadnjaPoraba = kmRazlika > 0 ? (zadnje.litri / kmRazlika) * 100 : null
      setPoraba({ skupaj: skupajPoraba, zadnja: zadnjaPoraba })
    } else {
      setPoraba({ skupaj: null, zadnja: null })
    }
  }

  const preklopAvto = async (avto: any) => {
    setAktivniAvto(avto)
    await naloziPodatke(avto.id, avto.km_trenutni || 0)
  }

  const dniDo = (datum: string) => {
    if (!datum) return null
    return Math.ceil((new Date(datum).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
  }

  const barvaDni = (dni: number | null) => {
    if (dni === null) return { text: 'text-[#5a5a80]', bg: 'bg-[#13131f]', border: 'border-[#1e1e32]' }
    if (dni <= 7) return { text: 'text-[#ef4444]', bg: 'bg-[#ef444411]', border: 'border-[#ef444433]' }
    if (dni <= 30) return { text: 'text-[#f59e0b]', bg: 'bg-[#f59e0b11]', border: 'border-[#f59e0b33]' }
    return { text: 'text-[#3ecfcf]', bg: 'bg-[#3ecfcf11]', border: 'border-[#3ecfcf33]' }
  }

  const tipIkona: any = { registracija: '📋', vinjeta: '🛣️', tehnicni: '🔍', servis: '🔧', zavarovanje: '🛡️' }
  const tipNaziv: any = { registracija: 'Registracija', vinjeta: 'Vinjeta', tehnicni: 'Tehnični pregled', servis: 'Servis', zavarovanje: 'Zavarovanje' }

  if (loading) return (
    <div className="min-h-screen bg-[#080810] flex items-center justify-center">
      <p className="text-[#5a5a80]">Nalaganje...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#080810] px-4 py-6 pb-24">

      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <BackButton href="/garaza" />
        <h1 className="text-2xl font-bold text-white">
          Garage<span className="text-[#6c63ff]">Base</span>
        </h1>
      </div>

      {avti.length === 0 ? (
        <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-8 text-center">
          <p className="text-5xl mb-4">🚗</p>
          <p className="text-white font-semibold text-lg mb-2">Dodaj prvi avto</p>
          <p className="text-[#5a5a80] text-sm mb-6">Začni z vnosom svojega vozila</p>
          <button onClick={() => window.location.href = '/dodaj-avto'}
            className="bg-[#6c63ff] text-white font-semibold px-8 py-3 rounded-xl hover:bg-[#5a52e0] transition-colors">
            + Dodaj avto
          </button>
        </div>
      ) : (
        <>
          {/* Zavihki — subtilni */}
          <div className="flex gap-2 mb-5 overflow-x-auto pb-1"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {avti.map((avto) => (
              <button key={avto.id} onClick={() => preklopAvto(avto)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                  aktivniAvto?.id === avto.id
                    ? 'bg-[#6c63ff22] border-[#6c63ff66] text-[#a09aff]'
                    : 'bg-transparent border-[#1e1e32] text-[#3a3a5a] hover:text-[#5a5a80]'
                }`}>
                {avto.znamka.charAt(0).toUpperCase() + avto.znamka.slice(1)} {avto.model.toUpperCase()}
              </button>
            ))}
            <button onClick={() => window.location.href = '/dodaj-avto'}
              className="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold bg-transparent border border-dashed border-[#1e1e32] text-[#3a3a5a] hover:text-[#5a5a80] transition-all">
              + Dodaj
            </button>
          </div>

          {aktivniAvto && (
            <>
              <div className="bg-gradient-to-br from-[#1a1630] to-[#0f0f1a] border border-[#2a2a40] rounded-2xl overflow-hidden mb-4">

                {aktivniAvto.slika_url && (
                  <div className="relative h-36 overflow-hidden">
                    <img src={aktivniAvto.slika_url} alt="Avto"
                      className="w-full h-full object-cover object-center" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#1a1630] via-transparent to-transparent" />
                  </div>
                )}

                <div className="p-5 pb-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-white font-bold text-xl">
                        {aktivniAvto.znamka.charAt(0).toUpperCase() + aktivniAvto.znamka.slice(1)}{' '}
                        {aktivniAvto.model.toUpperCase()}
                      </h2>
                      <p className="text-[#5a5a80] text-sm mt-1">
                        {[aktivniAvto.letnik, aktivniAvto.gorivo, aktivniAvto.barva].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    {aktivniAvto.tablica && (
                      <div className="flex flex-col items-center">
                        <div className="bg-[#003399] rounded-t-md px-1.5 py-0.5 flex items-center gap-1 w-full justify-center">
                          <span className="text-yellow-300 text-[7px]">★</span>
                          <span className="text-white text-[7px] font-bold tracking-wider">SI</span>
                        </div>
                        <div className="bg-white rounded-b-md px-3 py-1 border-2 border-[#003399] border-t-0">
                          <span className="text-black font-bold text-sm tracking-widest font-mono">
                            {aktivniAvto.tablica.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {aktivniAvto.km_trenutni && (
                  <div className="mx-5 mb-4 bg-[#13131f] rounded-xl p-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-1">Trenutni km</p>
                        <p className="text-white font-bold text-2xl">{aktivniAvto.km_trenutni.toLocaleString()} km</p>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-[#1a1a2e] border border-[#2a2a40] flex items-center justify-center">
                        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                          <path d="M4 22 L14 6 L24 22" stroke="#6c63ff" strokeWidth="2" strokeLinecap="round"/>
                          <path d="M8 22 L14 12 L20 22" stroke="#3ecfcf" strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>
                          <circle cx="14" cy="22" r="2" fill="#6c63ff"/>
                          <line x1="2" y1="22" x2="26" y2="22" stroke="#2a2a40" strokeWidth="1.5"/>
                        </svg>
                      </div>
                    </div>
                  </div>
                )}

                {(poraba.skupaj !== null || poraba.zadnja !== null) && (
                  <div className="mx-5 mb-4 grid grid-cols-2 gap-3">
                    {poraba.skupaj !== null && (
                      <div className="bg-[#13131f] rounded-xl p-3">
                        <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-1">⌀ Poraba skupaj</p>
                        <p className="text-white font-bold text-lg">{poraba.skupaj.toFixed(1)} <span className="text-[#5a5a80] text-xs font-normal">L/100</span></p>
                      </div>
                    )}
                    {poraba.zadnja !== null && (
                      <div className="bg-[#13131f] rounded-xl p-3">
                        <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-1">⌀ Zadnje tank.</p>
                        <p className="text-white font-bold text-lg">{poraba.zadnja.toFixed(1)} <span className="text-[#5a5a80] text-xs font-normal">L/100</span></p>
                      </div>
                    )}
                  </div>
                )}

                <div className="px-5 pb-5 grid grid-cols-5 gap-2">
                  <button onClick={() => window.location.href = `/zgodovina-goriva?car=${aktivniAvto.id}`}
                    className="bg-[#13131f] border border-[#1e1e32] text-[#5a5a80] text-sm py-2.5 rounded-xl hover:border-[#3ecfcf] hover:text-[#3ecfcf] transition-all flex flex-col items-center gap-1">
                    <span>⛽</span><span className="text-[10px]">Gorivo</span>
                  </button>
                  <button onClick={() => window.location.href = `/zgodovina-servisa?car=${aktivniAvto.id}`}
                    className="bg-[#13131f] border border-[#1e1e32] text-[#5a5a80] text-sm py-2.5 rounded-xl hover:border-[#f59e0b] hover:text-[#f59e0b] transition-all flex flex-col items-center gap-1">
                    <span>🔧</span><span className="text-[10px]">Servis</span>
                  </button>
                  <button onClick={() => window.location.href = `/opomniki?car=${aktivniAvto.id}`}
                    className="bg-[#13131f] border border-[#1e1e32] text-[#5a5a80] text-sm py-2.5 rounded-xl hover:border-[#6c63ff] hover:text-[#6c63ff] transition-all flex flex-col items-center gap-1">
                    <span>🔔</span><span className="text-[10px]">Opomniki</span>
                  </button>
                  <button onClick={() => window.location.href = `/stroski?car=${aktivniAvto.id}`}
                    className="bg-[#13131f] border border-[#1e1e32] text-[#5a5a80] text-sm py-2.5 rounded-xl hover:border-[#3ecfcf] hover:text-[#3ecfcf] transition-all flex flex-col items-center gap-1">
                    <span>📊</span><span className="text-[10px]">Stroški</span>
                  </button>
                  <button onClick={() => window.location.href = `/nastavitve-avta?car=${aktivniAvto.id}`}
                    className="bg-[#13131f] border border-[#1e1e32] text-[#5a5a80] text-sm py-2.5 rounded-xl hover:border-[#5a5a80] hover:text-white transition-all flex flex-col items-center gap-1">
                    <span>⚙️</span><span className="text-[10px]">Nastavitve</span>
                  </button>
                </div>
              </div>

              {opomniki.length > 0 && (
                <div className="mb-4">
                  <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-3">Opomniki</p>
                  <div className="flex flex-col gap-2">
                    {opomniki.map((op) => {
                      const dni = dniDo(op.datum)
                      const b = barvaDni(dni)
                      return (
                        <div key={op.id} className={`${b.bg} border ${b.border} rounded-xl p-3.5 flex justify-between items-center`}>
                          <div className="flex items-center gap-3">
                            <span className="text-xl">{tipIkona[op.tip] || '🔔'}</span>
                            <div>
                              <p className="text-white text-sm font-semibold">{tipNaziv[op.tip] || op.tip}</p>
                              {op.datum && <p className="text-[#5a5a80] text-xs">{new Date(op.datum).toLocaleDateString('sl-SI')}</p>}
                              {op.km_opomnik && <p className="text-[#5a5a80] text-xs">pri {op.km_opomnik.toLocaleString()} km</p>}
                            </div>
                          </div>
                          {dni !== null && (
                            <div className="text-right">
                              <p className={`${b.text} font-bold text-2xl leading-none`}>{dni}</p>
                              <p className="text-[#5a5a80] text-xs mt-0.5">dni</p>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      <HomeButton />
    </div>
  )
}