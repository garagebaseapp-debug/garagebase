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
  const [arhiv, setArhiv] = useState(false)
  const [archiveMessage, setArchiveMessage] = useState('')
  const [limitMessage, setLimitMessage] = useState('')
  const [limitAnchor, setLimitAnchor] = useState('')
  const [language, setLanguage] = useState<'sl' | 'en'>('sl')
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [nacin, setNacin] = useState<'lite' | 'full'>('full')
  const [prikaz, setPrikaz] = useState('srednje')
  const [desktopStolpci, setDesktopStolpci] = useState(5)
  const [mobileGridStolpci, setMobileGridStolpci] = useState(3)
  const [garazaPisava, setGarazaPisava] = useState(100)
  const [gridNastavitve, setGridNastavitve] = useState({
    tablica: true, km: true, opomnik: true, letnik: false, gorivo: false,
    opomnikRdeci: true, opomnikRumeni: true, opomnikZeleni: false,
    opomnikKmRdeci: true, opomnikKmRumeni: true, opomnikKmZeleni: false
  })
  const [listaNastavitve, setListaNastavitve] = useState({
    letnik: true, gorivo: true, km: true, opomnik: true, tablica: true,
    opomnikRdeci: true, opomnikRumeni: true, opomnikZeleni: false,
    opomnikKmRdeci: true, opomnikKmRumeni: true, opomnikKmZeleni: false
  })
  const dragOver = useRef<number | null>(null)
  const tx = (sl: string, en: string) => language === 'en' ? en : sl

  useEffect(() => {
    const init = async () => {
      const shranjene = localStorage.getItem('garagebase_nastavitve')
      if (shranjene) {
        const n = JSON.parse(shranjene)
        setLanguage(n.jezik === 'en' ? 'en' : 'sl')
        setNacin(n.nacin || 'full')
        setPrikaz(n.prikazGaraze || 'srednje')
        setDesktopStolpci(n.desktopStolpci || 5)
        setMobileGridStolpci(n.mobileGridStolpci || 3)
        setGarazaPisava(n.garazaPisava || 100)
        if (n.gridNastavitve) setGridNastavitve(prev => ({ ...prev, ...n.gridNastavitve }))
        if (n.listaNastavitve) setListaNastavitve(prev => ({ ...prev, ...n.listaNastavitve }))
      }

      const cached = localStorage.getItem('garagebase_garaza_cache')
      if (cached) {
        try {
          const parsed = JSON.parse(cached)
          if (Array.isArray(parsed.avti)) setAvti(parsed.avti)
          if (parsed.opomniki) setOpomniki(parsed.opomniki)
        } catch {}
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/'; return }

      const onboardingRaw = localStorage.getItem('garagebase_nastavitve')
      if (!onboardingRaw) {
        window.location.href = '/onboarding'
        return
      }
      try {
        if (JSON.parse(onboardingRaw).onboardingDone !== true) {
          window.location.href = '/onboarding'
          return
        }
      } catch {
        window.location.href = '/onboarding'
        return
      }

      const started = performance.now()
      const { data } = await supabase
        .from('cars').select('*').eq('user_id', user.id)
        .eq('arhivirano', false)
        .order('vrstni_red', { ascending: true })
      let cars = data || []
      if (!data) {
        const { data: fallback } = await supabase
          .from('cars').select('*').eq('user_id', user.id)
          .order('vrstni_red', { ascending: true })
        cars = fallback || []
      }
      setAvti(cars)

      let opomnikMap: { [key: string]: any[] } = {}
      if (cars.length > 0) {
        const ids = cars.map((avto: any) => avto.id)
        const { data: opData } = await supabase
          .from('reminders').select('*').in('car_id', ids)
          .order('datum', { ascending: true })
        for (const avto of cars) opomnikMap[avto.id] = []
        for (const op of opData || []) {
          if (!opomnikMap[op.car_id]) opomnikMap[op.car_id] = []
          opomnikMap[op.car_id].push(op)
        }
        setOpomniki(opomnikMap)
      } else {
        setOpomniki({})
      }

      localStorage.setItem('garagebase_garaza_cache', JSON.stringify({ avti: cars, opomniki: opomnikMap, savedAt: Date.now() }))
      console.info(`[GarageBase speed] garaza load ${Math.round(performance.now() - started)}ms, cars ${cars.length}`)
      setLoading(false)
    }
    init()

    const handler = (e: any) => { e.preventDefault(); setInstallPrompt(e) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  useEffect(() => {
    const refreshArchive = async () => {
      if (loading) return
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setArchiveMessage('')
      const { data, error } = await supabase
        .from('cars').select('*').eq('user_id', user.id)
        .eq('arhivirano', arhiv)
        .order('vrstni_red', { ascending: true })
      if (error) {
        setArchiveMessage(error.message.includes('arhivirano') ? 'Za arhiv najprej zazeni SUPABASE_MIGRACIJA_ARHIV_VOZIL.sql.' : error.message)
        return
      }
      const cars = data || []
      setAvti(cars)
      if (cars.length > 0) {
        const ids = cars.map((avto: any) => avto.id)
        const { data: opData } = await supabase.from('reminders').select('*').in('car_id', ids).order('datum', { ascending: true })
        const opomnikMap: { [key: string]: any[] } = {}
        for (const avto of cars) opomnikMap[avto.id] = []
        for (const op of opData || []) {
          if (!opomnikMap[op.car_id]) opomnikMap[op.car_id] = []
          opomnikMap[op.car_id].push(op)
        }
        setOpomniki(opomnikMap)
      } else {
        setOpomniki({})
      }
    }
    refreshArchive()
  }, [arhiv])

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

  const pojdiDodajAvto = async (anchor = 'header') => {
    setLimitMessage('')
    setLimitAnchor(anchor)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      window.location.href = '/'
      return
    }

    let activeCount = 0
    const activeResult = await supabase
      .from('cars')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('arhivirano', false)

    if (activeResult.error) {
      const fallback = await supabase
        .from('cars')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
      activeCount = fallback.count || 0
    } else {
      activeCount = activeResult.count || 0
    }

    if (activeCount >= 10) {
      setLimitMessage(tx(
        'V garaži imaš že največje dovoljeno število vozil (10). Arhiviraj ali izbriši vozilo, da lahko dodaš novo.',
        'You already have the maximum number of vehicles in your garage (10). Archive or delete a vehicle before adding a new one.'
      ))
      window.setTimeout(() => {
        setLimitMessage('')
        setLimitAnchor('')
      }, 6500)
      return
    }

    window.location.href = '/dodaj-avto'
  }

  const prodajniOpomnik = avti.find((avto: any) => {
    if (!avto.history_exported_at || avto.arhivirano) return false
    if (avto.archive_reminder_dismissed_until && new Date(avto.archive_reminder_dismissed_until) > new Date()) return false
    const dnevi = Math.floor((Date.now() - new Date(avto.history_exported_at).getTime()) / (1000 * 60 * 60 * 24))
    return dnevi >= 30
  })

  const preskociArhivOpomnik = async (carId: string) => {
    const until = new Date()
    until.setDate(until.getDate() + 30)
    await supabase.from('cars').update({ archive_reminder_dismissed_until: until.toISOString() }).eq('id', carId)
    setAvti(prev => prev.map(a => a.id === carId ? { ...a, archive_reminder_dismissed_until: until.toISOString() } : a))
  }

  const prviAvto = avti[0]
  const pojdiNaVnos = (pot: string) => {
    if (!prviAvto) {
      window.location.href = '/dodaj-avto'
      return
    }
    window.location.href = `${pot}?car=${prviAvto.id}`
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

  const barvaOpomnika = (carId: string, avtoKm: number) => {
    const ops = opomniki[carId] || []
    let minDni = Infinity
    let minKm = Infinity

    for (const op of ops) {
      if (op.datum) {
        const dni = Math.ceil((new Date(op.datum).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
        if (dni < minDni) minDni = dni
      }
      if (op.km_opomnik && avtoKm) {
        const preostalo = op.km_opomnik - avtoKm
        if (preostalo < minKm) minKm = preostalo
      }
    }

    // Vzamemo slabšo barvo med datumom in km
    const rdeca = (minDni !== Infinity && minDni <= 7) || (minKm !== Infinity && minKm <= 500)
    const rumena = (minDni !== Infinity && minDni <= 30) || (minKm !== Infinity && minKm <= 1500)

    if (rdeca) return 'rdeča'
    if (rumena) return 'rumena'
    if (minDni !== Infinity || minKm !== Infinity) return 'zelena'
    return null
  }

  const barvaBorder = (barva: string | null) => {
    if (barva === 'rdeča') return 'border-[#ef4444]'
    if (barva === 'rumena') return 'border-[#f59e0b]'
    if (barva === 'zelena') return 'border-[#16a34a]'
    return 'border-[#2a2a40]'
  }

  const opomnikBarva = (vrednost: number, tip: 'dni' | 'km') => {
    const rdecaMeja = tip === 'dni' ? 7 : 500
    const rumenaMeja = tip === 'dni' ? 30 : 1500
    if (vrednost <= rdecaMeja) return { text: 'text-[#ef4444]', border: 'border-[#ef444455]' }
    if (vrednost <= rumenaMeja) return { text: 'text-[#f59e0b]', border: 'border-[#f59e0b55]' }
    return { text: 'text-[#16a34a]', border: 'border-[#16a34a55]' }
  }

  const karticaVisina = () => {
    if (prikaz === 'malo') return { height: '10.5dvh', minHeight: '78px', maxHeight: '92px' }
    if (prikaz === 'veliko') return { height: '58dvh', minHeight: '420px', maxHeight: '520px' }
    return { height: '34dvh', minHeight: '250px', maxHeight: '310px' }
  }

  const OpomnikiBadgi = ({ carId, avtoKm, max, nastavitve }: { carId: string, avtoKm: number, max: number, nastavitve: any }) => {
    const ops = opomniki[carId] || []
    const badgi: any[] = []

    // Datumski opomniki
    ops
      .filter((op: any) => op.datum)
      .map((op: any) => ({
        ...op,
        dni: Math.ceil((new Date(op.datum).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)),
        tip_prikaza: 'datum'
      }))
      .filter((op: any) => {
        if (op.dni <= 7) return nastavitve.opomnikRdeci !== false
        if (op.dni <= 30) return nastavitve.opomnikRumeni !== false
        return nastavitve.opomnikZeleni === true
      })
      .forEach((op: any) => badgi.push(op))

    // Km opomniki
    ops
      .filter((op: any) => op.km_opomnik && avtoKm)
      .map((op: any) => ({
        ...op,
        preostaloKm: op.km_opomnik - avtoKm,
        tip_prikaza: 'km'
      }))
      .filter((op: any) => {
        if (op.preostaloKm <= 500) return nastavitve.opomnikKmRdeci !== false
        if (op.preostaloKm <= 1500) return nastavitve.opomnikKmRumeni !== false
        return nastavitve.opomnikKmZeleni === true
      })
      .forEach((op: any) => badgi.push(op))

    if (badgi.length === 0) return null

    return (
      <>
        {badgi.slice(0, max).map((op: any) => {
          const isDatum = op.tip_prikaza === 'datum'
          const vrednost = isDatum ? op.dni : op.preostaloKm
          const barva = opomnikBarva(vrednost, isDatum ? 'dni' : 'km')
          const tekst = isDatum
            ? `${op.dni} d`
            : `${op.preostaloKm <= 0 ? '+' + Math.abs(op.preostaloKm) : op.preostaloKm} km`

          return (
            <div key={`${isDatum ? 'd' : 'k'}-${op.id}`} className={`bg-white/75 border ${barva.border} rounded-lg px-2 py-1 flex items-center gap-1.5 shadow-sm max-w-full`}>
              <span className="text-[clamp(calc(12px*var(--gb-card-font-scale,1)),calc((30px/var(--gb-mobile-columns,3))*var(--gb-card-font-scale,1)),calc(16px*var(--gb-card-font-scale,1)))] lg:text-[12px] leading-none flex-shrink-0">{tipIkona[op.tip] || '🔔'}</span>
              <span className={`${barva.text} font-black text-[clamp(calc(12px*var(--gb-card-font-scale,1)),calc((30px/var(--gb-mobile-columns,3))*var(--gb-card-font-scale,1)),calc(16px*var(--gb-card-font-scale,1)))] lg:text-[12px] leading-none whitespace-nowrap`}>{tekst}</span>
            </div>
          )
        })}
      </>
    )
  }
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
          {avti.length > 1 && (
            <button onClick={() => setUrejanje(!urejanje)}
              className={`text-sm font-semibold px-3 py-2 rounded-xl transition-colors ${
                urejanje ? 'bg-[#3ecfcf] text-black' : 'bg-[#13131f] border border-[#1e1e32] text-[#5a5a80]'
              }`}>
              {urejanje ? '✓ Končaj' : '⇅ Uredi'}
            </button>
          )}
          <button onClick={() => pojdiDodajAvto('header')}
            className="bg-[#6c63ff] text-white text-sm font-semibold px-3 py-2 rounded-xl hover:bg-[#5a52e0] transition-colors">
            + Avto
          </button>
          <button onClick={handleLogout}
            className="text-[#5a5a80] text-sm hover:text-white transition-colors">
            Odjava
          </button>
        </div>
      </div>

      <div className="px-5 pb-3 flex gap-2">
        <button onClick={() => setArhiv(false)}
          className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold ${!arhiv ? 'bg-[#6c63ff] border-[#6c63ff] text-white' : 'bg-[#13131f] border-[#1e1e32] text-[#8080a0]'}`}>
          Aktivna vozila
        </button>
        <button onClick={() => setArhiv(true)}
          className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold ${arhiv ? 'bg-[#6c63ff] border-[#6c63ff] text-white' : 'bg-[#13131f] border-[#1e1e32] text-[#8080a0]'}`}>
          Arhiv
        </button>
      </div>

      {archiveMessage && (
        <div className="mx-5 mb-3 rounded-xl border border-[#f59e0b44] bg-[#f59e0b18] p-3 text-[#fbbf24] text-sm">
          {archiveMessage}
        </div>
      )}

      {limitMessage && limitAnchor === 'header' && (
        <div className="mx-5 mb-3 rounded-2xl border-2 border-[#ef4444] bg-[#ef44441f] p-4 text-[#fecaca] text-base font-black leading-snug shadow-lg shadow-[#ef444422]">
          {limitMessage}
        </div>
      )}

      {prodajniOpomnik && !arhiv && (
        <div className="mx-5 mb-3 rounded-2xl border border-[#3ecfcf55] bg-[#3ecfcf18] p-4">
          <p className="text-[#3ecfcf] font-bold text-sm">Je {prodajniOpomnik.znamka} {prodajniOpomnik.model} ze prodan?</p>
          <p className="text-[#7b7ba6] text-xs mt-1">Pred casom si pripravil izvoz zgodovine. Ce vozila ne uporabljas vec, ga arhiviraj in sprosti glavno garazo.</p>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <button onClick={() => window.location.href = `/nastavitve-avta?car=${prodajniOpomnik.id}`}
              className="rounded-xl bg-[#3ecfcf] text-black py-2 text-sm font-bold">Uredi/arhiviraj</button>
            <button onClick={() => preskociArhivOpomnik(prodajniOpomnik.id)}
              className="rounded-xl border border-[#1e1e32] text-[#8080a0] py-2 text-sm font-semibold">Se uporabljam</button>
          </div>
        </div>
      )}

      {loading && avti.length === 0 && (
        <div className="px-5 pb-4 space-y-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-[180px] rounded-2xl bg-[#0f0f1a] border border-[#1e1e32] overflow-hidden flex animate-pulse">
              <div className="w-1/2 bg-[#151527]" />
              <div className="w-1/2 p-4 space-y-3">
                <div className="h-5 bg-[#24243a] rounded w-3/4" />
                <div className="h-4 bg-[#1d1d30] rounded w-1/2" />
                <div className="h-8 bg-[#1d1d30] rounded mt-8" />
              </div>
            </div>
          ))}
        </div>
      )}
      {urejanje && (
        <p className="text-center text-[#5a5a80] text-xs mb-2 px-5">
          Povleci avte da spreminjaš vrstni red
        </p>
      )}

      {nacin === 'lite' && avti.length > 0 && !urejanje && (
        <div className="px-5 pb-4">
          <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="text-white font-bold text-base">Hitri vnos</p>
                <p className="text-[#5a5a80] text-xs mt-0.5">Lite nacin za najpogostejse akcije</p>
              </div>
              <button onClick={() => window.location.href = '/nastavitve'}
                className="bg-[#13131f] border border-[#1e1e32] text-[#8080a0] text-xs font-semibold px-3 py-2 rounded-xl">
                Nastavitve
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => pojdiNaVnos('/vnos-goriva')}
                className="bg-[#3ecfcf22] border border-[#3ecfcf66] text-[#3ecfcf] rounded-xl py-4 px-3 text-left font-bold">
                <span className="block text-2xl mb-1">⛽</span>
                Vnos goriva
              </button>
              <button onClick={() => pojdiNaVnos('/vnos-servisa')}
                className="bg-[#f59e0b22] border border-[#f59e0b66] text-[#f59e0b] rounded-xl py-4 px-3 text-left font-bold">
                <span className="block text-2xl mb-1">🔧</span>
                Servis
              </button>
              <button onClick={() => pojdiNaVnos('/vnos-stroska')}
                className="bg-[#6c63ff22] border border-[#6c63ff66] text-[#a09aff] rounded-xl py-4 px-3 text-left font-bold">
                <span className="block text-2xl mb-1">📊</span>
                Strosek
              </button>
              <button onClick={() => pojdiNaVnos('/opomniki')}
                className="bg-[#16a34a22] border border-[#16a34a66] text-[#4ade80] rounded-xl py-4 px-3 text-left font-bold">
                <span className="block text-2xl mb-1">🔔</span>
                Opomnik
              </button>
            </div>
          </div>
        </div>
      )}

      {!loading && avti.length === 0 ? (
        <div className="flex-1 flex items-center justify-center px-5">
          <div className="text-center">
            <p className="text-6xl mb-4">🚗</p>
            <p className="text-white font-semibold text-xl mb-2">Tvoja garaža je prazna</p>
            <p className="text-[#5a5a80] text-sm mb-6">Dodaj prvi avto in začni slediti stroškom</p>
            <button onClick={() => pojdiDodajAvto('empty')}
              className="bg-[#6c63ff] text-white font-semibold px-8 py-3 rounded-xl hover:bg-[#5a52e0] transition-colors">
              + Dodaj avto
            </button>
            {limitMessage && limitAnchor === 'empty' && (
              <p className="mt-4 rounded-2xl border-2 border-[#ef4444] bg-[#ef44441f] p-4 text-base font-black leading-snug text-[#fecaca] shadow-lg shadow-[#ef444422]">
                {limitMessage}
              </p>
            )}
          </div>
        </div>
      ) : prikaz === 'grid' ? (
        <div className="flex-1 overflow-y-auto px-3 pt-2 lg:px-0 lg:overflow-visible">
          <div className="gb-car-grid grid gap-2 lg:gap-4"
            style={{ '--gb-desktop-columns': desktopStolpci, '--gb-mobile-columns': mobileGridStolpci, '--gb-card-font-scale': garazaPisava / 100 } as any}>
            {avti.map((avto, index) => {
              const barva = barvaOpomnika(avto.id, avto.km_trenutni || 0)
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
                      loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-[#1a1630] to-[#080810]" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />


      {urejanje && (
                    <div className="absolute top-1 left-1 bg-black/60 rounded-md px-1 py-0.5">
                      <span className="text-white text-[10px]">⠿</span>
                    </div>
                  )}

                  {gridNastavitve.opomnik && !urejanje && (
                    <div className="absolute top-1 right-1 flex flex-col gap-0.5 items-end">
                      <OpomnikiBadgi carId={avto.id} avtoKm={avto.km_trenutni || 0} max={3} nastavitve={gridNastavitve} />
                    </div>
                  )}

                  <div className="absolute bottom-0 left-0 right-0 p-1.5">
                    <p className="text-white font-bold text-[clamp(calc(10px*var(--gb-card-font-scale,1)),calc((28px/var(--gb-mobile-columns,3))*var(--gb-card-font-scale,1)),calc(15px*var(--gb-card-font-scale,1)))] lg:text-[10px] leading-tight truncate">
                      {avto.znamka.charAt(0).toUpperCase() + avto.znamka.slice(1)} {avto.model.toUpperCase()}
                    </p>
                    {gridNastavitve.letnik && avto.letnik && (
                      <p className="text-white/60 text-[clamp(calc(8px*var(--gb-card-font-scale,1)),calc((22px/var(--gb-mobile-columns,3))*var(--gb-card-font-scale,1)),calc(12px*var(--gb-card-font-scale,1)))] lg:text-[8px]">{avto.letnik}</p>
                    )}
                    {gridNastavitve.gorivo && avto.gorivo && (
                      <p className="text-white/60 text-[clamp(calc(8px*var(--gb-card-font-scale,1)),calc((22px/var(--gb-mobile-columns,3))*var(--gb-card-font-scale,1)),calc(12px*var(--gb-card-font-scale,1)))] lg:text-[8px]">{avto.gorivo}</p>
                    )}
                    {gridNastavitve.km && avto.km_trenutni && (
                      <p className="text-[#3ecfcf] text-[clamp(calc(9px*var(--gb-card-font-scale,1)),calc((24px/var(--gb-mobile-columns,3))*var(--gb-card-font-scale,1)),calc(13px*var(--gb-card-font-scale,1)))] lg:text-[9px] font-semibold">{avto.km_trenutni.toLocaleString()} km</p>
                    )}
                    {gridNastavitve.tablica && avto.tablica && (
                      <div className="mt-0.5 bg-white rounded px-1 inline-block">
                        <span className="text-black font-bold text-[clamp(calc(7px*var(--gb-card-font-scale,1)),calc((19px/var(--gb-mobile-columns,3))*var(--gb-card-font-scale,1)),calc(11px*var(--gb-card-font-scale,1)))] lg:text-[7px] tracking-wider font-mono">
                          {avto.tablica.toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {!urejanje && (
              <div onClick={() => pojdiDodajAvto('grid')}
                className="aspect-square rounded-xl border-2 border-dashed border-[#2a2a40] flex items-center justify-center cursor-pointer hover:border-[#6c63ff] transition-colors">
                <div className="text-center">
                  <p className="text-[#3a3a5a] text-2xl">+</p>
                  <p className="text-[#3a3a5a] text-[9px]">Dodaj</p>
                  {limitMessage && limitAnchor === 'grid' && (
                    <p className="mx-2 mt-2 rounded-xl border border-[#ef4444] bg-[#ef444422] px-3 py-2 text-[12px] font-black leading-tight text-[#fecaca]">
                      {limitMessage}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-4 lg:overflow-visible lg:auto-rows-fr">
          {avti.map((avto, index) => {
            const barva = barvaOpomnika(avto.id, avto.km_trenutni || 0)
            if (prikaz === 'veliko') return (
              <div key={avto.id}
                draggable={urejanje}
                onDragStart={() => onDragStart(index)}
                onDragEnter={() => onDragEnter(index)}
                onDragEnd={onDragEnd}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => !urejanje && (window.location.href = `/dashboard?car=${avto.id}`)}
                className={`relative overflow-hidden transition-all lg:rounded-2xl lg:border lg:border-[#1e1e32] bg-[#0f0f1a] border-t border-[#1a1a28] ${barvaBorder(barva)} ${
                  urejanje ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                } ${dragIndex === index ? 'opacity-50 scale-95' : 'opacity-100'}`}
                style={{ ...karticaVisina(), '--gb-card-font-scale': garazaPisava / 100 } as any}>
                {avto.slika_url ? (
                  <img src={avto.slika_url} alt={`${avto.znamka} ${avto.model}`}
                    loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover object-center" />
                ) : (
                  <div className={`absolute inset-0 ${
                    index % 2 === 0
                      ? 'bg-gradient-to-br from-[#1a1630] via-[#13131f] to-[#080810]'
                      : 'bg-gradient-to-br from-[#0f1a16] via-[#13131f] to-[#080810]'
                  }`} />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-black/10" />
                {urejanje && <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#3ecfcf]" />}
                {urejanje && <div className="absolute top-3 right-3 text-white/70 text-lg">⠿</div>}

                <div className="absolute left-3 top-3 right-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-white font-black text-[calc(18px*var(--gb-card-font-scale,1))] leading-tight drop-shadow line-clamp-2">
                      {avto.znamka.charAt(0).toUpperCase() + avto.znamka.slice(1)}{' '}
                      {avto.model.toUpperCase()}
                    </h2>
                    <p className="text-white/75 text-[calc(12px*var(--gb-card-font-scale,1))] mt-1 drop-shadow">
                      {[
                        listaNastavitve.letnik && avto.letnik,
                        listaNastavitve.gorivo && avto.gorivo,
                        listaNastavitve.km && avto.km_trenutni && `${avto.km_trenutni.toLocaleString()} km`
                      ].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  {listaNastavitve.tablica && avto.tablica && (
                    <div className="bg-white border border-[#cfd7e6] rounded-md px-2 py-1 shadow-sm max-w-[42%] overflow-hidden flex-shrink-0">
                      <p className="text-[calc(12px*var(--gb-card-font-scale,1))] text-[#111827] font-black tracking-[0.12em] font-mono text-center leading-none whitespace-nowrap truncate">
                        {avto.tablica.toUpperCase()}
                      </p>
                    </div>
                  )}
                </div>

                {listaNastavitve.opomnik && !urejanje && (
                  <div className="absolute left-3 bottom-3 right-3 flex flex-wrap gap-1.5 content-end">
                    <OpomnikiBadgi carId={avto.id} avtoKm={avto.km_trenutni || 0} max={4} nastavitve={listaNastavitve} />
                  </div>
                )}
              </div>
            )
            return (
              <div key={avto.id}
                draggable={urejanje}
                onDragStart={() => onDragStart(index)}
                onDragEnter={() => onDragEnter(index)}
                onDragEnd={onDragEnd}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => !urejanje && (window.location.href = `/dashboard?car=${avto.id}`)}
                className={`relative overflow-hidden transition-all lg:rounded-2xl lg:border lg:border-[#1e1e32] bg-[#0f0f1a] border-t border-[#1a1a28] flex ${
                  urejanje ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                } ${dragIndex === index ? 'opacity-50 scale-95' : 'opacity-100'}`}
                style={{ ...karticaVisina(), '--gb-card-font-scale': garazaPisava / 100 } as any}>
                <div className={`${prikaz === 'malo' ? 'w-1/3' : 'w-1/2'} relative h-full flex-shrink-0 overflow-hidden`}>
                  {avto.slika_url ? (
                  <img src={avto.slika_url} alt={`${avto.znamka} ${avto.model}`}
                    loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover object-center" />
                ) : (
                  <div className={`absolute inset-0 ${
                    index % 2 === 0
                      ? 'bg-gradient-to-br from-[#1a1630] via-[#13131f] to-[#080810]'
                      : 'bg-gradient-to-br from-[#0f1a16] via-[#13131f] to-[#080810]'
                  }`} />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#0f0f1a]/25" />
                </div>

                {urejanje && <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#3ecfcf]" />}
                {urejanje && <div className="absolute top-3 right-3 text-white/50 text-lg">⠿</div>}

                <div className={`${prikaz === 'malo' ? 'w-2/3 p-2' : 'w-1/2 p-3'} h-full flex flex-col justify-between border-l border-[#1e1e32] min-w-0 overflow-hidden`}>
                  <div>
                    <h2 className="text-white font-bold text-[calc(16px*var(--gb-card-font-scale,1))] leading-tight line-clamp-2">
                      {avto.znamka.charAt(0).toUpperCase() + avto.znamka.slice(1)}{' '}
                      {avto.model.toUpperCase()}
                    </h2>
                    <p className="text-[#5a5a80] text-[calc(12px*var(--gb-card-font-scale,1))] mt-1">
                      {[
                        listaNastavitve.letnik && avto.letnik,
                        listaNastavitve.gorivo && avto.gorivo,
                        listaNastavitve.km && avto.km_trenutni && `${avto.km_trenutni.toLocaleString()} km`
                      ].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div className={`${prikaz === 'malo' ? 'flex-row items-end justify-between gap-2' : 'flex-col gap-2'} flex min-w-0`}>
                    <div className={`${prikaz === 'malo' ? 'min-h-0 flex-1' : 'min-h-[32px]'} flex flex-wrap gap-1.5 content-start overflow-hidden`}>
                      {listaNastavitve.opomnik && (
                        <OpomnikiBadgi carId={avto.id} avtoKm={avto.km_trenutni || 0} max={3} nastavitve={listaNastavitve} />
                      )}
                    </div>
                    {listaNastavitve.tablica && avto.tablica && (
                      <div className={`${prikaz === 'malo' ? 'w-[42%] px-1.5 py-0.5' : 'w-full px-2 py-1'} bg-white border border-[#cfd7e6] rounded-md shadow-sm overflow-hidden flex-shrink-0`}>
                        <p className="text-[calc(12px*var(--gb-card-font-scale,1))] text-[#111827] font-black tracking-[0.12em] font-mono text-center leading-none whitespace-nowrap truncate">
                          {avto.tablica.toUpperCase()}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {!urejanje && (
            <div onClick={() => pojdiDodajAvto('list')}
              className="relative cursor-pointer overflow-hidden flex items-center justify-center border-t border-[#1a1a28]"
              style={{ height: '10vh', minHeight: '70px' }}>
              <div className="absolute inset-0 bg-[#080810]" />
              <div className="relative flex items-center gap-2">
                <span className="text-[#3a3a5a] text-2xl">+</span>
                <span className={`text-sm ${limitMessage && limitAnchor === 'list' ? 'rounded-xl border-2 border-[#ef4444] bg-[#ef444422] px-3 py-2 text-base font-black leading-tight text-[#fecaca]' : 'text-[#3a3a5a]'}`}>
                  {limitMessage && limitAnchor === 'list' ? limitMessage : 'Dodaj avto'}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      <BottomNav aktivna="garaza" />
    </div>
  )
}
