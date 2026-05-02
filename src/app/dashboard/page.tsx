'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { HomeButton, BackButton } from '@/lib/nav'
import { type GarageBaseCurrency, currencySymbol, formatMoney } from '@/lib/currency'

export default function Dashboard() {
  const [avti, setAvti] = useState<any[]>([])
  const [aktivniAvto, setAktivniAvto] = useState<any>(null)
  const [opomniki, setOpomniki] = useState<any[]>([])
  const [poraba, setPoraba] = useState<{ skupaj: number | null, zadnja: number | null }>({ skupaj: null, zadnja: null })
  const [stroski, setStroski] = useState<{ skupaj: number, naKm: number | null }>({ skupaj: 0, naKm: null })
  const [loading, setLoading] = useState(true)
  const [nacin, setNacin] = useState<'lite' | 'full'>('full')
  const [valuta, setValuta] = useState<GarageBaseCurrency>('EUR')
  const znakValute = currencySymbol(valuta)

  useEffect(() => {
    const init = async () => {
      let jeLite = false
      const settingsRaw = localStorage.getItem('garagebase_nastavitve')
      if (settingsRaw) {
        try {
          const settings = JSON.parse(settingsRaw)
          jeLite = settings.nacin === 'lite'
          setNacin(jeLite ? 'lite' : 'full')
          setValuta(settings.valuta === 'USD' ? 'USD' : 'EUR')
        } catch {}
      }
      const params = new URLSearchParams(window.location.search)
      const carIdFromUrl = params.get('car')
      const cached = localStorage.getItem('garagebase_garaza_cache')
      if (cached) {
        try {
          const parsed = JSON.parse(cached)
          if (Array.isArray(parsed.avti) && parsed.avti.length > 0) {
            setAvti(parsed.avti)
            const cachedCar = carIdFromUrl
              ? parsed.avti.find((a: any) => a.id === carIdFromUrl) || parsed.avti[0]
              : parsed.avti[0]
            setAktivniAvto(cachedCar)
            setLoading(false)
          }
        } catch {}
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/'; return }
      const started = performance.now()
      const { data: avtiData } = await supabase
        .from('cars').select('*').eq('user_id', user.id)
        .order('vrstni_red', { ascending: true })
      const cars = avtiData || []
      setAvti(cars)
      const previousGarageCache = localStorage.getItem('garagebase_garaza_cache')
      let previousOpomniki = {}
      try { previousOpomniki = previousGarageCache ? JSON.parse(previousGarageCache).opomniki || {} : {} } catch {}
      localStorage.setItem('garagebase_garaza_cache', JSON.stringify({ avti: cars, opomniki: previousOpomniki, savedAt: Date.now() }))
      if (cars.length > 0) {
        const izbrani = carIdFromUrl
          ? cars.find((a: any) => a.id === carIdFromUrl) || cars[0]
          : cars[0]
        setAktivniAvto(izbrani)
        setLoading(false)
        if (jeLite) await naloziLitePodatke(izbrani.id)
        else await naloziPodatke(izbrani.id, izbrani.km_trenutni || 0, izbrani.km_ob_vnosu || 0)
      }
      console.info(`[GarageBase speed] dashboard cars ${Math.round(performance.now() - started)}ms, cars ${cars.length}`)
      setLoading(false)
    }
    init()
  }, [])

  const naloziLitePodatke = async (carId: string) => {
    const cached = localStorage.getItem(`garagebase_dashboard_cache_${carId}`)
    if (cached) {
      try {
        const parsed = JSON.parse(cached)
        if (Array.isArray(parsed.opomniki)) setOpomniki(parsed.opomniki)
      } catch {}
    }

    const started = performance.now()
    const { data } = await supabase
      .from('reminders')
      .select('*')
      .eq('car_id', carId)
      .order('datum', { ascending: true })

    const opData = data || []
    setOpomniki(opData)
    localStorage.setItem(`garagebase_dashboard_cache_${carId}`, JSON.stringify({ opomniki: opData, savedAt: Date.now() }))
    console.info(`[GarageBase speed] lite dashboard ${Math.round(performance.now() - started)}ms`)
  }

  const naloziPodatke = async (carId: string, avtoKmStart: number = 0, kmObVnosu: number = 0) => {
    const cached = localStorage.getItem(`garagebase_dashboard_cache_${carId}`)
    if (cached) {
      try {
        const parsed = JSON.parse(cached)
        if (Array.isArray(parsed.opomniki)) setOpomniki(parsed.opomniki)
        if (parsed.poraba) setPoraba(parsed.poraba)
        if (parsed.stroski) setStroski(parsed.stroski)
      } catch {}
    }

    const started = performance.now()
    const [opRes, gorivoRes, servisRes, expensesRes] = await Promise.all([
      supabase.from('reminders').select('*').eq('car_id', carId).order('datum', { ascending: true }),
      supabase.from('fuel_logs').select('km,litri,cena_skupaj').eq('car_id', carId).order('km', { ascending: true }),
      supabase.from('service_logs').select('cena').eq('car_id', carId),
      supabase.from('expenses').select('znesek').eq('car_id', carId),
    ])

    const opData = opRes.data || []
    const gorivoData = gorivoRes.data || []
    setOpomniki(opData)

    let nextPoraba = { skupaj: null as number | null, zadnja: null as number | null }
    if (gorivoData.length >= 1) {
      const skupajLitrov = gorivoData.reduce((s: number, v: any) => s + (v.litri || 0), 0)
      const zadnjiKm = gorivoData[gorivoData.length - 1].km
      const skupajKm = zadnjiKm - avtoKmStart
      const skupajPoraba = skupajKm > 0 ? (skupajLitrov / skupajKm) * 100 : null
      const zadnje = gorivoData[gorivoData.length - 1]
      const predZadnje = gorivoData.length >= 2 ? gorivoData[gorivoData.length - 2] : null
      const prejsnjiKm = predZadnje ? predZadnje.km : avtoKmStart
      const kmRazlika = zadnje.km - prejsnjiKm
      const zadnjaPoraba = kmRazlika > 0 ? (zadnje.litri / kmRazlika) * 100 : null
      nextPoraba = { skupaj: skupajPoraba, zadnja: zadnjaPoraba }
    }
    setPoraba(nextPoraba)

    const skupajGorivo = gorivoData.reduce((s: number, v: any) => s + (v.cena_skupaj || 0), 0)
    const skupajServis = (servisRes.data || []).reduce((s: number, v: any) => s + (v.cena || 0), 0)
    const skupajExpenses = (expensesRes.data || []).reduce((s: number, v: any) => s + (v.znesek || 0), 0)
    const skupajVse = skupajGorivo + skupajServis + skupajExpenses
    const kmPrevozeni = avtoKmStart - kmObVnosu
    const nextStroski = { skupaj: skupajVse, naKm: kmPrevozeni > 0 ? skupajVse / kmPrevozeni : null }
    setStroski(nextStroski)
    localStorage.setItem(`garagebase_dashboard_cache_${carId}`, JSON.stringify({ opomniki: opData, poraba: nextPoraba, stroski: nextStroski, savedAt: Date.now() }))
    console.info(`[GarageBase speed] dashboard data ${Math.round(performance.now() - started)}ms`)
  }
  const preklopAvto = async (avto: any) => {
    setAktivniAvto(avto)
    if (nacin === 'lite') await naloziLitePodatke(avto.id)
    else await naloziPodatke(avto.id, avto.km_trenutni || 0, avto.km_ob_vnosu || 0)
  }

  const dniDo = (datum: string) => {
    if (!datum) return null
    return Math.ceil((new Date(datum).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
  }

  const kmDo = (kmOpomnik: number) => {
    if (!aktivniAvto?.km_trenutni) return null
    return kmOpomnik - aktivniAvto.km_trenutni
  }

  // Barva glede na dni
  const barvaZaDni = (dni: number | null) => {
    if (dni === null) return { text: 'text-[#5a5a80]', bg: 'bg-[#13131f]', border: 'border-[#1e1e32]' }
    if (dni <= 7) return { text: 'text-[#ef4444]', bg: 'bg-[#ef444411]', border: 'border-[#ef444433]' }
    if (dni <= 30) return { text: 'text-[#f59e0b]', bg: 'bg-[#f59e0b11]', border: 'border-[#f59e0b33]' }
    return { text: 'text-[#3ecfcf]', bg: 'bg-[#3ecfcf11]', border: 'border-[#3ecfcf33]' }
  }

  // Barva glede na km
  const barvaZaKm = (preostaloKm: number | null) => {
    if (preostaloKm === null) return { text: 'text-[#5a5a80]', bg: 'bg-[#13131f]', border: 'border-[#1e1e32]' }
    if (preostaloKm <= 500) return { text: 'text-[#ef4444]', bg: 'bg-[#ef444411]', border: 'border-[#ef444433]' }
    if (preostaloKm <= 1500) return { text: 'text-[#f59e0b]', bg: 'bg-[#f59e0b11]', border: 'border-[#f59e0b33]' }
    return { text: 'text-[#3ecfcf]', bg: 'bg-[#3ecfcf11]', border: 'border-[#3ecfcf33]' }
  }

  // Skupna barva — vzame slabšo
  const skupnaBarva = (dni: number | null, preostaloKm: number | null) => {
    const bdni = barvaZaDni(dni)
    const bkm = barvaZaKm(preostaloKm)
    if (bdni.text === 'text-[#ef4444]' || bkm.text === 'text-[#ef4444]')
      return { text: 'text-[#ef4444]', bg: 'bg-[#ef444411]', border: 'border-[#ef444433]' }
    if (bdni.text === 'text-[#f59e0b]' || bkm.text === 'text-[#f59e0b]')
      return { text: 'text-[#f59e0b]', bg: 'bg-[#f59e0b11]', border: 'border-[#f59e0b33]' }
    return { text: 'text-[#3ecfcf]', bg: 'bg-[#3ecfcf11]', border: 'border-[#3ecfcf33]' }
  }

  const tipIkona: any = { registracija: '📋', vinjeta: '🛣️', tehnicni: '🔍', servis: '🔧', zavarovanje: '🛡️', gume: '⚫' }
  const tipNaziv: any = { registracija: 'Registracija', vinjeta: 'Vinjeta', tehnicni: 'Tehnični pregled', servis: 'Servis', zavarovanje: 'Zavarovanje', gume: 'Gume' }

  const nujniOpomniki = opomniki
    .map((op) => ({ ...op, dni: dniDo(op.datum), km: op.km_opomnik ? kmDo(op.km_opomnik) : null }))
    .sort((a, b) => Math.min(a.dni ?? 9999, a.km ?? 999999) - Math.min(b.dni ?? 9999, b.km ?? 999999))
    .slice(0, 3)

  if (nacin === 'lite' && aktivniAvto) {
    return (
      <div className="min-h-screen bg-[#080810] px-4 py-6 pb-24">
        <div className="flex items-center gap-3 mb-5">
          <BackButton href="/garaza" />
          <div>
            <h1 className="text-xl font-bold text-white">Lite</h1>
            <p className="text-[#5a5a80] text-xs">Hitri pregled vozila</p>
          </div>
        </div>

        <div className="flex gap-2 mb-4 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {avti.map((avto) => (
            <button key={avto.id} onClick={() => preklopAvto(avto)}
              className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-semibold border ${
                aktivniAvto?.id === avto.id ? 'bg-[#6c63ff22] border-[#6c63ff66] text-[#a09aff]' : 'bg-[#0f0f1a] border-[#1e1e32] text-[#5a5a80]'
              }`}>
              {avto.znamka} {avto.model}
            </button>
          ))}
        </div>

        <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl overflow-hidden mb-4">
          {aktivniAvto.slika_url && (
            <img src={aktivniAvto.slika_url} alt={`${aktivniAvto.znamka} ${aktivniAvto.model}`}
              loading="eager" decoding="async" className="w-full h-44 object-cover" />
          )}
          <div className="p-5">
            <h2 className="text-white font-black text-2xl leading-tight">
              {aktivniAvto.znamka.charAt(0).toUpperCase() + aktivniAvto.znamka.slice(1)} {aktivniAvto.model.toUpperCase()}
            </h2>
            <p className="text-[#5a5a80] mt-1">
              {[aktivniAvto.letnik, aktivniAvto.gorivo, aktivniAvto.km_trenutni && `${aktivniAvto.km_trenutni.toLocaleString()} km`].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <button onClick={() => window.location.href = `/vnos-goriva?car=${aktivniAvto.id}`} className="bg-[#3ecfcf22] border border-[#3ecfcf66] text-[#3ecfcf] rounded-2xl p-5 text-left font-bold">
            <span className="block text-3xl mb-2">⛽</span>Vnos goriva
          </button>
          <button onClick={() => window.location.href = `/vnos-servisa?car=${aktivniAvto.id}`} className="bg-[#f59e0b22] border border-[#f59e0b66] text-[#f59e0b] rounded-2xl p-5 text-left font-bold">
            <span className="block text-3xl mb-2">🔧</span>Servis
          </button>
          <button onClick={() => window.location.href = `/vnos-stroska?car=${aktivniAvto.id}`} className="bg-[#6c63ff22] border border-[#6c63ff66] text-[#a09aff] rounded-2xl p-5 text-left font-bold">
            <span className="block text-3xl mb-2">📊</span>Strosek
          </button>
          <button onClick={() => window.location.href = `/opomniki?car=${aktivniAvto.id}`} className="bg-[#16a34a22] border border-[#16a34a66] text-[#4ade80] rounded-2xl p-5 text-left font-bold">
            <span className="block text-3xl mb-2">🔔</span>Opomnik
          </button>
        </div>

        <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-4">
          <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-3">Najblizji opomniki</p>
          {nujniOpomniki.length === 0 ? (
            <p className="text-[#5a5a80] text-sm">Ni aktivnih opomnikov.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {nujniOpomniki.map((op) => {
                const b = skupnaBarva(op.dni, op.km)
                return (
                  <div key={op.id} className={`${b.bg} border ${b.border} rounded-xl p-3 flex items-center justify-between gap-3`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xl">{tipIkona[op.tip] || '🔔'}</span>
                      <div className="min-w-0">
                        <p className="text-white text-sm font-semibold truncate">{tipNaziv[op.tip] || op.tip}</p>
                        <p className="text-[#5a5a80] text-xs">{op.datum ? new Date(op.datum).toLocaleDateString('sl-SI') : 'Km opomnik'}</p>
                      </div>
                    </div>
                    <p className={`${b.text} font-black text-lg whitespace-nowrap`}>
                      {op.dni !== null ? `${op.dni} d` : op.km !== null ? `${op.km} km` : '-'}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <HomeButton />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#080810] px-4 py-6 pb-24">

      <div className="flex items-center gap-3 mb-5">
        <BackButton href="/garaza" />
        <h1 className="text-2xl font-bold text-white">
          Garage<span className="text-[#6c63ff]">Base</span>
        </h1>
      </div>

      {loading && avti.length === 0 && (
        <div className="space-y-4 animate-pulse">
          <div className="h-9 bg-[#13131f] border border-[#1e1e32] rounded-xl" />
          <div className="h-[260px] bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl" />
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map(i => <div key={i} className="h-20 bg-[#13131f] rounded-xl" />)}
          </div>
        </div>
      )}

      {!loading && avti.length === 0 ? (
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
              <div className="hidden lg:grid grid-cols-[minmax(340px,0.9fr)_minmax(520px,1.1fr)] bg-gradient-to-br from-[#12111f] to-[#0b0b12] border border-[#2a2a40] rounded-2xl overflow-hidden mb-6">
                <div className="relative min-h-[360px] bg-[#07070d] border-r border-[#1e1e32] flex items-center justify-center p-6">
                  {aktivniAvto.slika_url ? (
                    <img src={aktivniAvto.slika_url} alt="Avto"
                      loading="eager" decoding="async" className="max-w-full max-h-[330px] object-contain rounded-xl" />
                  ) : (
                    <div className="w-full h-full min-h-[300px] rounded-xl bg-gradient-to-br from-[#1a1630] to-[#080810] flex items-center justify-center text-6xl">
                      🚗
                    </div>
                  )}
                </div>

                <div className="p-8 flex flex-col gap-6">
                  <div className="flex justify-between items-start gap-6">
                    <div>
                      <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2">Izbrano vozilo</p>
                      <h2 className="text-white font-bold text-4xl leading-tight">
                        {aktivniAvto.znamka.charAt(0).toUpperCase() + aktivniAvto.znamka.slice(1)}{' '}
                        {aktivniAvto.model.toUpperCase()}
                      </h2>
                      <p className="text-[#8080a0] text-base mt-3">
                        {[aktivniAvto.letnik, aktivniAvto.gorivo, aktivniAvto.barva].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    {aktivniAvto.tablica && (
                      <div className="flex flex-col items-center flex-shrink-0">
                        <div className="bg-[#003399] rounded-t-md px-2 py-1 flex items-center gap-1 w-full justify-center">
                          <span className="text-yellow-300 text-[8px]">★</span>
                          <span className="text-white text-[8px] font-bold tracking-wider">SI</span>
                        </div>
                        <div className="bg-white rounded-b-md px-4 py-2 border-2 border-[#003399] border-t-0">
                          <span className="text-black font-bold text-lg tracking-widest font-mono">
                            {aktivniAvto.tablica.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-[#13131f] border border-[#1e1e32] rounded-xl p-4">
                      <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2">Kilometri</p>
                      <p className="text-white font-bold text-2xl">{aktivniAvto.km_trenutni ? aktivniAvto.km_trenutni.toLocaleString() : '-'} km</p>
                    </div>
                    <div className="bg-[#13131f] border border-[#1e1e32] rounded-xl p-4">
                      <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2">Poraba</p>
                      <p className="text-white font-bold text-2xl">{poraba.skupaj !== null ? poraba.skupaj.toFixed(1) : '-'} <span className="text-[#5a5a80] text-sm font-normal">L/100</span></p>
                    </div>
                    <div className="bg-[#13131f] border border-[#1e1e32] rounded-xl p-4">
                      <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2">Stroški</p>
              <p className="text-white font-bold text-2xl">{stroski.skupaj > 0 ? stroski.skupaj.toFixed(0) : '-'} <span className="text-[#5a5a80] text-sm font-normal">{znakValute}</span></p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mt-auto">
                    <button onClick={() => window.location.href = '/zgodovina-goriva?car=' + aktivniAvto.id} className="bg-[#13131f] border border-[#1e1e32] text-[#5a5a80] py-4 rounded-xl hover:border-[#3ecfcf] hover:text-[#3ecfcf] transition-all flex items-center justify-center gap-3 font-semibold"><span className="text-xl">⛽</span>Gorivo</button>
                    <button onClick={() => window.location.href = '/zgodovina-servisa?car=' + aktivniAvto.id} className="bg-[#13131f] border border-[#1e1e32] text-[#5a5a80] py-4 rounded-xl hover:border-[#f59e0b] hover:text-[#f59e0b] transition-all flex items-center justify-center gap-3 font-semibold"><span className="text-xl">🔧</span>Servis</button>
                    <button onClick={() => window.location.href = '/opomniki?car=' + aktivniAvto.id} className="bg-[#13131f] border border-[#1e1e32] text-[#5a5a80] py-4 rounded-xl hover:border-[#6c63ff] hover:text-[#6c63ff] transition-all flex items-center justify-center gap-3 font-semibold"><span className="text-xl">🔔</span>Opomniki</button>
                    <button onClick={() => window.location.href = '/stroski?car=' + aktivniAvto.id} className="bg-[#13131f] border border-[#1e1e32] text-[#5a5a80] py-4 rounded-xl hover:border-[#3ecfcf] hover:text-[#3ecfcf] transition-all flex items-center justify-center gap-3 font-semibold"><span className="text-xl">📊</span>Stroški</button>
                    <button onClick={() => window.location.href = '/nastavitve-avta?car=' + aktivniAvto.id} className="bg-[#13131f] border border-[#1e1e32] text-[#5a5a80] py-4 rounded-xl hover:border-[#5a5a80] hover:text-white transition-all flex items-center justify-center gap-3 font-semibold"><span className="text-xl">⚙️</span>Nastavitve</button>
                    <button onClick={() => window.location.href = '/report?car=' + aktivniAvto.id} className="bg-[#6c63ff22] border border-[#6c63ff55] text-[#a09aff] py-4 rounded-xl hover:border-[#6c63ff] transition-all flex items-center justify-center gap-3 font-semibold"><span className="text-xl">📄</span>Report</button>
                  </div>
                </div>
              </div>

              <div className="lg:hidden bg-gradient-to-br from-[#1a1630] to-[#0f0f1a] border border-[#2a2a40] rounded-2xl overflow-hidden mb-4">

                {aktivniAvto.slika_url && (
                  <div className="relative h-36 overflow-hidden">
                    <img src={aktivniAvto.slika_url} alt="Avto"
                      loading="eager" decoding="async" className="w-full h-full object-cover object-center" />
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
                      <div className="w-12 h-12 rounded-xl bg-[#1a1a2e] border border-[#2a2a40] flex items-center justify-center text-2xl">
                        🛣️
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

                {/* Kalkulator stroškov €/km */}
                {stroski.skupaj > 0 && (
                  <div className="mx-5 mb-4 bg-[#13131f] rounded-xl p-4">
                    <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-3">💰 Stroški vozila</p>
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-[#5a5a80] text-xs mb-0.5">Skupaj</p>
          <p className="text-white font-bold text-xl">{formatMoney(stroski.skupaj, valuta)}</p>
                      </div>
                      {stroski.naKm !== null && (
                        <div className="text-right">
                          <p className="text-[#5a5a80] text-xs mb-0.5">Cena na km</p>
          <p className="text-[#6c63ff] font-bold text-xl">{stroski.naKm.toFixed(3)} {znakValute}/km</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="px-5 pb-5 grid grid-cols-6 gap-2">
                  <button onClick={() => window.location.href = `/zgodovina-goriva?car=${aktivniAvto.id}`}
                    className="bg-[#13131f] border border-[#1e1e32] text-[#5a5a80] text-base py-3 rounded-xl hover:border-[#3ecfcf] hover:text-[#3ecfcf] transition-all flex flex-col items-center gap-1">
                    <span>⛽</span><span className="text-[11px]">Gorivo</span>
                  </button>
                  <button onClick={() => window.location.href = `/zgodovina-servisa?car=${aktivniAvto.id}`}
                    className="bg-[#13131f] border border-[#1e1e32] text-[#5a5a80] text-base py-3 rounded-xl hover:border-[#f59e0b] hover:text-[#f59e0b] transition-all flex flex-col items-center gap-1">
                    <span>🔧</span><span className="text-[11px]">Servis</span>
                  </button>
                  <button onClick={() => window.location.href = `/opomniki?car=${aktivniAvto.id}`}
                    className="bg-[#13131f] border border-[#1e1e32] text-[#5a5a80] text-base py-3 rounded-xl hover:border-[#6c63ff] hover:text-[#6c63ff] transition-all flex flex-col items-center gap-1">
                    <span>🔔</span><span className="text-[11px]">Opomniki</span>
                  </button>
                  <button onClick={() => window.location.href = `/stroski?car=${aktivniAvto.id}`}
                    className="bg-[#13131f] border border-[#1e1e32] text-[#5a5a80] text-base py-3 rounded-xl hover:border-[#3ecfcf] hover:text-[#3ecfcf] transition-all flex flex-col items-center gap-1">
                    <span>📊</span><span className="text-[11px]">Stroški</span>
                  </button>
                  <button onClick={() => window.location.href = `/nastavitve-avta?car=${aktivniAvto.id}`}
                    className="bg-[#13131f] border border-[#1e1e32] text-[#5a5a80] text-base py-3 rounded-xl hover:border-[#5a5a80] hover:text-white transition-all flex flex-col items-center gap-1">
                    <span>⚙️</span><span className="text-[11px]">Nastavitve</span>
                  </button>
                  <button onClick={() => window.location.href = `/report?car=${aktivniAvto.id}`}
                    className="bg-[#13131f] border border-[#6c63ff44] text-[#6c63ff] text-base py-3 rounded-xl hover:border-[#6c63ff] hover:bg-[#6c63ff22] transition-all flex flex-col items-center gap-1">
                    <span>📄</span><span className="text-[11px]">Report</span>
                  </button>
                </div>
              </div>

              {/* Opomniki z dni in km prikazom */}
              {opomniki.length > 0 && (
                <div className="mb-4">
                  <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-3">Opomniki</p>
                  <div className="flex flex-col gap-2">
                    {opomniki.map((op) => {
                      const dni = dniDo(op.datum)
                      const preostaloKm = op.km_opomnik ? kmDo(op.km_opomnik) : null
                      const b = skupnaBarva(dni, preostaloKm)
                      return (
                        <div key={op.id} className={`${b.bg} border ${b.border} rounded-xl p-3.5`}>
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                              <span className="text-xl">{tipIkona[op.tip] || '🔔'}</span>
                              <p className="text-white text-sm font-semibold">{tipNaziv[op.tip] || op.tip}</p>
                            </div>
                          </div>

                          {/* Datum vrstica */}
                          {op.datum && (
                            <div className="flex justify-between items-center mt-2">
                              <p className="text-[#5a5a80] text-xs">
                                📅 {new Date(op.datum).toLocaleDateString('sl-SI')}
                              </p>
                              {dni !== null && (
                                <div className="text-right">
                                  {dni >= 0 ? (
                                    <p className={`${barvaZaDni(dni).text} font-bold text-lg leading-none`}>
                                      {dni} <span className="text-xs font-normal">dni</span>
                                    </p>
                                  ) : (
                                    <p className="text-[#ef4444] font-bold text-lg leading-none">
                                      +{Math.abs(dni)} <span className="text-xs font-normal">dni zamude</span>
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Km vrstica */}
                          {op.km_opomnik && preostaloKm !== null && (
                            <div className="flex justify-between items-center mt-1">
                              <p className="text-[#5a5a80] text-xs">
                                🛣️ pri {op.km_opomnik.toLocaleString()} km
                              </p>
                              <div className="text-right">
                                {preostaloKm >= 0 ? (
                                  <p className={`${barvaZaKm(preostaloKm).text} font-bold text-lg leading-none`}>
                                    {preostaloKm.toLocaleString()} <span className="text-xs font-normal">km še</span>
                                  </p>
                                ) : (
                                  <p className="text-[#ef4444] font-bold text-lg leading-none">
                                    +{Math.abs(preostaloKm).toLocaleString()} <span className="text-xs font-normal">km prekoračeno</span>
                                  </p>
                                )}
                              </div>
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
