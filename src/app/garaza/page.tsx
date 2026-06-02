'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { BottomNav, NavIcon } from '@/lib/nav'
import { formatDistance, type DistanceUnit } from '@/lib/units'
import { vehicleDisplayName } from '@/lib/vehicle-display'
import { GARAGE_CACHE_VERSION, imageUrlWithVersion, readGarageCache } from '@/lib/vehicle-cache'
import { TireSeasonIcon } from '@/lib/tire-icon'

const tipIkona: any = { registracija: '📋', vinjeta: '🛣️', tehnicni: '🔍', servis: '🔧', zavarovanje: '🛡️', gume: '⚫' }

export default function Garaza() {
  const router = useRouter()
  const [avti, setAvti] = useState<any[]>([])
  const [brokenImageUrls, setBrokenImageUrls] = useState<Record<string, boolean>>({})
  const [opomniki, setOpomniki] = useState<{ [key: string]: any[] }>({})
  const [loading, setLoading] = useState(true)
  const [urejanje, setUrejanje] = useState(false)
  const [arhiv, setArhiv] = useState(false)
  const [archiveMessage, setArchiveMessage] = useState('')
  const [limitMessage, setLimitMessage] = useState('')
  const [limitAnchor, setLimitAnchor] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [language, setLanguage] = useState<'sl' | 'en'>('sl')
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [nacin, setNacin] = useState<'lite' | 'full'>(() => {
    if (typeof window === 'undefined') return 'full'
    try {
      const savedSettings = JSON.parse(localStorage.getItem('garagebase_nastavitve') || '{}')
      return savedSettings?.nacin === 'lite' ? 'lite' : 'full'
    } catch {
      return 'full'
    }
  })
  const [tema, setTema] = useState<'temna' | 'svetla'>('temna')
  const [prikaz, setPrikaz] = useState('srednje')
  const [nastavitveVozilMode, setNastavitveVozilMode] = useState(false)
  const [desktopStolpci, setDesktopStolpci] = useState(5)
  const [mobileGridStolpci, setMobileGridStolpci] = useState(3)
  const [liteCarId, setLiteCarId] = useState('')
  const [liteDetailOpen, setLiteDetailOpen] = useState(false)
  const [liteUrejanje, setLiteUrejanje] = useState(false)
  const [liteHistoryOpen, setLiteHistoryOpen] = useState(false)
  const [liteHistory, setLiteHistory] = useState<any[]>([])
  const [liteHistoryLoading, setLiteHistoryLoading] = useState(false)
  const [liteHistoryFilters, setLiteHistoryFilters] = useState({ fuel: true, service: true, expense: true })
  const [garazaPisava, setGarazaPisava] = useState(100)
  const [enotaRazdalje, setEnotaRazdalje] = useState<DistanceUnit>('km')
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
  const normalizeGarageFont = (value: any) => {
    const next = Number(value)
    if (!Number.isFinite(next)) return 100
    if (next >= 160) return 110
    if (next >= 120) return 100
    return Math.min(115, Math.max(85, next))
  }
  const imeVozila = (avto: any) => vehicleDisplayName(avto, tx('Vozilo', 'Vehicle'))
  const slikaVozila = (avto: any) => {
    const rawUrl = avto?.slika_url || avto?.slika || ''
    if (!rawUrl) return ''
    const version = avto?.slika_updated_at || avto?.updated_at || avto?.created_at || GARAGE_CACHE_VERSION
    const src = imageUrlWithVersion(rawUrl, version)
    return brokenImageUrls[src] ? '' : src
  }
  const oznaciPokvarjenoSliko = (src: string) => {
    if (!src) return
    setBrokenImageUrls(prev => prev[src] ? prev : { ...prev, [src]: true })
  }
  const izbrisiSlikoVozila = async (avto: any) => {
    if (!avto?.id || !slikaVozila(avto)) return
    const ok = window.confirm(tx('Izbrišem sliko tega vozila?', 'Delete this vehicle photo?'))
    if (!ok) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      window.location.href = '/'
      return
    }
    const previousPath = String(avto?.slika_url || '').split('/car-images/')[1]?.split('?')[0]
    const deletedAt = new Date().toISOString()
    let { error } = await supabase
      .from('cars')
      .update({ slika_url: null, slika_updated_at: deletedAt })
      .eq('id', avto.id)
      .eq('user_id', user.id)
    if (error && String(error.message || '').includes('slika_updated_at')) {
      const retry = await supabase
        .from('cars')
        .update({ slika_url: null })
        .eq('id', avto.id)
        .eq('user_id', user.id)
      error = retry.error
    }
    if (error) {
      setArchiveMessage(tx('Slike ni bilo mogoče izbrisati.', 'The photo could not be deleted.'))
      return
    }
    if (previousPath) await supabase.storage.from('car-images').remove([decodeURIComponent(previousPath)])
    setAvti(prev => prev.map((item) => item.id === avto.id ? { ...item, slika_url: null, slika: null, slika_updated_at: deletedAt } : item))
    localStorage.removeItem('garagebase_garaza_cache')
    setArchiveMessage(tx('Slika je izbrisana.', 'Photo deleted.'))
  }
  const tipVozila = (avto: any) => String(avto?.tip_vozila || avto?.oblika || '').toLowerCase()
  const metaVozila = (avto: any) => [
    avto?.km_trenutni ? formatDistance(avto.km_trenutni, enotaRazdalje) : null,
    avto?.gorivo || null,
  ].filter(Boolean).join(' · ')
  const datumFormat = (value: string) => {
    try {
      return new Date(value).toLocaleDateString(language === 'en' ? 'en-US' : 'sl-SI')
    } catch {
      return value
    }
  }
  const vinjetaOpomnik = (carId: string) => (opomniki[carId] || [])
    .filter((op: any) => String(op.tip || '').toLowerCase().includes('vinjet'))
    .sort((a: any, b: any) => new Date(a.datum || '9999-12-31').getTime() - new Date(b.datum || '9999-12-31').getTime())[0]
  const vinjetaTekst = (avto: any) => {
    const op = vinjetaOpomnik(avto.id)
    if (!op?.datum) return ''
    return `${tx('Vinjeta do', 'Vignette until')} ${datumFormat(op.datum)}`
  }
  const statusOpomnika = (avto: any) => {
    const ops = opomniki[avto.id] || []
    const kandidati = ops
      .map((op: any) => ({
        op,
        dni: op.datum ? Math.ceil((new Date(op.datum).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null,
        km: op.km_opomnik ? Number(op.km_opomnik) - Number(avto.km_trenutni || 0) : null,
      }))
      .sort((a, b) => {
        const av = a.dni ?? (a.km !== null ? a.km / 50 : 99999)
        const bv = b.dni ?? (b.km !== null ? b.km / 50 : 99999)
        return av - bv
      })
    const item = kandidati[0]
    if (!item) return { text: tx('Brez opomnika', 'No reminder'), tone: 'border-[#2a2a40] bg-[#13131f] text-[#8a8ab0]' }
    const naziv = String(item.op.tip || tx('Opomnik', 'Reminder'))
    if (item.dni !== null) {
      const isVignette = String(item.op.tip || '').toLowerCase().includes('vinjet')
      const redDays = isVignette ? 14 : 7
      const tone = item.dni <= redDays ? 'border-[#ef444455] bg-[#ef444411] text-[#ef4444]' : item.dni <= 30 ? 'border-[#f59e0b55] bg-[#f59e0b11] text-[#f59e0b]' : 'border-[#16a34a55] bg-[#16a34a11] text-[#16a34a]'
      return { text: item.dni < 0 ? `${naziv}: +${Math.abs(item.dni)} d` : `${naziv}: ${item.dni} d`, tone }
    }
    if (item.km !== null) {
      const tone = item.km <= 500 ? 'border-[#ef444455] bg-[#ef444411] text-[#ef4444]' : item.km <= 1500 ? 'border-[#f59e0b55] bg-[#f59e0b11] text-[#f59e0b]' : 'border-[#16a34a55] bg-[#16a34a11] text-[#16a34a]'
      return { text: `${naziv}: ${formatDistance(item.km, enotaRazdalje)}`, tone }
    }
    return { text: naziv, tone: 'border-[#16a34a55] bg-[#16a34a11] text-[#16a34a]' }
  }
  const kategorijaVozila = (avto: any) => {
    const raw = tipVozila(avto)
    if (raw.includes('motor') || raw.includes('moto') || raw.includes('skuter')) return tx('Motorji', 'Motorcycles')
    if (raw.includes('kombi') || raw.includes('tovorn') || raw.includes('bus') || raw.includes('van')) return tx('Delovna vozila', 'Work vehicles')
    if (raw.includes('plov') || raw.includes('jaht') || raw.includes('col') || raw.includes('čol')) return tx('Plovila', 'Boats')
    return tx('Avtomobili', 'Cars')
  }
  const shraniPrikazGaraze = (next: string) => {
    setPrikaz(next)
    try {
      const current = JSON.parse(localStorage.getItem('garagebase_nastavitve') || '{}')
      localStorage.setItem('garagebase_nastavitve', JSON.stringify({ ...current, prikazGaraze: next, onboardingDone: true }))
    } catch {}
  }

  const preklopiTemo = () => {
    const next = tema === 'svetla' ? 'temna' : 'svetla'
    setTema(next)
    try {
      const current = JSON.parse(localStorage.getItem('garagebase_nastavitve') || '{}')
      localStorage.setItem('garagebase_nastavitve', JSON.stringify({ ...current, tema: next, onboardingDone: true }))
      document.documentElement.classList.toggle('light-mode', next === 'svetla')
    } catch {}
  }

  const odpriVozilo = (avto: any) => {
    if (!avto?.id || urejanje) return
    router.push(nastavitveVozilMode ? `/nastavitve-avta?car=${avto.id}` : `/dashboard?car=${avto.id}`)
  }

  const naloziOpomnike = async (cars: any[]) => {
    const opomnikMap: { [key: string]: any[] } = {}
    for (const avto of cars) opomnikMap[avto.id] = []
    if (cars.length === 0) return opomnikMap

    const ids = cars.map((avto: any) => avto.id).filter(Boolean)
    const { data: opData } = await supabase
      .from('reminders').select('*').in('car_id', ids)
      .order('datum', { ascending: true })

    for (const op of opData || []) {
      if (!opomnikMap[op.car_id]) opomnikMap[op.car_id] = []
      opomnikMap[op.car_id].push(op)
    }
    return opomnikMap
  }

  const osveziGarazo = async () => {
    if (refreshing) return
    setRefreshing(true)
    setArchiveMessage('')
    localStorage.removeItem('garagebase_garaza_cache')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/')
        return
      }

      let query = supabase
        .from('cars').select('*').eq('user_id', user.id)
        .order('vrstni_red', { ascending: true })
      query = arhiv ? query.eq('arhivirano', true) : query.or('arhivirano.is.null,arhivirano.eq.false')

      const { data, error } = await query
      if (error) {
        setArchiveMessage(error.message.includes('arhivirano') ? tx('Za arhiv najprej zazeni SUPABASE_MIGRACIJA_ARHIV_VOZIL.sql.', 'For archive, run SUPABASE_MIGRACIJA_ARHIV_VOZIL.sql first.') : error.message)
        return
      }

      let cars = data || []
      if (!arhiv && cars.length === 0) {
        const fallback = await supabase
          .from('cars').select('*').eq('user_id', user.id)
          .order('vrstni_red', { ascending: true })
        cars = (fallback.data || []).filter((car: any) => car?.arhivirano !== true)
      }
      setAvti(cars)
      setLiteCarId(prev => cars.some((car: any) => car.id === prev) ? prev : cars[0]?.id || '')
      const opomnikMap = await naloziOpomnike(cars)
      setOpomniki(opomnikMap)

      if (!arhiv) {
        localStorage.setItem('garagebase_garaza_cache', JSON.stringify({
          version: GARAGE_CACHE_VERSION,
          avti: cars,
          opomniki: opomnikMap,
          arhiv: false,
          savedAt: Date.now(),
        }))
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    const init = async () => {
      try {
        let savedMode: 'lite' | 'full' = 'full'
        try {
          const savedSettings = JSON.parse(localStorage.getItem('garagebase_nastavitve') || '{}')
          savedMode = savedSettings?.nacin === 'lite' ? 'lite' : 'full'
        } catch {}
        const search = new URLSearchParams(window.location.search)
        const manageVehicles = search.get('mode') === 'nastavitve' || search.get('mode') === 'urejanje'
        setNastavitveVozilMode(manageVehicles)
        const seenDomov = sessionStorage.getItem('garagebase_seen_domov_this_session') === '1'
        const explicitGarageOpen = search.get('direct') === '1' || search.has('mode')
        const afterLogin = Math.max(
          Number(sessionStorage.getItem('garagebase_after_login_home') || 0),
          Number(localStorage.getItem('garagebase_after_login_home') || 0),
        )
        if (savedMode !== 'lite' && ((afterLogin && Date.now() - afterLogin < 30 * 60 * 1000) || (!seenDomov && !explicitGarageOpen))) {
          sessionStorage.removeItem('garagebase_after_login_home')
          localStorage.removeItem('garagebase_after_login_home')
          router.replace('/domov')
          return
        }
      } catch {}

      const shranjene = localStorage.getItem('garagebase_nastavitve')
      if (shranjene) {
        const n = JSON.parse(shranjene)
        setLanguage(n.jezik === 'en' ? 'en' : 'sl')
        setNacin(n.nacin || 'full')
        setTema(n.tema === 'svetla' ? 'svetla' : 'temna')
        setPrikaz(n.prikazGaraze === 'premium' ? 'grid' : n.prikazGaraze || 'srednje')
        setDesktopStolpci(n.desktopStolpci || 5)
        setMobileGridStolpci(n.mobileGridStolpci || 3)
        setGarazaPisava(normalizeGarageFont(n.garazaPisava))
        setEnotaRazdalje(n.enotaRazdalje === 'mi' ? 'mi' : 'km')
        const skupneKarticneNastavitve = n.gridNastavitve || n.listaNastavitve
        if (skupneKarticneNastavitve) {
          setGridNastavitve(prev => ({ ...prev, ...skupneKarticneNastavitve }))
          setListaNastavitve(prev => ({ ...prev, ...skupneKarticneNastavitve }))
        }
      }

      const parsedCache = readGarageCache()
      if (parsedCache) {
        const cachedCars = Array.isArray(parsedCache.avti)
          ? parsedCache.avti.filter((car: any) => car?.arhivirano !== true)
          : []
        if (cachedCars.length > 0) {
          setAvti(cachedCars)
          if (cachedCars[0]?.id) setLiteCarId(prev => prev || cachedCars[0].id)
          setLoading(false)
        }
        if (parsedCache.opomniki) setOpomniki(parsedCache.opomniki)
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/'); return }

      const onboardingRaw = localStorage.getItem('garagebase_nastavitve')
      if (!onboardingRaw) {
        router.push('/onboarding')
        return
      }
      try {
        if (JSON.parse(onboardingRaw).onboardingDone !== true) {
          router.push('/onboarding')
          return
        }
      } catch {
        router.push('/onboarding')
        return
      }

      const { data } = await supabase
        .from('cars').select('*').eq('user_id', user.id)
        .or('arhivirano.is.null,arhivirano.eq.false')
        .order('vrstni_red', { ascending: true })
      let cars = data || []
      if (!data || cars.length === 0) {
        const { data: fallback } = await supabase
          .from('cars').select('*').eq('user_id', user.id)
          .order('vrstni_red', { ascending: true })
        cars = (fallback || []).filter((car: any) => car?.arhivirano !== true)
      }
      setAvti(cars)
      setLiteCarId(prev => cars.some((car: any) => car.id === prev) ? prev : cars[0]?.id || '')
      setLoading(false)
      localStorage.setItem('garagebase_garaza_cache', JSON.stringify({
        version: GARAGE_CACHE_VERSION,
        avti: cars,
        opomniki: {},
        arhiv: false,
        savedAt: Date.now(),
      }))

      const opomnikMap = await naloziOpomnike(cars)
      setOpomniki(opomnikMap)
      localStorage.setItem('garagebase_garaza_cache', JSON.stringify({
        version: GARAGE_CACHE_VERSION,
        avti: cars,
        opomniki: opomnikMap,
        arhiv: false,
        savedAt: Date.now(),
      }))
    }
    init()

    const handler = (e: any) => { e.preventDefault(); setInstallPrompt(e) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const liteAvto = avti.find((avto: any) => avto.id === liteCarId) || avti[0]
  const showLiteHome = nacin === 'lite' && !urejanje && !arhiv
  const liteHistoryVisible = liteHistory.filter((item: any) => {
    const key = item?.kind as keyof typeof liteHistoryFilters
    return key ? liteHistoryFilters[key] === true : false
  })
  const preklopiLiteHistoryFilter = (key: keyof typeof liteHistoryFilters) => {
    setLiteHistoryFilters(prev => ({ ...prev, [key]: !prev[key] }))
  }

  useEffect(() => {
    const refreshArchive = async () => {
      if (loading) return
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setArchiveMessage('')
      let query = supabase
        .from('cars').select('*').eq('user_id', user.id)
        .order('vrstni_red', { ascending: true })
      query = arhiv ? query.eq('arhivirano', true) : query.or('arhivirano.is.null,arhivirano.eq.false')
      const { data, error } = await query
      if (error) {
        setArchiveMessage(error.message.includes('arhivirano') ? 'Za arhiv najprej zazeni SUPABASE_MIGRACIJA_ARHIV_VOZIL.sql.' : error.message)
        return
      }
      let cars = data || []
      if (!arhiv && cars.length === 0) {
        const fallback = await supabase
          .from('cars').select('*').eq('user_id', user.id)
          .order('vrstni_red', { ascending: true })
        cars = (fallback.data || []).filter((car: any) => car?.arhivirano !== true)
      }
      setAvti(cars)
      setLiteCarId(prev => cars.some((car: any) => car.id === prev) ? prev : cars[0]?.id || '')
      setLoading(false)
      const opomnikMap = await naloziOpomnike(cars)
      setOpomniki(opomnikMap)
      if (!arhiv) {
        localStorage.setItem('garagebase_garaza_cache', JSON.stringify({
          version: GARAGE_CACHE_VERSION,
          avti: cars,
          opomniki: opomnikMap,
          arhiv: false,
          savedAt: Date.now(),
        }))
      }
    }
    refreshArchive()
  }, [arhiv])

  useEffect(() => {
    const loadLiteHistory = async () => {
      if (!showLiteHome || !liteDetailOpen || !liteCarId) {
        setLiteHistory([])
        return
      }
      setLiteHistoryLoading(true)
      try {
        const [fuelRes, serviceRes, expenseRes] = await Promise.all([
          supabase
            .from('fuel_logs')
            .select('id,datum,created_at,km,litri,cena_skupaj,postaja')
            .eq('car_id', liteCarId)
            .order('datum', { ascending: false })
            .limit(20),
          supabase
            .from('service_logs')
            .select('id,datum,created_at,km,opis,servis,cena')
            .eq('car_id', liteCarId)
            .order('datum', { ascending: false })
            .limit(20),
          supabase
            .from('expenses')
            .select('id,datum,created_at,znesek,opis,kategorija')
            .eq('car_id', liteCarId)
            .order('datum', { ascending: false })
            .limit(20),
        ])

        const rows = [
          ...(fuelRes.data || []).map((row: any) => ({
            id: `fuel-${row.id}`,
            kind: 'fuel',
            type: tx('Gorivo', 'Fuel'),
            icon: 'F',
            date: row.datum || row.created_at,
            title: row.postaja || tx('Tankanje', 'Fill-up'),
            meta: [row.km ? formatDistance(row.km, enotaRazdalje) : null, row.litri ? `${row.litri} L` : null].filter(Boolean).join(' · '),
            amount: row.cena_skupaj ? `${Number(row.cena_skupaj).toFixed(2)} €` : '',
          })),
          ...(serviceRes.data || []).map((row: any) => ({
            id: `service-${row.id}`,
            kind: 'service',
            type: tx('Servis', 'Service'),
            icon: 'S',
            date: row.datum || row.created_at,
            title: row.opis || row.servis || tx('Servis', 'Service'),
            meta: row.km ? formatDistance(row.km, enotaRazdalje) : '',
            amount: row.cena ? `${Number(row.cena).toFixed(2)} €` : '',
          })),
          ...(expenseRes.data || []).filter((row: any) => row?.kategorija !== 'km_sprememba').map((row: any) => ({
            id: `expense-${row.id}`,
            kind: 'expense',
            type: tx('Strosek', 'Cost'),
            icon: '€',
            date: row.datum || row.created_at,
            title: row.opis || row.kategorija || tx('Strosek', 'Cost'),
            meta: row.kategorija || '',
            amount: row.znesek ? `${Number(row.znesek).toFixed(2)} €` : '',
          })),
        ]
          .filter((row: any) => row.date)
          .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 30)

        setLiteHistory(rows)
      } catch (error) {
        console.warn('[GarageBase lite] history load failed', error)
        setLiteHistory([])
      } finally {
        setLiteHistoryLoading(false)
      }
    }

    loadLiteHistory()
  }, [showLiteHome, liteDetailOpen, liteCarId, opomniki, enotaRazdalje, language])

  const handleInstall = async () => {
    if (!installPrompt) return
    installPrompt.prompt()
    const result = await installPrompt.userChoice
    if (result.outcome === 'accepted') setInstallPrompt(null)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const pojdiDodajAvto = async (anchor = 'header') => {
    setLimitMessage('')
    setLimitAnchor(anchor)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/')
      return
    }

    let activeCount = 0
    const activeResult = await supabase
      .from('cars')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .or('arhivirano.is.null,arhivirano.eq.false')

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

    router.push('/dodaj-avto')
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
    const avto = avti.find((item: any) => item.id === carId)
    let query = supabase.from('cars').update({ archive_reminder_dismissed_until: until.toISOString() }).eq('id', carId)
    if (avto?.user_id) query = query.eq('user_id', avto.user_id)
    await query
    setAvti(prev => prev.map(a => a.id === carId ? { ...a, archive_reminder_dismissed_until: until.toISOString() } : a))
  }

  const pojdiNaVnos = (pot: string) => {
    const targetAvto = liteAvto || avti[0]
    if (!targetAvto) {
      router.push('/dodaj-avto')
      return
    }
    const addParam = pot === '/opomniki' ? '&add=1' : ''
    router.push(`${pot}?car=${targetAvto.id}${addParam}`)
  }
  const shraniLitePrikaz = (next: 'srednje' | 'grid') => {
    shraniPrikazGaraze(next)
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
    await shraniVrstniRed(avti)
  }

  const shraniVrstniRed = async (cars: any[]) => {
    for (let i = 0; i < cars.length; i++) {
      let query = supabase.from('cars').update({ vrstni_red: i }).eq('id', cars[i].id)
      if (cars[i].user_id) query = query.eq('user_id', cars[i].user_id)
      await query
    }
  }

  const premakniLiteAvto = async (index: number, smer: -1 | 1) => {
    const targetIndex = index + smer
    if (targetIndex < 0 || targetIndex >= avti.length) return
    const noviAvti = [...avti]
    const [premaknjeni] = noviAvti.splice(index, 1)
    noviAvti.splice(targetIndex, 0, premaknjeni)
    setAvti(noviAvti)
    setLiteCarId(prev => prev || noviAvti[0]?.id || '')
    await shraniVrstniRed(noviAvti)
  }

  const barvaOpomnika = (carId: string, avtoKm: number) => {
    const ops = opomniki[carId] || []
    if (ops.length === 0) return null
    let minDni = Infinity
    let minKm = Infinity
    let rdecDatum = false

    for (const op of ops) {
      if (op.datum) {
        const dni = Math.ceil((new Date(op.datum).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
        const redDays = String(op.tip || '').toLowerCase().includes('vinjet') ? 14 : 7
        if (dni <= redDays) rdecDatum = true
        if (dni < minDni) minDni = dni
      }
      if (op.km_opomnik !== null && op.km_opomnik !== undefined && op.km_opomnik !== '') {
        const preostalo = Number(op.km_opomnik) - (Number(avtoKm) || 0)
        if (preostalo < minKm) minKm = preostalo
      }
    }

    // Vzamemo slabšo barvo med datumom in km
    const rdeca = rdecDatum || (minKm !== Infinity && minKm <= 500)
    const rumena = (minDni !== Infinity && minDni <= 30) || (minKm !== Infinity && minKm <= 1500)

    if (rdeca) return 'rdeca'
    if (rumena) return 'rumena'
    if (minDni !== Infinity || minKm !== Infinity) return 'zelena'
    if (ops.length > 0) return 'zelena'
    return null
  }

  const barvaBorder = (barva: string | null) => {
    if (barva === 'rdeca') return 'border-[#ef4444]'
    if (barva === 'rumena') return 'border-[#f59e0b]'
    if (barva === 'zelena') return 'border-[#16a34a]'
    return 'border-[#2a2a40]'
  }

  const litePriorityStyle = (barva: string | null) => {
    if (barva === 'rdeca') return { border: 'border-[#ef4444]', dot: 'bg-[#ef4444]', glow: 'shadow-[#ef444433]' }
    if (barva === 'rumena') return { border: 'border-[#f59e0b]', dot: 'bg-[#f59e0b]', glow: 'shadow-[#f59e0b33]' }
    if (barva === 'zelena') return { border: 'border-[#16a34a]', dot: 'bg-[#16a34a]', glow: 'shadow-[#16a34a33]' }
    return { border: 'border-[#2a2a40]', dot: 'bg-[#5a5a80]', glow: 'shadow-transparent' }
  }

  const opomnikBarva = (vrednost: number, tip: 'dni' | 'km', tipOpomnika?: string) => {
    const rdecaMeja = tip === 'dni' ? (String(tipOpomnika || '').toLowerCase().includes('vinjet') ? 14 : 7) : 500
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
        const redDays = String(op.tip || '').toLowerCase().includes('vinjet') ? 14 : 7
        if (op.dni <= redDays) return nastavitve.opomnikRdeci !== false
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
          const barva = opomnikBarva(vrednost, isDatum ? 'dni' : 'km', op.tip)
          const tekst = isDatum
            ? `${op.dni} d`
            : `${op.preostaloKm <= 0 ? '+' + Math.abs(op.preostaloKm) : op.preostaloKm} ${enotaRazdalje}`

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

  const layoutChoices = [
    { key: 'malo', label: 'S', desc: tx('Mali seznam', 'Small list') },
    { key: 'srednje', label: 'M', desc: tx('Srednji seznam', 'Medium list') },
    { key: 'veliko', label: 'L', desc: tx('Velik prikaz', 'Large view') },
    { key: 'grid', label: '⊞ Grid', desc: tx('Kompaktno', 'Compact') },
    { key: 'kategorije', label: tx('Kategorije', 'Categories'), desc: tx('Po tipu vozila', 'By vehicle type') },
    { key: 'status', label: tx('Status', 'Status'), desc: tx('Opomniki v fokusu', 'Reminder focus') },
  ]

  const GarageLayoutPicker = () => (
    <div className="mt-3 grid grid-cols-3 gap-2">
      {layoutChoices.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => shraniPrikazGaraze(item.key)}
          className={`rounded-2xl border px-2 py-2 text-center transition-all ${
            prikaz === item.key
              ? 'border-[#6c63ff] bg-[#6c63ff22] text-[#a09aff] shadow-[0_10px_28px_rgba(108,99,255,0.18)]'
              : 'border-[#1e1e32] bg-[#0f0f1a] text-[#8a8ab0]'
          }`}
        >
          <span className="block text-[1rem] font-black leading-none">{item.label}</span>
          <span className="mt-1.5 block text-[0.78rem] font-bold leading-tight opacity-85">{item.desc}</span>
        </button>
      ))}
    </div>
  )

  const renderVehicleImage = (avto: any, index: number, className = 'h-full w-full object-contain object-center') => {
    const imageSrc = slikaVozila(avto)
    return imageSrc ? (
      <>
        <img
          src={imageSrc}
          alt={imeVozila(avto)}
          loading={index < 6 ? 'eager' : 'lazy'}
          decoding="async"
          onError={() => oznaciPokvarjenoSliko(imageSrc)}
          className={className}
        />
        <span className="absolute right-2 top-2 z-10 flex gap-1">
          <span
            role="button"
            tabIndex={0}
            onClick={(event) => { event.stopPropagation(); router.push(`/nastavitve-avta?car=${avto.id}`) }}
            className="rounded-xl border border-[#6c63ff66] bg-[#101425]/90 px-2 py-1 text-[10px] font-black text-white shadow-lg"
          >
            {tx('Zamenjaj', 'Replace')}
          </span>
          <span
            role="button"
            tabIndex={0}
            onClick={(event) => { event.stopPropagation(); izbrisiSlikoVozila(avto) }}
            className="rounded-xl border border-[#ef444466] bg-[#101425]/90 px-2 py-1 text-[10px] font-black text-[#fca5a5] shadow-lg"
          >
            {tx('Izbriši', 'Delete')}
          </span>
        </span>
      </>
    ) : (
      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#17172a] to-[#080810] px-4 text-center text-sm font-black text-[#6c63ff]">
        {imeVozila(avto)}
      </div>
    )
  }

  const renderVinjetaLine = (avto: any) => {
    const text = vinjetaTekst(avto)
    if (!text) return null
    return (
      <p className="mt-1 inline-flex w-fit items-center rounded-full border border-[#16a34a55] bg-[#16a34a11] px-2 py-1 text-[11px] font-black text-[#16a34a]">
        {text}
      </p>
    )
  }

  const renderPremiumLayout = () => {
    const glavni = avti[0]
    if (!glavni) return null
    const status = statusOpomnika(glavni)
    return (
      <div className="flex-1 overflow-y-auto px-5 pb-6">
        <div
          onClick={() => odpriVozilo(glavni)}
          className="relative mb-4 min-h-[330px] overflow-hidden rounded-[30px] border border-[#6c63ff55] bg-[#0f0f1a] shadow-[0_26px_70px_rgba(108,99,255,0.22)]"
        >
          {renderVehicleImage(glavni, 0, 'absolute inset-0 h-full w-full object-contain object-center')}
          <div className="absolute inset-0 bg-gradient-to-t from-black/82 via-black/10 to-black/0" />
          <div className="absolute left-4 top-4 rounded-full border border-white/25 bg-black/30 px-3 py-1 text-xs font-black text-white shadow-lg shadow-black/25 backdrop-blur-md">
            {tx('Glavno vozilo', 'Main vehicle')}
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-5">
            <h2 className="text-3xl font-black leading-none text-white drop-shadow">{imeVozila(glavni)}</h2>
            <p className="mt-2 text-sm font-semibold text-white/80">{metaVozila(glavni)}</p>
            {renderVinjetaLine(glavni)}
            {nastavitveVozilMode && (
              <p className="mt-3 inline-flex rounded-full border border-[#3ecfcf66] bg-[#3ecfcf22] px-3 py-1.5 text-xs font-black text-[#3ecfcf]">
                {tx('Klikni vozilo za nastavitve', 'Tap a vehicle to edit settings')}
              </p>
            )}
            <div className="mt-4 grid grid-cols-5 gap-2 rounded-3xl border border-white/15 bg-white/10 p-2 shadow-xl shadow-black/20 backdrop-blur-md">
              {[
                { label: tx('Stroški', 'Costs'), href: `/stroski?car=${glavni.id}`, icon: '▥' },
                { label: tx('Servis', 'Service'), href: `/servis?car=${glavni.id}`, icon: '⌘' },
                { label: tx('Dokumenti', 'Docs'), href: `/report?car=${glavni.id}`, icon: '▤' },
                { label: tx('Gume', 'Tires'), href: `/gume?car=${glavni.id}`, icon: 'tire' },
                { label: tx('Opomniki', 'Reminders'), href: `/opomniki?car=${glavni.id}`, icon: '!' },
              ].map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); router.push(action.href) }}
                  className="rounded-2xl border border-white/15 bg-black/30 px-2 py-3 text-center text-xs font-black text-white shadow-lg shadow-black/20 backdrop-blur-md"
                >
                  <span className="mb-1 flex min-h-6 items-center justify-center text-lg">{action.icon === 'tire' ? <TireSeasonIcon className="h-8 w-8" /> : action.icon}</span>
                  {action.label}
                </button>
              ))}
            </div>
            <div className={`mt-4 inline-flex rounded-full border px-3 py-1.5 text-xs font-black ${status.tone}`}>
              {status.text}
            </div>
          </div>
        </div>

        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-black text-white">{tx('Vsa vozila', 'All vehicles')}</h3>
          <span className="text-sm font-bold text-[#8a8ab0]">{avti.length} {tx('vozil', 'vehicles')}</span>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-3">
          {avti.map((avto, index) => (
            <button
              key={avto.id}
              onClick={() => odpriVozilo(avto)}
              className="w-[150px] shrink-0 overflow-hidden rounded-2xl border border-[#1e1e32] bg-[#0f0f1a] text-left shadow-lg shadow-black/10"
            >
              <div className="h-36 w-full overflow-hidden">{renderVehicleImage(avto, index, 'h-full w-full object-contain object-center')}</div>
              <div className="p-3">
                <p className="truncate text-sm font-black text-white">{imeVozila(avto)}</p>
                <p className="mt-1 truncate text-xs font-semibold text-[#8a8ab0]">{metaVozila(avto) || '-'}</p>
                <div className="mt-2 flex min-h-[28px] flex-wrap gap-1">
                  <OpomnikiBadgi carId={avto.id} avtoKm={avto.km_trenutni || 0} max={1} nastavitve={listaNastavitve} />
                </div>
              </div>
            </button>
          ))}
          {!arhiv && (
            <button onClick={() => pojdiDodajAvto('premium')} className="flex w-[150px] shrink-0 items-center justify-center rounded-2xl border-2 border-dashed border-[#2a2a40] bg-[#0f0f1a] text-sm font-black text-[#8a8ab0]">
              + {tx('Dodaj', 'Add')}
            </button>
          )}
        </div>
      </div>
    )
  }

  const renderCategorizedLayout = () => {
    const sections: [string, any[]][] = Array.from(avti.reduce<Map<string, any[]>>((map, avto) => {
      const key = kategorijaVozila(avto)
      map.set(key, [...(map.get(key) || []), avto])
      return map
    }, new Map<string, any[]>()))
    return (
      <div className="flex-1 overflow-y-auto px-5 pb-6">
        <div className="space-y-6">
          {sections.map(([title, cars]) => (
            <section key={title}>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-black text-white">{title}</h2>
                <span className="text-sm font-bold text-[#8a8ab0]">{cars.length}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {cars.map((avto, index) => (
                  <button
                    key={avto.id}
                    onClick={() => odpriVozilo(avto)}
                    className="overflow-hidden rounded-2xl border border-[#1e1e32] bg-[#0f0f1a] text-left shadow-lg shadow-black/10"
                  >
                    <div className="h-28 overflow-hidden">{renderVehicleImage(avto, index, 'h-full w-full object-contain object-center')}</div>
                    <div className="p-3">
                      <p className="truncate text-sm font-black text-white">{imeVozila(avto)}</p>
                      <p className="mt-1 truncate text-xs font-semibold text-[#8a8ab0]">{avto.km_trenutni ? formatDistance(avto.km_trenutni, enotaRazdalje) : '-'}</p>
                      {renderVinjetaLine(avto)}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ))}
          {!arhiv && (
            <button onClick={() => pojdiDodajAvto('kategorije')} className="w-full rounded-2xl border-2 border-dashed border-[#2a2a40] bg-[#0f0f1a] py-8 text-center text-sm font-black text-[#8a8ab0]">
              + {tx('Dodaj vozilo', 'Add vehicle')}
            </button>
          )}
        </div>
      </div>
    )
  }

  const renderStatusLayout = () => (
    <div className="flex-1 overflow-y-auto px-5 pb-6">
      <div className="space-y-3">
        {avti.map((avto, index) => {
          const status = statusOpomnika(avto)
          const statusColor = status.tone.includes('ef4444')
            ? 'border-l-[#ef4444] bg-[#ef44440d]'
            : status.tone.includes('f59e0b')
              ? 'border-l-[#f59e0b] bg-[#f59e0b0d]'
              : status.tone.includes('16a34a')
                ? 'border-l-[#16a34a] bg-[#16a34a0d]'
                : 'border-l-[#6c63ff] bg-[#0f0f1a]'
          return (
            <button
              key={avto.id}
              onClick={() => odpriVozilo(avto)}
              className={`flex w-full items-center gap-3 rounded-2xl border border-[#1e1e32] border-l-4 ${statusColor} p-3 text-left shadow-lg shadow-black/10`}
            >
              <div className="h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-[#13131f]">
                {renderVehicleImage(avto, index, 'h-full w-full object-contain object-center')}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-black text-white">{imeVozila(avto)}</p>
                <p className="mt-1 truncate text-sm font-semibold text-[#8a8ab0]">{metaVozila(avto) || '-'}</p>
                {renderVinjetaLine(avto)}
              </div>
              <div className={`max-w-[35%] rounded-2xl border px-3 py-2 text-right text-xs font-black ${status.tone}`}>
                {status.text}
              </div>
            </button>
          )
        })}
        {!arhiv && (
          <button onClick={() => pojdiDodajAvto('status')} className="w-full rounded-2xl border-2 border-dashed border-[#2a2a40] bg-[#0f0f1a] py-6 text-center text-sm font-black text-[#8a8ab0]">
            + {tx('Dodaj vozilo', 'Add vehicle')}
          </button>
        )}
      </div>
    </div>
  )

  const desktopSidebarImage = tema === 'svetla' ? '/garage-web-light-sidebar-opt.jpg' : '/landing-hero-dark-garage-opt.jpg'
  const desktopCars = avti
  const desktopListMode = prikaz !== 'grid'
  const desktopLight = tema === 'svetla'

  const DesktopReminderBadges = ({ car }: { car: any }) => (
    <div className="flex min-h-[24px] flex-wrap items-center gap-1.5">
      <OpomnikiBadgi carId={car.id} avtoKm={car.km_trenutni || 0} max={3} nastavitve={listaNastavitve} />
    </div>
  )

  const renderDesktopCategorized = () => {
    const sections: [string, any[]][] = Array.from(desktopCars.reduce<Map<string, any[]>>((map, car) => {
      const key = kategorijaVozila(car)
      map.set(key, [...(map.get(key) || []), car])
      return map
    }, new Map<string, any[]>()))
    return (
      <div className="space-y-6">
        {sections.map(([title, cars]) => (
          <section key={title}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className={`text-lg font-black ${desktopLight ? 'text-[#101225]' : 'text-white'}`}>{title}</h2>
              <span className={`text-sm font-black ${desktopLight ? 'text-[#4f5870]' : 'text-[#8a8aa8]'}`}>{cars.length}</span>
            </div>
            <div className="space-y-3">
              {cars.map((car, index) => {
                const imageSrc = slikaVozila(car)
                const status = statusOpomnika(car)
                return (
                  <button
                    key={car.id}
                    onClick={() => odpriVozilo(car)}
                    className={`grid w-full grid-cols-[88px_minmax(0,1fr)_190px] items-center gap-4 rounded-2xl border p-3 text-left shadow-xl transition-colors hover:border-[#6c63ff66] ${desktopLight ? 'border-[#dde3f2] bg-white shadow-[#101225]/6' : 'border-[#1e1e32] bg-[#0f0f1a] shadow-black/10'}`}
                  >
                    <div className={`h-20 overflow-hidden rounded-xl ${desktopLight ? 'bg-[#eef2fb]' : 'bg-[#13131f]'}`}>
                      {imageSrc ? <img src={imageSrc} alt={imeVozila(car)} loading={index < 8 ? 'eager' : 'lazy'} decoding="async" onError={() => oznaciPokvarjenoSliko(imageSrc)} className="h-full w-full object-contain object-center" /> : <div className="flex h-full w-full items-center justify-center text-xs font-black text-[#6c63ff]">{imeVozila(car)}</div>}
                    </div>
                    <div className="min-w-0">
                      <p className={`truncate text-lg font-black ${desktopLight ? 'text-[#101225]' : 'text-white'}`}>{imeVozila(car)}</p>
                      <p className={`mt-1 text-sm font-semibold ${desktopLight ? 'text-[#333a4f]' : 'text-[#8a8aa8]'}`}>{metaVozila(car) || '-'}</p>
                      <div className="mt-2"><DesktopReminderBadges car={car} /></div>
                    </div>
                    <div className="justify-self-end text-right">
                      {car.tablica && <p className={`mb-2 font-mono text-sm font-black tracking-[0.12em] ${desktopLight ? 'text-[#101225]' : 'text-white'}`}>{car.tablica.toUpperCase()}</p>}
                      <span className={`inline-flex max-w-[190px] rounded-2xl border px-3 py-2 text-xs font-black ${status.tone}`}>
                        {status.text}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    )
  }

  const renderDesktopStatus = () => (
    <div className="space-y-3">
      {desktopCars.map((car, index) => {
        const imageSrc = slikaVozila(car)
        const status = statusOpomnika(car)
        const statusColor = status.tone.includes('ef4444')
          ? 'border-l-[#ef4444] bg-[#ef44440d]'
          : status.tone.includes('f59e0b')
            ? 'border-l-[#f59e0b] bg-[#f59e0b0d]'
            : status.tone.includes('16a34a')
              ? 'border-l-[#16a34a] bg-[#16a34a0d]'
              : ''
        return (
          <button
            key={car.id}
            onClick={() => odpriVozilo(car)}
            className={`grid w-full grid-cols-[96px_minmax(0,1fr)_260px] items-center gap-5 rounded-2xl border border-l-4 p-3 text-left shadow-xl transition-colors hover:border-[#6c63ff66] ${statusColor} ${desktopLight ? 'border-[#dde3f2] bg-white shadow-[#101225]/6' : 'border-[#1e1e32] bg-[#0f0f1a] shadow-black/10'}`}
          >
            <div className={`h-20 overflow-hidden rounded-xl ${desktopLight ? 'bg-[#eef2fb]' : 'bg-[#13131f]'}`}>
              {imageSrc ? <img src={imageSrc} alt={imeVozila(car)} loading={index < 8 ? 'eager' : 'lazy'} decoding="async" onError={() => oznaciPokvarjenoSliko(imageSrc)} className="h-full w-full object-contain object-center" /> : <div className="flex h-full w-full items-center justify-center text-xs font-black text-[#6c63ff]">{imeVozila(car)}</div>}
            </div>
            <div className="min-w-0">
              <p className={`truncate text-lg font-black ${desktopLight ? 'text-[#101225]' : 'text-white'}`}>{imeVozila(car)}</p>
              <p className={`mt-1 text-sm font-semibold ${desktopLight ? 'text-[#333a4f]' : 'text-[#8a8aa8]'}`}>{metaVozila(car) || '-'}</p>
            </div>
            <div className={`justify-self-end rounded-2xl border px-4 py-3 text-right text-sm font-black ${status.tone}`}>
              {status.text}
            </div>
          </button>
        )
      })}
    </div>
  )

  const renderDesktopGarage = () => (
    <div className={`gb-desktop-garage hidden min-h-screen xl:flex ${desktopLight ? 'bg-[#eef2fb] text-[#101225]' : 'bg-[#080810] text-white'}`}>
      <aside className={`flex w-[250px] shrink-0 flex-col border-r ${desktopLight ? 'border-[#dde3f2] bg-white' : 'border-[#1e1e32] bg-[#0b0b14]'}`}>
        <div className="px-7 py-7">
          <button onClick={() => router.push('/domov')} className={`text-xl font-black tracking-tight ${desktopLight ? 'text-[#101225]' : 'text-white'}`}>
            Garage<span className="text-[#6c63ff]">Base</span>
          </button>
        </div>
        <nav className="flex-1 space-y-2 px-4 text-sm font-bold">
          {[
            { label: tx('Domov', 'Home'), href: '/domov', icon: 'home' as const },
            { label: tx('Garaža', 'Garage'), href: '/garaza', active: true, icon: 'garage' as const },
            { label: tx('Stroški', 'Costs'), href: '/stroski-garaza', icon: 'costs' as const },
            { label: tx('Gorivo', 'Fuel'), href: '/gorivo', icon: 'fuel' as const },
            { label: tx('Opomniki', 'Reminders'), href: '/opomniki', icon: 'reminders' as const },
            { label: tx('Nastavitve', 'Settings'), href: '/vec', icon: 'settings' as const },
          ].map((item) => (
            <button
              key={item.label}
              onClick={() => router.push(item.href)}
              className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors ${
                ('active' in item && item.active)
                  ? 'bg-[#6c63ff] text-white shadow-lg shadow-[#6c63ff33]'
                  : (desktopLight ? 'text-[#121421] hover:bg-[#f4f0ff] hover:text-[#6c21c9]' : 'text-[#c8c8dc] hover:bg-[#13131f] hover:text-white')
              }`}
            >
              <NavIcon type={item.icon} className="h-5 w-5 shrink-0" />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="p-4">
          <div className={`h-52 overflow-hidden rounded-[24px] border shadow-xl ${desktopLight ? 'border-[#dde3f2] bg-[#eef2fb] shadow-[#101225]/8' : 'border-[#1e1e32] bg-[#0f0f1a] shadow-black/20'}`}>
            <img src={desktopSidebarImage} alt="" className="h-full w-full object-cover object-center" />
          </div>
          <button
            onClick={() => router.push('/')}
            className={`mt-4 w-full rounded-2xl border px-4 py-3 text-left text-sm font-black transition-colors ${desktopLight ? 'border-[#dde3f2] bg-white text-[#4f5870] hover:border-[#6c63ff] hover:text-[#6c21c9]' : 'border-[#1e1e32] bg-transparent text-[#c8c8dc] hover:bg-[#13131f] hover:text-white'}`}
          >
            {tx('Uvodna stran', 'Intro page')}
          </button>
        </div>
      </aside>

      <main className={`flex min-w-0 flex-1 flex-col px-8 py-7 ${desktopLight ? 'bg-[#eef2fb]' : 'bg-[radial-gradient(circle_at_top_right,rgba(108,99,255,0.16),transparent_34%),#080810]'}`}>
        <header className="mb-6 flex items-start justify-between gap-6">
          <div>
            <h1 className={`text-3xl font-black ${desktopLight ? 'text-[#101225]' : 'text-white'}`}>{tx('Aktivna vozila', 'Active vehicles')}</h1>
            <p className={`mt-1 text-sm font-semibold ${desktopLight ? 'text-[#4f5870]' : 'text-[#8a8aa8]'}`}>
              {desktopCars.length} {tx('vozil v garaži', 'vehicles in garage')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {desktopCars.length > 1 && !arhiv && (
              <button
                onClick={() => setUrejanje(prev => !prev)}
                className={`rounded-xl border px-4 py-2 text-sm font-black transition-colors ${urejanje ? 'border-[#6c63ff] bg-[#6c63ff] text-white shadow-lg shadow-[#6c63ff33]' : (desktopLight ? 'border-[#d8def0] bg-white text-[#4f5870] shadow-lg shadow-[#101225]/5 hover:border-[#6c63ff] hover:text-[#6c21c9]' : 'border-[#2a2a40] bg-[#0f0f1a] text-[#d8d8e8] hover:border-[#6c63ff] hover:text-white')}`}
              >
                {urejanje ? tx('Končaj urejanje', 'Finish editing') : tx('Uredi vrstni red', 'Reorder')}
              </button>
            )}
            <button onClick={preklopiTemo} className={`hidden rounded-xl border px-4 py-2 text-sm font-black ${desktopLight ? 'border-[#d8def0] bg-white text-[#6c21c9] shadow-lg shadow-[#101225]/5' : 'border-[#2a2a40] bg-[#0f0f1a] text-[#d8d8e8]'}`}>
              {desktopLight ? tx('Svetli način', 'Light mode') : tx('Temni način', 'Dark mode')}
            </button>
            <button onClick={osveziGarazo} disabled={refreshing} className={`rounded-xl border px-4 py-2 text-sm font-black disabled:opacity-60 ${desktopLight ? 'border-[#6c21c9] bg-white text-[#6c21c9] shadow-lg shadow-[#101225]/5' : 'border-[#3ecfcf55] bg-[#3ecfcf12] text-[#3ecfcf]'}`}>
              {refreshing ? tx('Osveževanje...', 'Refreshing...') : tx('Osveži garažo', 'Refresh garage')}
            </button>
            <div className={`flex overflow-hidden rounded-xl border p-1 ${desktopLight ? 'border-[#d8def0] bg-white shadow-lg shadow-[#101225]/5' : 'border-[#1e1e32] bg-[#0f0f1a]'}`}>
              {[
                { key: 'malo', label: 'S', title: tx('Mali seznam', 'Small list') },
                { key: 'srednje', label: 'M', title: tx('Srednji seznam', 'Medium list') },
                { key: 'veliko', label: 'L', title: tx('Velik prikaz', 'Large view') },
                { key: 'grid', label: 'G', title: tx('Grid prikaz', 'Grid view') },
                { key: 'kategorije', label: 'K', title: tx('Kategorije', 'Categories') },
                { key: 'status', label: 'ST', title: tx('Status', 'Status') },
              ].map((item) => (
                <button
                  key={item.key}
                  title={item.title}
                  onClick={() => shraniPrikazGaraze(item.key)}
                  className={`h-9 min-w-9 rounded-lg px-2 text-sm font-black ${prikaz === item.key ? (desktopLight ? 'bg-[#6c63ff] text-white' : 'bg-[#6c63ff] text-white') : (desktopLight ? 'text-[#6b7280]' : 'text-[#8a8aa8]')}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {!arhiv && (
              <button onClick={() => pojdiDodajAvto('desktop')} className="rounded-xl bg-[#6c63ff] px-4 py-2 text-sm font-black text-white shadow-lg shadow-[#6c63ff33]">
                + {tx('Vozilo', 'Vehicle')}
              </button>
            )}
          </div>
        </header>

        <div className="mb-5 flex items-center justify-between gap-4">
          <div className={`flex w-[360px] overflow-hidden border-b ${desktopLight ? 'border-[#d8def0]' : 'border-[#1e1e32]'}`}>
            <button onClick={() => setArhiv(false)} className={`px-0 py-3 text-left text-sm font-black ${!arhiv ? (desktopLight ? 'border-b-4 border-[#6c21c9] text-[#6c21c9]' : 'border-b-4 border-[#6c63ff] text-white') : (desktopLight ? 'text-[#101225]' : 'text-[#8a8aa8]')}`}>
              {tx('Aktivna vozila', 'Active vehicles')}
            </button>
            <button onClick={() => setArhiv(true)} className={`ml-8 px-0 py-3 text-left text-sm font-black ${arhiv ? (desktopLight ? 'border-b-4 border-[#6c21c9] text-[#6c21c9]' : 'border-b-4 border-[#6c63ff] text-white') : (desktopLight ? 'text-[#101225]' : 'text-[#8a8aa8]')}`}>
              {tx('Arhiv', 'Archive')}
            </button>
          </div>
          <button className={`flex h-10 w-10 items-center justify-center rounded-xl border ${desktopLight ? 'border-[#d8def0] bg-white text-[#4f5870]' : 'border-[#1e1e32] bg-[#0f0f1a] text-[#8a8aa8]'}`}>...</button>
        </div>

        {archiveMessage && (
          <div className="mb-4 rounded-2xl border border-[#f59e0b44] bg-[#f59e0b18] p-3 text-sm text-[#fbbf24]">
            {archiveMessage}
          </div>
        )}

        {urejanje && !arhiv && (
          <div className={`mb-5 rounded-[24px] border p-4 ${desktopLight ? 'border-[#d8def0] bg-white text-[#101225] shadow-xl shadow-[#101225]/5' : 'border-[#2a2a40] bg-[#0f0f1a] text-white'}`}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black">{tx('Uredi vrstni red vozil', 'Reorder vehicles')}</p>
                <p className={`text-xs font-semibold ${desktopLight ? 'text-[#6b7280]' : 'text-[#8a8aa8]'}`}>
                  {tx('Premakni vozila gor ali dol. Vrstni red se shrani samodejno.', 'Move vehicles up or down. The order is saved automatically.')}
                </p>
              </div>
              <button
                onClick={() => setUrejanje(false)}
                className={`rounded-xl border px-4 py-2 text-sm font-black ${desktopLight ? 'border-[#d8def0] bg-[#f7f8fc] text-[#4f5870]' : 'border-[#2a2a40] bg-[#13131f] text-[#d8d8e8]'}`}
              >
                {tx('Zapri', 'Close')}
              </button>
            </div>
            <div className="grid gap-2">
              {desktopCars.map((avto: any, index: number) => (
                <div key={avto.id} className={`flex items-center justify-between gap-3 rounded-2xl border p-3 ${desktopLight ? 'border-[#e3e7f3] bg-[#f7f8fc]' : 'border-[#25253a] bg-[#11111c]'}`}>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black">{index + 1}. {imeVozila(avto)}</p>
                    <p className={`text-xs font-semibold ${desktopLight ? 'text-[#6b7280]' : 'text-[#8a8aa8]'}`}>
                      {avto.km_trenutni ? `${Number(avto.km_trenutni).toLocaleString()} km` : tx('Brez kilometrov', 'No mileage')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => premakniLiteAvto(index, -1)}
                      disabled={index === 0}
                      className={`h-9 w-9 rounded-xl border text-lg font-black disabled:opacity-35 ${desktopLight ? 'border-[#d8def0] bg-white text-[#6c21c9]' : 'border-[#2a2a40] bg-[#0f0f1a] text-white'}`}
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => premakniLiteAvto(index, 1)}
                      disabled={index === desktopCars.length - 1}
                      className={`h-9 w-9 rounded-xl border text-lg font-black disabled:opacity-35 ${desktopLight ? 'border-[#d8def0] bg-white text-[#6c21c9]' : 'border-[#2a2a40] bg-[#0f0f1a] text-white'}`}
                    >
                      ↓
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {loading && desktopCars.length === 0 ? (
          <div className="grid gap-4">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="h-24 animate-pulse rounded-2xl border border-[#1e1e32] bg-[#0f0f1a]" />
            ))}
          </div>
        ) : desktopCars.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-[28px] border border-[#1e1e32] bg-[#0f0f1a]">
            <div className="text-center">
              <p className="text-2xl font-black text-white">{arhiv ? tx('Arhiv je prazen', 'Archive is empty') : tx('Tvoja garaža je prazna', 'Your garage is empty')}</p>
              {!arhiv && (
                <button onClick={() => pojdiDodajAvto('desktop-empty')} className="mt-5 rounded-xl bg-[#6c63ff] px-6 py-3 text-sm font-black text-white">
                  + {tx('Dodaj vozilo', 'Add vehicle')}
                </button>
              )}
            </div>
          </div>
        ) : !arhiv && prikaz === 'kategorije' ? (
          renderDesktopCategorized()
        ) : !arhiv && prikaz === 'status' ? (
          renderDesktopStatus()
        ) : prikaz === 'veliko' ? (
          <div className="grid grid-cols-2 gap-5 2xl:grid-cols-3">
            {desktopCars.map((avto, index) => {
              const imageSrc = slikaVozila(avto)
              return (
                <button
                  key={avto.id}
                  onClick={() => odpriVozilo(avto)}
                  className={`overflow-hidden rounded-[28px] border text-left shadow-xl transition-colors hover:border-[#6c63ff66] ${desktopLight ? 'border-[#dde3f2] bg-white shadow-[#101225]/6' : 'border-[#1e1e32] bg-[#0f0f1a] shadow-black/10'}`}
                >
                  <div className={`h-64 ${desktopLight ? 'bg-[#eef2fb]' : 'bg-[#13131f]'}`}>
                    {imageSrc ? (
                      <img src={imageSrc} alt={imeVozila(avto)} loading={index < 6 ? 'eager' : 'lazy'} decoding="async" onError={() => oznaciPokvarjenoSliko(imageSrc)} className="h-full w-full object-contain object-center" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-lg font-black text-[#6c63ff]">{imeVozila(avto)}</div>
                    )}
                  </div>
                  <div className="p-5">
                    <div className="mb-4 flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className={`truncate text-2xl font-black ${desktopLight ? 'text-[#101225]' : 'text-white'}`}>{imeVozila(avto)}</p>
                        <p className={`mt-1 text-sm font-semibold ${desktopLight ? 'text-[#333a4f]' : 'text-[#8a8aa8]'}`}>{metaVozila(avto) || '-'}</p>
                      </div>
                      {avto.tablica && <p className={`font-mono text-sm font-black tracking-[0.12em] ${desktopLight ? 'text-[#101225]' : 'text-white'}`}>{avto.tablica.toUpperCase()}</p>}
                    </div>
                    <DesktopReminderBadges car={avto} />
                  </div>
                </button>
              )
            })}
          </div>
        ) : desktopListMode ? (
          <div className="space-y-3">
            {desktopCars.map((avto, index) => {
              const imageSrc = slikaVozila(avto)
              const compact = prikaz === 'malo'
              return (
                <button
                  key={avto.id}
                  onClick={() => odpriVozilo(avto)}
                  className={`group grid w-full items-center rounded-2xl border text-left shadow-xl transition-colors hover:border-[#6c63ff66] ${compact ? 'grid-cols-[78px_minmax(0,1fr)_220px_110px_32px] gap-4 p-2' : 'grid-cols-[116px_minmax(0,1fr)_minmax(280px,0.8fr)_120px_38px] gap-5 p-3'} ${desktopLight ? 'border-[#dde3f2] bg-white shadow-[#101225]/6' : 'border-[#1e1e32] bg-[#0f0f1a] shadow-black/10'}`}
                >
                  <div className={`${compact ? 'h-14' : 'h-20'} overflow-hidden rounded-xl ${desktopLight ? 'bg-[#eef2fb]' : 'bg-[#13131f]'}`}>
                    {imageSrc ? (
                      <img src={imageSrc} alt={imeVozila(avto)} loading={index < 8 ? 'eager' : 'lazy'} decoding="async" onError={() => oznaciPokvarjenoSliko(imageSrc)} className="h-full w-full object-contain object-center" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm font-black text-[#6c63ff]">{imeVozila(avto)}</div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className={`truncate font-black ${compact ? 'text-base' : 'text-lg'} ${desktopLight ? 'text-[#101225]' : 'text-white'}`}>{imeVozila(avto)}</p>
                    <p className={`mt-1 font-semibold ${compact ? 'text-xs' : 'text-sm'} ${desktopLight ? 'text-[#333a4f]' : 'text-[#8a8aa8]'}`}>{metaVozila(avto) || '-'}</p>
                  </div>
                  <DesktopReminderBadges car={avto} />
                  <div className="text-right">
                    {avto.tablica && <p className={`font-mono text-sm font-black tracking-[0.12em] ${desktopLight ? 'text-[#101225]' : 'text-white'}`}>{avto.tablica.toUpperCase()}</p>}
                  </div>
                  <span className={`text-lg font-black ${desktopLight ? 'text-[#5a6278]' : 'text-[#8a8aa8]'}`}>...</span>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-5 2xl:grid-cols-4">
            {desktopCars.map((avto, index) => {
              const imageSrc = slikaVozila(avto)
              return (
                <button
                  key={avto.id}
                  onClick={() => odpriVozilo(avto)}
                  className={`overflow-hidden rounded-2xl border text-left shadow-xl transition-colors hover:border-[#6c63ff66] ${desktopLight ? 'border-[#dde3f2] bg-white shadow-[#101225]/6' : 'border-[#1e1e32] bg-[#0f0f1a] shadow-black/10'}`}
                >
                  <div className={`h-40 ${desktopLight ? 'bg-[#eef2fb]' : 'bg-[#13131f]'}`}>
                    {imageSrc ? (
                      <img src={imageSrc} alt={imeVozila(avto)} loading={index < 8 ? 'eager' : 'lazy'} decoding="async" onError={() => oznaciPokvarjenoSliko(imageSrc)} className="h-full w-full object-contain object-center" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm font-black text-[#6c63ff]">{imeVozila(avto)}</div>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className={`truncate text-base font-black ${desktopLight ? 'text-[#101225]' : 'text-white'}`}>{imeVozila(avto)}</p>
                        <p className={`mt-1 text-sm font-semibold ${desktopLight ? 'text-[#333a4f]' : 'text-[#8a8aa8]'}`}>{metaVozila(avto) || '-'}</p>
                      </div>
                      <span className={`font-black ${desktopLight ? 'text-[#5a6278]' : 'text-[#8a8aa8]'}`}>...</span>
                    </div>
                    <DesktopReminderBadges car={avto} />
                    {avto.tablica && <p className={`mt-3 font-mono text-xs font-black tracking-[0.12em] ${desktopLight ? 'text-[#101225]' : 'text-white'}`}>{avto.tablica.toUpperCase()}</p>}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )

  return (
    <>
    {renderDesktopGarage()}
    <div className="flex min-h-screen flex-col bg-[#080810] pb-20 xl:hidden">

      {!showLiteHome && (
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
          {!arhiv && (
            <button onClick={() => pojdiDodajAvto('header')}
              className="bg-[#6c63ff] text-white text-sm font-semibold px-3 py-2 rounded-xl hover:bg-[#5a52e0] transition-colors">
              + Avto
            </button>
          )}
        </div>
      </div>
      )}

      {!showLiteHome && (
      <div className="px-5 pb-3">
        <div className="flex gap-2">
        <button onClick={() => setArhiv(false)}
          className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold ${!arhiv ? 'bg-[#6c63ff] border-[#6c63ff] text-white' : 'bg-[#13131f] border-[#1e1e32] text-[#8080a0]'}`}>
          Aktivna vozila
        </button>
        <button onClick={() => setArhiv(true)}
          className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold ${arhiv ? 'bg-[#6c63ff] border-[#6c63ff] text-white' : 'bg-[#13131f] border-[#1e1e32] text-[#8080a0]'}`}>
          Arhiv
        </button>
        </div>
        {!arhiv && avti.length > 0 && !showLiteHome && <GarageLayoutPicker />}
      </div>
      )}

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

      {nastavitveVozilMode && !arhiv && (
        <div className="mx-5 mb-3 rounded-2xl border border-[#3ecfcf66] bg-[#3ecfcf18] p-3 text-sm font-black leading-snug text-[#3ecfcf]">
          {tx('Način urejanja vozil: klikni vozilo za njegove nastavitve.', 'Vehicle settings mode: tap a vehicle to edit its settings.')}
        </div>
      )}

      {prodajniOpomnik && !arhiv && (
        <div className="mx-5 mb-3 rounded-2xl border border-[#3ecfcf55] bg-[#3ecfcf18] p-4">
          <p className="text-[#3ecfcf] font-bold text-sm">Je {imeVozila(prodajniOpomnik)} ze prodan?</p>
          <p className="text-[#7b7ba6] text-xs mt-1">Pred casom si pripravil izvoz zgodovine. Ce vozila ne uporabljas vec, ga arhiviraj in sprosti glavno garazo.</p>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <button onClick={() => router.push(`/nastavitve-avta?car=${prodajniOpomnik.id}`)}
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

      {showLiteHome && (
        <div className={`flex-1 overflow-y-auto px-5 pb-4 ${desktopLight ? 'bg-[#f6f7fb]' : 'bg-[#080c12]'}`}>
          <div className="space-y-5" style={{ '--gb-card-font-scale': garazaPisava / 100 } as any}>
            <div className="flex items-center justify-between gap-3 pt-1">
              <div>
                <p className={`text-[calc(26px*var(--gb-card-font-scale,1))] font-black leading-none ${desktopLight ? 'text-[#101225]' : 'text-white'}`}>
                  GarageBase <span className="rounded-lg bg-[#6c63ff] px-2 py-1 text-sm text-white">Lite</span>
                </p>
                <p className={`mt-2 text-[calc(14px*var(--gb-card-font-scale,1))] font-black ${desktopLight ? 'text-[#101225]' : 'text-white'}`}>{tx('Moja vozila', 'My vehicles')}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { setLiteDetailOpen(false); setLiteHistoryOpen(false); setLiteUrejanje(false) }}
                  className={`rounded-2xl border px-4 py-3 text-sm font-black ${desktopLight ? 'border-[#e2e7f2] bg-white text-[#6c63ff]' : 'border-[#253142] bg-[#101720] text-[#c8c4ff]'}`}>
                  {tx('Domov', 'Home')}
                </button>
                <button
                  onClick={preklopiTemo}
                  className={`rounded-2xl border px-4 py-3 text-sm font-black ${desktopLight ? 'border-[#e2e7f2] bg-white text-[#101225]' : 'border-[#253142] bg-[#101720] text-white'}`}
                  aria-label={desktopLight ? tx('Preklopi na temni način', 'Switch to dark mode') : tx('Preklopi na svetli način', 'Switch to light mode')}
                >
                  {desktopLight ? '☀' : '☾'}
                </button>
                <button onClick={() => router.push('/vec')}
                  className={`rounded-2xl border px-4 py-3 text-sm font-black ${desktopLight ? 'border-[#e2e7f2] bg-white text-[#101225]' : 'border-[#253142] bg-[#101720] text-white'}`}>
                  {tx('Nastavitve', 'Settings')}
                </button>
              </div>
            </div>

            {!liteDetailOpen && (
            <>
            <div className={`grid grid-cols-3 gap-2 rounded-2xl border p-2 ${desktopLight ? 'border-[#e2e7f2] bg-white' : 'border-[#253142] bg-[#101720]'}`}>
              <button onClick={() => shraniLitePrikaz('srednje')}
                className={`rounded-xl px-3 py-3 text-sm font-black ${prikaz !== 'grid' ? 'bg-[#6c63ff] text-white' : (desktopLight ? 'text-[#596174]' : 'text-[#a8b0c0]')}`}>
                {tx('Srednje', 'Medium')}
              </button>
              <button onClick={() => shraniLitePrikaz('grid')}
                className={`rounded-xl px-3 py-3 text-sm font-black ${prikaz === 'grid' ? 'bg-[#6c63ff] text-white' : (desktopLight ? 'text-[#596174]' : 'text-[#a8b0c0]')}`}>
                Grid
              </button>
              <button onClick={() => pojdiDodajAvto('lite')}
                className="rounded-xl bg-[#6c63ff14] px-3 py-3 text-sm font-black text-[#6c63ff]">
                + {tx('Avto', 'Vehicle')}
              </button>
            </div>
            <button
              type="button"
              onClick={() => setLiteUrejanje(prev => !prev)}
              className={`w-full rounded-2xl border px-4 py-3 text-sm font-black ${liteUrejanje ? 'border-[#6c63ff] bg-[#6c63ff] text-white' : (desktopLight ? 'border-[#e2e7f2] bg-white text-[#101225]' : 'border-[#253142] bg-[#101720] text-white')}`}
            >
              {liteUrejanje ? tx('Končaj urejanje vrstnega reda', 'Finish reordering') : tx('Uredi vrstni red vozil', 'Reorder vehicles')}
            </button>
            {liteUrejanje ? (
            <div className="space-y-2">
              {avti.map((avto: any, index: number) => (
                <div key={avto.id} className={`grid grid-cols-[minmax(0,1fr)_88px] items-center gap-3 rounded-2xl border p-3 ${desktopLight ? 'border-[#e2e7f2] bg-white text-[#101225]' : 'border-[#253142] bg-[#101720] text-white'}`}>
                  <div className="min-w-0">
                    <p className="truncate text-base font-black">{index + 1}. {imeVozila(avto)}</p>
                    <p className={`mt-1 truncate text-xs font-semibold ${desktopLight ? 'text-[#596174]' : 'text-[#a8b0c0]'}`}>{metaVozila(avto) || '-'}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => premakniLiteAvto(index, -1)}
                      disabled={index === 0}
                      className={`h-11 rounded-xl border text-lg font-black disabled:opacity-35 ${desktopLight ? 'border-[#d8def0] bg-[#f8f9fd] text-[#6c63ff]' : 'border-[#253142] bg-[#0c121a] text-[#c8c4ff]'}`}
                      aria-label={tx('Premakni gor', 'Move up')}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => premakniLiteAvto(index, 1)}
                      disabled={index === avti.length - 1}
                      className={`h-11 rounded-xl border text-lg font-black disabled:opacity-35 ${desktopLight ? 'border-[#d8def0] bg-[#f8f9fd] text-[#6c63ff]' : 'border-[#253142] bg-[#0c121a] text-[#c8c4ff]'}`}
                      aria-label={tx('Premakni dol', 'Move down')}
                    >
                      ↓
                    </button>
                  </div>
                </div>
              ))}
            </div>
            ) : prikaz === 'grid' ? (
            <div className="grid grid-cols-2 gap-3">
              {avti.map((avto: any, index: number) => {
                const imageSrc = slikaVozila(avto)
                const priority = litePriorityStyle(barvaOpomnika(avto.id, avto.km_trenutni || 0))
                return (
                  <button
                    key={avto.id}
                    onClick={() => { setLiteCarId(avto.id); setLiteDetailOpen(true); setLiteHistoryOpen(false) }}
                    className={`overflow-hidden rounded-[22px] border text-left shadow-xl transition-all ${
                      desktopLight ? 'border-[#e2e7f2] bg-white shadow-[#101225]/6' : 'border-[#253142] bg-[#101720] shadow-black/20'
                    }`}
                  >
                    <span className="relative block h-32 bg-[#f7f8fc]">
                      {imageSrc ? (
                        <img src={imageSrc} alt={imeVozila(avto)}
                          loading={index < 6 ? 'eager' : 'lazy'} decoding="async" onError={() => oznaciPokvarjenoSliko(imageSrc)} className="h-full w-full object-contain object-center" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center px-2 text-center text-xs font-black text-[#6c63ff]">
                          {imeVozila(avto)}
                        </span>
                      )}
                      <span className={`absolute right-2 top-2 h-3 w-3 rounded-full ${priority.dot} border border-white/60`} />
                    </span>
                    <span className="block p-3">
                      <span className={`block truncate text-base font-black ${desktopLight ? 'text-[#101225]' : 'text-white'}`}>{imeVozila(avto)}</span>
                      <span className={`mt-1 block truncate text-sm font-semibold ${desktopLight ? 'text-[#596174]' : 'text-[#a8b0c0]'}`}>
                        {avto.km_trenutni ? formatDistance(avto.km_trenutni, enotaRazdalje) : avto.gorivo || '-'}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
            ) : (
            <div className="space-y-3">
              {avti.map((avto: any, index: number) => {
                const selected = liteAvto?.id === avto.id
                const imageSrc = slikaVozila(avto)
                const priority = litePriorityStyle(barvaOpomnika(avto.id, avto.km_trenutni || 0))
                return (
                  <button
                    key={avto.id}
                    onClick={() => { setLiteCarId(avto.id); setLiteDetailOpen(true); setLiteHistoryOpen(false) }}
                    className={`grid w-full grid-cols-[136px_minmax(0,1fr)_24px] items-center gap-4 rounded-[22px] border p-2.5 text-left shadow-xl transition-all ${
                      desktopLight
                        ? `bg-white text-[#101225] shadow-[#101225]/6 ${selected ? 'border-[#6c63ff]' : 'border-[#e2e7f2]'}`
                        : `bg-[#101720] text-white shadow-black/20 ${selected ? 'border-[#6c63ff]' : 'border-[#253142]'}`
                    }`}
                  >
                    <span className="relative h-24 overflow-hidden rounded-[18px] bg-[#f7f8fc]">
                      {imageSrc ? (
                        <img src={imageSrc} alt={imeVozila(avto)}
                          loading={index < 6 ? 'eager' : 'lazy'} decoding="async" onError={() => oznaciPokvarjenoSliko(imageSrc)} className="h-full w-full object-contain object-center" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center px-2 text-center text-xs font-black text-[#6c63ff]">
                          {imeVozila(avto)}
                        </span>
                      )}
                      <span className={`absolute right-2 top-2 h-3 w-3 rounded-full ${priority.dot} border border-white/60`} />
                    </span>
                    <span className="min-w-0">
                      <span className={`block truncate text-[calc(21px*var(--gb-card-font-scale,1))] font-black ${desktopLight ? 'text-[#101225]' : 'text-white'}`}>{imeVozila(avto)}</span>
                      <span className={`mt-2 block truncate text-[calc(15px*var(--gb-card-font-scale,1))] font-semibold ${desktopLight ? 'text-[#596174]' : 'text-[#a8b0c0]'}`}>
                        ⛽ {avto.gorivo || tx('Gorivo', 'Fuel')}
                      </span>
                      <span className={`mt-2 block text-[calc(15px*var(--gb-card-font-scale,1))] font-semibold ${desktopLight ? 'text-[#596174]' : 'text-[#a8b0c0]'}`}>
                        {avto.km_trenutni ? formatDistance(avto.km_trenutni, enotaRazdalje) : '-'}
                      </span>
                    </span>
                    <span className={`text-3xl font-light ${desktopLight ? 'text-[#6b7280]' : 'text-[#a8b0c0]'}`}>›</span>
                  </button>
                )
              })}
            </div>
            )}
            </>
            )}

            {liteDetailOpen && liteAvto && (
              <div className={`overflow-hidden rounded-[28px] border shadow-xl ${desktopLight ? 'border-[#e2e7f2] bg-white shadow-[#101225]/6' : 'border-[#253142] bg-[#101720] shadow-black/20'}`}>
                <div className={`flex items-center gap-3 border-b px-4 py-3 ${desktopLight ? 'border-[#e2e7f2]' : 'border-[#253142]'}`}>
                  <button
                    onClick={() => { setLiteDetailOpen(false); setLiteHistoryOpen(false); setLiteUrejanje(false) }}
                    className={`h-11 w-11 rounded-2xl border text-xl font-black ${desktopLight ? 'border-[#e2e7f2] bg-white text-[#101225]' : 'border-[#253142] bg-[#0c121a] text-white'}`}
                    aria-label={tx('Nazaj na vozila', 'Back to vehicles')}
                  >
                    ‹
                  </button>
                  <div className="min-w-0">
                    <p className={`truncate text-lg font-black ${desktopLight ? 'text-[#101225]' : 'text-white'}`}>{imeVozila(liteAvto)}</p>
                    <p className={`text-sm font-semibold ${desktopLight ? 'text-[#596174]' : 'text-[#a8b0c0]'}`}>{tx('Dodaj nov vnos', 'Add a new entry')}</p>
                  </div>
                </div>
                <div className="relative h-44 bg-[#f7f8fc]">
                  {renderVehicleImage(liteAvto, 0, 'h-full w-full object-contain object-center')}
                  <button onClick={() => router.push(`/nastavitve-avta?car=${liteAvto.id}`)}
                    className="absolute right-4 top-4 rounded-2xl border border-[#6c63ff66] bg-white/95 px-4 py-2 text-sm font-black text-[#352c8f] shadow-lg">
                    {tx('Uredi', 'Edit')}
                  </button>
                  <div className="absolute bottom-4 left-4 right-4">
                    <p className="truncate text-3xl font-black text-[#101225]">{imeVozila(liteAvto)}</p>
                    <p className="mt-2 text-base font-semibold text-[#596174]">⛽ {liteAvto.gorivo || '-'} <span className="float-right">{liteAvto.km_trenutni ? formatDistance(liteAvto.km_trenutni, enotaRazdalje) : '-'}</span></p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 p-4">
                  <button onClick={() => pojdiNaVnos('/vnos-goriva')} className={`rounded-2xl border p-4 text-center font-black ${desktopLight ? 'border-[#e2e7f2] bg-[#f8f9fd] text-[#101225]' : 'border-[#253142] bg-[#0c121a] text-white'}`}>
                    <span className="mb-2 block text-3xl">⛽</span>{tx('Gorivo', 'Fuel')}
                  </button>
                  <button onClick={() => pojdiNaVnos('/vnos-servisa')} className={`rounded-2xl border p-4 text-center font-black ${desktopLight ? 'border-[#e2e7f2] bg-[#f8f9fd] text-[#101225]' : 'border-[#253142] bg-[#0c121a] text-white'}`}>
                    <span className="mb-2 block text-3xl">🔧</span>{tx('Servis', 'Service')}
                  </button>
                  <button onClick={() => pojdiNaVnos('/gume')} className={`rounded-2xl border p-4 text-center font-black ${desktopLight ? 'border-[#e2e7f2] bg-[#f8f9fd] text-[#101225]' : 'border-[#253142] bg-[#0c121a] text-white'}`}>
                    <TireSeasonIcon className="mx-auto mb-2 h-10 w-10" />{tx('Gume', 'Tires')}
                  </button>
                  <button onClick={() => pojdiNaVnos('/vnos-stroska')} className={`rounded-2xl border p-4 text-center font-black ${desktopLight ? 'border-[#e2e7f2] bg-[#f8f9fd] text-[#101225]' : 'border-[#253142] bg-[#0c121a] text-white'}`}>
                    <span className="mb-2 block text-3xl">💵</span>{tx('Strosek', 'Cost')}
                  </button>
                  <button onClick={() => pojdiNaVnos('/opomniki')} className={`rounded-2xl border p-4 text-center font-black ${desktopLight ? 'border-[#e2e7f2] bg-[#f8f9fd] text-[#101225]' : 'border-[#253142] bg-[#0c121a] text-white'}`}>
                    <span className="mb-2 block text-3xl">🔔</span>{tx('Opomnik', 'Reminder')}
                  </button>
                </div>
              </div>
            )}

            <div className="hidden grid-cols-2 gap-2">
              <button onClick={() => pojdiNaVnos('/vnos-goriva')}
                className="bg-[#3ecfcf22] border border-[#3ecfcf66] text-[#3ecfcf] rounded-xl py-4 px-3 text-left font-bold">
                <span className="block text-2xl mb-1">⛽</span>
                {tx('Vnos goriva', 'Fuel entry')}
              </button>
              <button onClick={() => pojdiNaVnos('/vnos-servisa')}
                className="bg-[#f59e0b22] border border-[#f59e0b66] text-[#f59e0b] rounded-xl py-4 px-3 text-left font-bold">
                <span className="block text-2xl mb-1">🔧</span>
                {tx('Servis', 'Service')}
              </button>
              <button onClick={() => pojdiNaVnos('/vnos-stroska')}
                className="bg-[#6c63ff22] border border-[#6c63ff66] text-[#a09aff] rounded-xl py-4 px-3 text-left font-bold">
                <span className="block text-2xl mb-1">📊</span>
                {tx('Strosek', 'Cost')}
              </button>
              <button onClick={() => pojdiNaVnos('/opomniki')}
                className="bg-[#16a34a22] border border-[#16a34a66] text-[#4ade80] rounded-xl py-4 px-3 text-left font-bold">
                <span className="block text-2xl mb-1">🔔</span>
                {tx('Opomnik', 'Reminder')}
              </button>
            </div>
            {liteDetailOpen && liteAvto && (
            <div className="grid grid-cols-1 gap-3">
              <button onClick={() => setLiteHistoryOpen(prev => !prev)}
                className={`rounded-2xl border px-4 py-4 text-base font-black ${desktopLight ? 'border-[#6c63ff33] bg-white text-[#6c63ff]' : 'border-[#6c63ff55] bg-[#6c63ff14] text-[#c8c4ff]'}`}>
                {liteHistoryOpen ? tx('Skrij zgodovino', 'Hide history') : tx('Pregled zgodovine', 'History overview')}
              </button>
              {liteHistoryOpen && (
                <div className={`rounded-[24px] border p-3 ${desktopLight ? 'border-[#e2e7f2] bg-white' : 'border-[#253142] bg-[#101720]'}`}>
                  <p className={`mb-3 px-1 text-sm font-black ${desktopLight ? 'text-[#101225]' : 'text-white'}`}>{tx('Zadnje aktivnosti', 'Latest activity')}</p>
                  <div className="mb-3 grid grid-cols-3 gap-2">
                    {[
                      { key: 'fuel', label: tx('Gorivo', 'Fuel') },
                      { key: 'service', label: tx('Servis', 'Service') },
                      { key: 'expense', label: tx('Strosek', 'Cost') },
                    ].map((filter: any) => (
                      <button
                        key={filter.key}
                        type="button"
                        onClick={() => preklopiLiteHistoryFilter(filter.key)}
                        className={`rounded-xl border px-2 py-2 text-xs font-black ${liteHistoryFilters[filter.key as keyof typeof liteHistoryFilters] ? 'border-[#6c63ff] bg-[#6c63ff] text-white' : (desktopLight ? 'border-[#e2e7f2] bg-[#f8f9fd] text-[#596174]' : 'border-[#253142] bg-[#0c121a] text-[#a8b0c0]')}`}
                      >
                        {liteHistoryFilters[filter.key as keyof typeof liteHistoryFilters] ? '✓ ' : ''}{filter.label}
                      </button>
                    ))}
                  </div>
                  {liteHistoryLoading ? (
                    <p className={`px-1 py-4 text-sm font-semibold ${desktopLight ? 'text-[#596174]' : 'text-[#a8b0c0]'}`}>{tx('Nalagam...', 'Loading...')}</p>
                  ) : liteHistoryVisible.length === 0 ? (
                    <p className={`px-1 py-4 text-sm font-semibold ${desktopLight ? 'text-[#596174]' : 'text-[#a8b0c0]'}`}>{tx('Ni zgodovine za to vozilo.', 'No history for this vehicle yet.')}</p>
                  ) : (
                    <div className="space-y-2">
                      {liteHistoryVisible.map((item: any) => (
                        <div key={item.id} className={`grid grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border p-3 ${desktopLight ? 'border-[#edf0f7] bg-[#f8f9fd]' : 'border-[#253142] bg-[#0c121a]'}`}>
                          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#6c63ff18] text-sm font-black text-[#6c63ff]">{item.icon}</span>
                          <span className="min-w-0">
                            <span className={`block truncate text-sm font-black ${desktopLight ? 'text-[#101225]' : 'text-white'}`}>{item.title}</span>
                            <span className={`block truncate text-xs font-semibold ${desktopLight ? 'text-[#596174]' : 'text-[#a8b0c0]'}`}>{item.type} · {datumFormat(item.date)}{item.meta ? ` · ${item.meta}` : ''}</span>
                          </span>
                          {item.amount && <span className="text-sm font-black text-[#3ecfcf]">{item.amount}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <button onClick={() => pojdiDodajAvto('lite')}
                className="rounded-xl border border-dashed border-[#6c63ff66] bg-[#6c63ff11] px-3 py-3 text-sm font-bold text-[#a09aff]">
                + {tx('Dodaj vozilo', 'Add vehicle')}
              </button>
            </div>
            )}
            {limitMessage && limitAnchor === 'lite' && (
              <p className="rounded-2xl border-2 border-[#ef4444] bg-[#ef44441f] p-4 text-base font-black leading-snug text-[#fecaca] shadow-lg shadow-[#ef444422]">
                {limitMessage}
              </p>
            )}
          </div>
        </div>
      )}

      {showLiteHome ? null : !loading && avti.length === 0 ? (
        <div className="flex-1 flex items-center justify-center px-5">
          <div className="text-center">
            <p className="text-6xl mb-4">🚗</p>
            <p className="text-white font-semibold text-xl mb-2">{arhiv ? tx('Arhiv je prazen', 'Archive is empty') : tx('Tvoja garaza je prazna', 'Your garage is empty')}</p>
            <p className="text-[#5a5a80] text-sm mb-6">{arhiv ? tx('Arhivirana vozila se prikazejo tukaj.', 'Archived vehicles will appear here.') : tx('Dodaj prvi avto in zacni slediti stroskom', 'Add your first car and start tracking costs')}</p>
            {!arhiv && (
              <>
                <button onClick={() => pojdiDodajAvto('empty')}
                  className="bg-[#6c63ff] text-white font-semibold px-8 py-3 rounded-xl hover:bg-[#5a52e0] transition-colors">
                  + {tx('Dodaj avto', 'Add car')}
                </button>
                {limitMessage && limitAnchor === 'empty' && (
                  <p className="mt-4 rounded-2xl border-2 border-[#ef4444] bg-[#ef44441f] p-4 text-base font-black leading-snug text-[#fecaca] shadow-lg shadow-[#ef444422]">
                    {limitMessage}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      ) : !arhiv && prikaz === 'kategorije' ? (
        renderCategorizedLayout()
      ) : !arhiv && prikaz === 'status' ? (
        renderStatusLayout()
      ) : prikaz === 'grid' ? (
        <div className="flex-1 overflow-y-auto px-3 pt-2 lg:px-0 lg:overflow-visible">
          <div className="gb-car-grid grid gap-2 lg:gap-4"
            style={{ '--gb-desktop-columns': desktopStolpci, '--gb-mobile-columns': mobileGridStolpci, '--gb-card-font-scale': garazaPisava / 100 } as any}>
            {avti.map((avto, index) => {
              const barva = barvaOpomnika(avto.id, avto.km_trenutni || 0)
              const imageSrc = slikaVozila(avto)
              return (
                <div key={avto.id}
                  draggable={urejanje}
                  onDragStart={() => onDragStart(index)}
                  onDragEnter={() => onDragEnter(index)}
                  onDragEnd={onDragEnd}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => odpriVozilo(avto)}
                  className={`relative rounded-xl overflow-hidden border-2 ${barvaBorder(barva)} aspect-square transition-all ${
                    urejanje ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                  } ${dragIndex === index ? 'opacity-50 scale-95' : 'opacity-100'}`}>
                  {imageSrc ? (
                    <img src={imageSrc} alt={imeVozila(avto)}
                      loading={index < 8 ? 'eager' : 'lazy'} decoding="async" onError={() => oznaciPokvarjenoSliko(imageSrc)} className="absolute inset-0 w-full h-full object-contain object-center" />
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
                      {imeVozila(avto)}
                    </p>
                    {gridNastavitve.letnik && avto.letnik && (
                      <p className="text-white/60 text-[clamp(calc(8px*var(--gb-card-font-scale,1)),calc((22px/var(--gb-mobile-columns,3))*var(--gb-card-font-scale,1)),calc(12px*var(--gb-card-font-scale,1)))] lg:text-[8px]">{avto.letnik}</p>
                    )}
                    {gridNastavitve.gorivo && avto.gorivo && (
                      <p className="text-white/60 text-[clamp(calc(8px*var(--gb-card-font-scale,1)),calc((22px/var(--gb-mobile-columns,3))*var(--gb-card-font-scale,1)),calc(12px*var(--gb-card-font-scale,1)))] lg:text-[8px]">{avto.gorivo}</p>
                    )}
                    {gridNastavitve.km && avto.km_trenutni && (
                      <p className="text-[#3ecfcf] text-[clamp(calc(9px*var(--gb-card-font-scale,1)),calc((24px/var(--gb-mobile-columns,3))*var(--gb-card-font-scale,1)),calc(13px*var(--gb-card-font-scale,1)))] lg:text-[9px] font-semibold">{formatDistance(avto.km_trenutni, enotaRazdalje)}</p>
                    )}
                    {gridNastavitve.km && renderVinjetaLine(avto)}
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

            {!urejanje && !arhiv && (
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
            const imageSrc = slikaVozila(avto)
            if (prikaz === 'veliko') return (
              <div key={avto.id}
                draggable={urejanje}
                onDragStart={() => onDragStart(index)}
                onDragEnter={() => onDragEnter(index)}
                onDragEnd={onDragEnd}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => odpriVozilo(avto)}
                className={`relative overflow-hidden transition-all lg:rounded-2xl lg:border lg:border-[#1e1e32] bg-[#0f0f1a] border-t border-[#1a1a28] ${barvaBorder(barva)} ${
                  urejanje ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                } ${dragIndex === index ? 'opacity-50 scale-95' : 'opacity-100'}`}
                style={{ ...karticaVisina(), '--gb-card-font-scale': garazaPisava / 100 } as any}>
                {imageSrc ? (
                  <img src={imageSrc} alt={imeVozila(avto)}
                    loading={index < 6 ? 'eager' : 'lazy'} decoding="async" onError={() => oznaciPokvarjenoSliko(imageSrc)} className="absolute inset-0 w-full h-full object-contain object-center" />
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
                      {imeVozila(avto)}
                    </h2>
                    <p className="text-white/75 text-[calc(12px*var(--gb-card-font-scale,1))] mt-1 drop-shadow">
                      {[
                        listaNastavitve.letnik && avto.letnik,
                        listaNastavitve.gorivo && avto.gorivo,
                        listaNastavitve.km && avto.km_trenutni && formatDistance(avto.km_trenutni, enotaRazdalje)
                      ].filter(Boolean).join(' · ')}
                    </p>
                    {listaNastavitve.km && renderVinjetaLine(avto)}
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
                onClick={() => odpriVozilo(avto)}
                className={`relative overflow-hidden transition-all lg:rounded-2xl lg:border lg:border-[#1e1e32] bg-[#0f0f1a] border-t border-[#1a1a28] flex ${
                  urejanje ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                } ${dragIndex === index ? 'opacity-50 scale-95' : 'opacity-100'}`}
                style={{ ...karticaVisina(), '--gb-card-font-scale': garazaPisava / 100 } as any}>
                <div className={`${prikaz === 'malo' ? 'w-1/3' : 'w-1/2'} relative h-full flex-shrink-0 overflow-hidden`}>
                  {imageSrc ? (
                  <img src={imageSrc} alt={imeVozila(avto)}
                    loading={index < 8 ? 'eager' : 'lazy'} decoding="async" onError={() => oznaciPokvarjenoSliko(imageSrc)} className="absolute inset-0 w-full h-full object-contain object-center" />
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
                      {imeVozila(avto)}
                    </h2>
                    <p className="text-[#5a5a80] text-[calc(12px*var(--gb-card-font-scale,1))] mt-1">
                      {[
                        listaNastavitve.letnik && avto.letnik,
                        listaNastavitve.gorivo && avto.gorivo,
                        listaNastavitve.km && avto.km_trenutni && formatDistance(avto.km_trenutni, enotaRazdalje)
                      ].filter(Boolean).join(' · ')}
                    </p>
                    {listaNastavitve.km && renderVinjetaLine(avto)}
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

          {!urejanje && !arhiv && (
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

      {showLiteHome ? null : <BottomNav aktivna="garaza" />}
    </div>
    </>
  )
}
