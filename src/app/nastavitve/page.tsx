'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { BottomNav } from '@/lib/nav'
import { saveStoredLanguage, type Language } from '@/lib/i18n'
import { trackEvent } from '@/lib/analytics'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }

  return outputArray
}

export default function Nastavitve() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [nacin, setNacin] = useState<'lite' | 'full'>('full')
  const [jezik, setJezik] = useState('sl')
  const [pisava, setPisava] = useState('normalna')
  const [prikazGaraze, setPrikazGaraze] = useState('srednje')
  const [desktopStolpci, setDesktopStolpci] = useState(5)
  const [mobileGridStolpci, setMobileGridStolpci] = useState(3)
  const [garazaPisava, setGarazaPisava] = useState(100)
  const [avtocomplete, setAvtocomplete] = useState(true)
  const [tema, setTema] = useState('temna')
  const [notifikacije, setNotifikacije] = useState<'neznano' | 'dovoljeno' | 'zavrnjeno'>('neznano')
  const [notifikacijeLoading, setNotifikacijeLoading] = useState(false)
  const [testLoading, setTestLoading] = useState(false)
  const [biometricSupported, setBiometricSupported] = useState(false)
  const [appLockEnabled, setAppLockEnabled] = useState(false)
  const [appLockLoading, setAppLockLoading] = useState(false)
  const [appLockMessage, setAppLockMessage] = useState('')
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
  const [isAdmin, setIsAdmin] = useState(false)
  const [message, setMessage] = useState('')

  const trackSettingsSnapshot = (eventName: string, values: any = {}) => {
    trackEvent(eventName, {
      usageMode: values.nacin || nacin,
      language: values.jezik || jezik,
      fontSize: values.pisava || pisava,
      garageDisplay: values.prikazGaraze || prikazGaraze,
      theme: values.tema || tema,
      desktopColumns: values.desktopStolpci || desktopStolpci,
      mobileGridColumns: values.mobileGridStolpci || mobileGridStolpci,
      cardFontPercent: values.garazaPisava || garazaPisava,
      autocomplete: values.avtocomplete !== undefined ? values.avtocomplete : avtocomplete,
      appLockEnabled: localStorage.getItem('garagebase_app_lock_enabled') === 'true',
      gridSettings: values.gridNastavitve || gridNastavitve,
      listSettings: values.listaNastavitve || listaNastavitve,
    })
  }

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/'; return }
      setUser(user)
      const { data: adminRow } = await supabase
        .from('admin_users')
        .select('email')
        .eq('email', user.email)
        .maybeSingle()
      setIsAdmin(!!adminRow)
      const shranjeneNastavitve = localStorage.getItem('garagebase_nastavitve')
      let loadedSettings: any = {}
      if (shranjeneNastavitve) {
        const n = JSON.parse(shranjeneNastavitve)
        loadedSettings = n
        setNacin(n.nacin || 'full')
        setJezik(n.jezik || 'sl')
        setPisava(n.pisava || 'normalna')
        setPrikazGaraze(n.prikazGaraze || 'srednje')
        setDesktopStolpci(n.desktopStolpci || 5)
        setMobileGridStolpci(n.mobileGridStolpci || 3)
        setGarazaPisava(n.garazaPisava || 100)
        setAvtocomplete(n.avtocomplete !== false)
        setTema(n.tema || 'temna')
        if (n.gridNastavitve) setGridNastavitve(prev => ({ ...prev, ...n.gridNastavitve }))
        if (n.listaNastavitve) setListaNastavitve(prev => ({ ...prev, ...n.listaNastavitve }))
        if (n.tema === 'svetla') {
          document.documentElement.classList.add('light-mode')
        } else {
          document.documentElement.classList.remove('light-mode')
        }
      }
      if ('Notification' in window) {
        if (Notification.permission === 'granted') {
          const registration = await navigator.serviceWorker.getRegistration('/sw.js')
          const subscription = await registration?.pushManager.getSubscription()
          setNotifikacije(subscription ? 'dovoljeno' : 'neznano')
        } else if (Notification.permission === 'denied') setNotifikacije('zavrnjeno')
        else setNotifikacije('neznano')
      }
      setBiometricSupported('PublicKeyCredential' in window && window.isSecureContext)
      setAppLockEnabled(localStorage.getItem('garagebase_app_lock_enabled') === 'true')
      trackEvent('settings_open')
      trackSettingsSnapshot('settings_snapshot', loadedSettings)
      setLoading(false)
    }
    init()
  }, [])

  const vklopiNotifikacije = async () => {
    setNotifikacijeLoading(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setNotifikacije('zavrnjeno')
        setMessage('❌ Obvestila so zavrnjena. Dovoli jih v nastavitvah brskalnika.')
        setNotifikacijeLoading(false)
        return
      }
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidPublicKey) {
        setMessage('Push ključi niso nastavljeni.')
        setNotifikacijeLoading(false)
        return
      }

      const registration = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
      const existingSubscription = await registration.pushManager.getSubscription()
      const subscription = existingSubscription || await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      })
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('push_subscriptions').upsert({
        user_id: user?.id,
        subscription: subscription.toJSON()
      })
      setNotifikacije('dovoljeno')
      setMessage('✅ Obvestila so vklopljena!')
      setTimeout(() => setMessage(''), 3000)
    } catch (error) {
      console.error('Napaka:', error)
      setMessage('❌ Napaka pri vklopu obvestil.')
    }
    setNotifikacijeLoading(false)
  }

  const posljiTestnoObvestilo = async () => {
    setTestLoading(true)
    try {
      const registration = await navigator.serviceWorker.getRegistration('/sw.js')
      const subscription = await registration?.pushManager.getSubscription()

      if (!subscription) {
        setNotifikacije('neznano')
        setMessage('Obvestila niso povezana s tem telefonom. Klikni Vklopi obvestila.')
        setTestLoading(false)
        return
      }

      const response = await fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          title: 'GarageBase test',
          body: 'Če vidiš to obvestilo, push deluje.',
          url: '/nastavitve'
        })
      })

      if (!response.ok) throw new Error('Testno obvestilo ni bilo poslano.')

      setMessage('Testno obvestilo poslano.')
      setTimeout(() => setMessage(''), 3000)
    } catch (error) {
      console.error('Test obvestila:', error)
      setMessage('Test obvestila ni uspel.')
    }
    setTestLoading(false)
  }

  const shrani = () => {
    const raw = localStorage.getItem('garagebase_nastavitve')
    const current = raw ? JSON.parse(raw) : {}
    const nastavitve = { ...current, nacin, jezik, pisava, prikazGaraze, desktopStolpci, mobileGridStolpci, garazaPisava, avtocomplete, tema, gridNastavitve, listaNastavitve, onboardingDone: true }
    localStorage.setItem('garagebase_nastavitve', JSON.stringify(nastavitve))
    trackSettingsSnapshot('settings_saved', nastavitve)
    const velikosti: any = { mala: '25px', normalna: '35px', velika: '45px' }
    const jeApp = window.matchMedia('(display-mode: standalone)').matches || window.innerWidth < 1024
    if (jeApp) document.documentElement.style.fontSize = velikosti[pisava]
    else document.documentElement.style.removeProperty('font-size')
    setMessage('✅ Nastavitve shranjene!')
    setTimeout(() => setMessage(''), 2000)
  }

  const preklopiTemo = () => {
    const novaTema = tema === 'temna' ? 'svetla' : 'temna'
    setTema(novaTema)
    const raw = localStorage.getItem('garagebase_nastavitve')
    const current = raw ? JSON.parse(raw) : {}
    localStorage.setItem('garagebase_nastavitve', JSON.stringify({ ...current, tema: novaTema }))
    if (novaTema === 'svetla') {
      document.documentElement.classList.add('light-mode')
    } else {
      document.documentElement.classList.remove('light-mode')
    }
  }


  const bufferToBase64Url = (buffer: ArrayBuffer) => {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
    return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
  }

  const vklopiAppLock = async () => {
    setAppLockLoading(true)
    setAppLockMessage('')
    try {
      if (!('PublicKeyCredential' in window) || !window.isSecureContext) {
        setAppLockMessage('Ta naprava ali brskalnik ne podpira varnega biometričnega odklepa.')
        setAppLockLoading(false)
        return
      }

      const userId = new TextEncoder().encode(user?.id || user?.email || 'garagebase-user')
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rp: { name: 'GarageBase' },
          user: {
            id: userId,
            name: user?.email || 'GarageBase uporabnik',
            displayName: user?.email || 'GarageBase uporabnik'
          },
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
          authenticatorSelection: {
            userVerification: 'required',
            residentKey: 'preferred'
          },
          timeout: 60000,
          attestation: 'none'
        }
      }) as PublicKeyCredential | null

      if (!credential) throw new Error('Credential ni bil ustvarjen.')
      localStorage.setItem('garagebase_app_lock_credential', bufferToBase64Url(credential.rawId))
      localStorage.setItem('garagebase_app_lock_enabled', 'true')
      setAppLockEnabled(true)
      trackEvent('app_lock_enabled')
      setAppLockMessage('Odklep aplikacije je vklopljen.')
    } catch (error) {
      console.error('App lock:', error)
      setAppLockMessage('Odklepa ni bilo mogoče vklopiti. Poskusi na telefonu v nameščeni aplikaciji.')
    }
    setAppLockLoading(false)
  }

  const izklopiAppLock = () => {
    localStorage.removeItem('garagebase_app_lock_enabled')
    localStorage.removeItem('garagebase_app_lock_credential')
    setAppLockEnabled(false)
    trackEvent('app_lock_disabled')
    setAppLockMessage('Odklep aplikacije je izklopljen.')
  }
  const spremeniJezik = (novJezik: Language) => {
    setJezik(novJezik)
    saveStoredLanguage(novJezik)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  // Filter za datumske in km opomnike
  const OpomnikFilter = ({ nastavitve, setNastavitve }: { nastavitve: any, setNastavitve: any }) => (
    <div className="mt-3 pt-3 border-t border-[#1e1e32] flex flex-col gap-3">

      {/* Datumski opomniki */}
      <div>
        <p className="text-[#5a5a80] text-xs mb-2">📅 Prikaži datumske opomnike:</p>
        <div className="flex gap-2">
          {[
            { key: 'opomnikRdeci', naziv: '🔴 Nujni', opis: '<7 dni' },
            { key: 'opomnikRumeni', naziv: '🟡 Kmalu', opis: '<30 dni' },
            { key: 'opomnikZeleni', naziv: '🟢 Vsi', opis: '>30 dni' },
          ].map((item) => (
            <button key={item.key}
              onClick={() => setNastavitve((prev: any) => ({ ...prev, [item.key]: !prev[item.key] }))}
              className={`flex-1 py-2 px-1 rounded-xl border text-center transition-all ${
                nastavitve[item.key]
                  ? 'bg-[#6c63ff22] border-[#6c63ff66]'
                  : 'bg-[#13131f] border-[#1e1e32]'
              }`}>
              <p className="text-xs">{item.naziv}</p>
              <p className="text-[#5a5a80] text-[9px]">{item.opis}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Km opomniki */}
      <div>
        <p className="text-[#5a5a80] text-xs mb-2">🛣️ Prikaži km opomnike:</p>
        <div className="flex gap-2">
          {[
            { key: 'opomnikKmRdeci', naziv: '🔴 Nujni', opis: '<500 km' },
            { key: 'opomnikKmRumeni', naziv: '🟡 Kmalu', opis: '<1500 km' },
            { key: 'opomnikKmZeleni', naziv: '🟢 Vsi', opis: '>1500 km' },
          ].map((item) => (
            <button key={item.key}
              onClick={() => setNastavitve((prev: any) => ({ ...prev, [item.key]: !prev[item.key] }))}
              className={`flex-1 py-2 px-1 rounded-xl border text-center transition-all ${
                nastavitve[item.key]
                  ? 'bg-[#6c63ff22] border-[#6c63ff66]'
                  : 'bg-[#13131f] border-[#1e1e32]'
              }`}>
              <p className="text-xs">{item.naziv}</p>
              <p className="text-[#5a5a80] text-[9px]">{item.opis}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )

  if (loading) return (
    <div className="min-h-screen bg-[#080810] flex items-center justify-center">
      <p className="text-[#5a5a80]">Nalaganje...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#080810] px-4 py-6 pb-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 overflow-hidden rounded-3xl border border-[#1e1e32] bg-[#0f0f1a] p-5 lg:p-7">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#6c63ff]">Settings</p>
              <h1 className="mt-2 text-3xl font-black text-white">
                Garage<span className="text-[#6c63ff]">Base</span>
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-[#5a5a80]">
                Uredi prikaz, varnost, jezik, prenos podatkov in delovanje aplikacije na enem mestu.
              </p>
            </div>
            <div className="rounded-2xl border border-[#1e1e32] bg-[#13131f] px-4 py-3 text-sm text-[#5a5a80]">
              <span className="font-semibold text-white">{user?.email}</span>
              <span className="mx-2 text-[#3a3a5a]">/</span>
              Free paket
            </div>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="hidden xl:block">
            <nav className="sticky top-28 rounded-3xl border border-[#1e1e32] bg-[#0f0f1a] p-3">
              {[
                ['Profil', '#profil'],
                ['Varnost', '#varnost'],
                ['Prenos', '#prenos'],
                ['Uporaba', '#uporaba'],
                ['Prikaz', '#garaza-prikaz'],
                ['Feedback', '#feedback'],
                ['Aplikacija', '#aplikacija'],
                ...(isAdmin ? [['Admin panel', '/admin']] : []),
              ].map(([label, href]) => (
                <a key={href} href={href}
                  className={`flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-semibold transition-colors ${
                    href === '/admin'
                      ? 'mt-3 border border-[#6c63ff66] bg-[#6c63ff22] text-[#a09aff] hover:bg-[#6c63ff33]'
                      : 'text-[#5a5a80] hover:bg-[#6c63ff11] hover:text-[#a09aff]'
                  }`}>
                  {label}
                  <span className="text-[#3a3a5a]">→</span>
                </a>
              ))}
            </nav>
          </aside>

          <main className="grid gap-4 lg:grid-cols-2">

      {/* Profil */}
      <div id="profil" className="scroll-mt-28 bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5 lg:col-span-2">
        <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-3">Profil</p>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#6c63ff22] border border-[#6c63ff44] flex items-center justify-center">
            <span className="text-2xl">👤</span>
          </div>
          <div>
            <p className="text-white font-semibold">{user?.email}</p>
            <p className="text-[#5a5a80] text-xs mt-0.5">Free paket</p>
          </div>
        </div>
      </div>

      {/* Tema */}
      <div id="tema" className="scroll-mt-28 bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-white font-semibold text-sm">
              {tema === 'temna' ? '🌙 Temni način' : '☀️ Svetli način'}
            </p>
            <p className="text-[#5a5a80] text-xs mt-0.5">Preklopi med temnim in svetlim</p>
          </div>
          <button onClick={preklopiTemo}
            className={`w-12 h-6 rounded-full transition-all relative ${
              tema === 'svetla' ? 'bg-[#6c63ff]' : 'bg-[#2a2a40]'
            }`}>
            <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${
              tema === 'svetla' ? 'left-6' : 'left-0.5'
            }`} />
          </button>
        </div>
      </div>

      {/* Obvestila */}
      <div id="obvestila" className="scroll-mt-28 bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5">
        <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-1">Obvestila</p>
        <p className="text-[#3a3a5a] text-xs mb-3">Opomniki za registracijo, servis in vinjeto</p>
        {notifikacije === 'dovoljeno' ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 bg-[#16a34a22] border border-[#16a34a44] rounded-xl p-3">
              <span className="text-xl">🔔</span>
              <div>
                <p className="text-[#4ade80] text-sm font-semibold">Obvestila so vklopljena</p>
                <p className="text-[#5a5a80] text-xs">Prejeli boste opomnike ob 8:00</p>
              </div>
            </div>
            <button onClick={posljiTestnoObvestilo} disabled={testLoading}
              className="w-full bg-[#13131f] border border-[#1e1e32] text-[#a09aff] font-semibold py-3 rounded-xl hover:border-[#6c63ff66] transition-colors disabled:opacity-50">
              {testLoading ? 'Pošiljam test...' : 'Pošlji test'}
            </button>
          </div>
        ) : notifikacije === 'zavrnjeno' ? (
          <div className="flex items-center gap-3 bg-[#ef444422] border border-[#ef444444] rounded-xl p-3">
            <span className="text-xl">🔕</span>
            <div>
              <p className="text-[#fca5a5] text-sm font-semibold">Obvestila so zavrnjena</p>
              <p className="text-[#5a5a80] text-xs">Dovoli jih v nastavitvah brskalnika</p>
            </div>
          </div>
        ) : (
          <button onClick={vklopiNotifikacije} disabled={notifikacijeLoading}
            className="w-full bg-[#6c63ff22] border border-[#6c63ff66] text-[#a09aff] font-semibold py-3 rounded-xl hover:bg-[#6c63ff33] transition-colors disabled:opacity-50">
            {notifikacijeLoading ? 'Vklapljam...' : '🔔 Vklopi obvestila'}
          </button>
        )}
      </div>


      {/* App lock */}
      <div id="varnost" className="scroll-mt-28 bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5">
        <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-1">Varnost</p>
        <p className="text-white font-semibold text-sm">Odklep z biometrijo</p>
        <p className="text-[#5a5a80] text-xs mt-1 mb-3">Zakleni app z odtisom, obrazom ali PIN-om naprave.</p>
        {!biometricSupported ? (
          <div className="bg-[#f59e0b22] border border-[#f59e0b44] text-[#fbbf24] text-sm rounded-xl p-3">
            Ta brskalnik trenutno ne podpira varnega odklepa. Poskusi v nameščeni aplikaciji na telefonu.
          </div>
        ) : appLockEnabled ? (
          <button onClick={izklopiAppLock}
            className="w-full bg-[#ef444422] border border-[#ef444455] text-[#fca5a5] font-semibold py-3 rounded-xl hover:bg-[#ef444433] transition-colors">
            Izklopi odklep
          </button>
        ) : (
          <button onClick={vklopiAppLock} disabled={appLockLoading}
            className="w-full bg-[#6c63ff22] border border-[#6c63ff66] text-[#a09aff] font-semibold py-3 rounded-xl hover:bg-[#6c63ff33] transition-colors disabled:opacity-50">
            {appLockLoading ? 'Pripravljam...' : 'Vklopi odklep'}
          </button>
        )}
        {appLockMessage && <p className="text-[#5a5a80] text-xs mt-3">{appLockMessage}</p>}
      </div>
      <div id="prenos" className="scroll-mt-28 bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5">
        <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-1">Prenos</p>
        <p className="text-white font-semibold text-sm">Skeniranje QR</p>
        <p className="text-[#5a5a80] text-xs mt-1 mb-3">Preveri report ali uvozi zgodovino vozila od prejsnjega lastnika.</p>
        <button onClick={() => window.location.href = '/scan'}
          className="w-full bg-[#3ecfcf22] border border-[#3ecfcf66] text-[#3ecfcf] font-semibold py-3 rounded-xl hover:bg-[#3ecfcf33] transition-colors">
          Odpri Scan
        </button>
      </div>

      {/* Način uporabe */}
      <div id="uporaba" className="scroll-mt-28 bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5">
        <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-1">Način uporabe</p>
        <p className="text-[#3a3a5a] text-xs mb-3">Lite = enostavno, Full = vse možnosti</p>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => { setNacin('lite'); trackEvent('mode_lite_selected') }}
            className={`p-4 rounded-xl border transition-all text-left ${
              nacin === 'lite' ? 'bg-[#3ecfcf22] border-[#3ecfcf66]' : 'bg-[#13131f] border-[#1e1e32]'
            }`}>
            <p className="text-lg mb-1">🟢</p>
            <p className={`font-bold text-sm ${nacin === 'lite' ? 'text-[#3ecfcf]' : 'text-white'}`}>Lite</p>
            <p className="text-[#5a5a80] text-xs mt-1">Samo osnove, brez kompleksnih nastavitev</p>
          </button>
          <button onClick={() => { setNacin('full'); trackEvent('mode_full_selected') }}
            className={`p-4 rounded-xl border transition-all text-left ${
              nacin === 'full' ? 'bg-[#6c63ff22] border-[#6c63ff66]' : 'bg-[#13131f] border-[#1e1e32]'
            }`}>
            <p className="text-lg mb-1">🔵</p>
            <p className={`font-bold text-sm ${nacin === 'full' ? 'text-[#a09aff]' : 'text-white'}`}>Full</p>
            <p className="text-[#5a5a80] text-xs mt-1">Vse funkcije in napredne nastavitve</p>
          </button>
        </div>
      </div>

      {/* Jezik */}
      <div id="jezik" className="scroll-mt-28 bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5">
        <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-3">Jezik</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { vrednost: 'sl', naziv: '🇸🇮 Slovenščina' },
            { vrednost: 'en', naziv: '🇬🇧 English' },
          ].map((j) => (
            <button key={j.vrednost} onClick={() => spremeniJezik(j.vrednost as Language)}
              className={`py-3 rounded-xl border text-sm font-semibold transition-all ${
                jezik === j.vrednost
                  ? 'bg-[#6c63ff22] border-[#6c63ff66] text-[#a09aff]'
                  : 'bg-[#13131f] border-[#1e1e32] text-[#5a5a80]'
              }`}>
              {j.naziv}
            </button>
          ))}
        </div>
      </div>

      {/* Pisava */}
      <div id="pisava" className="scroll-mt-28 bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5">
        <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-3">Velikost pisave</p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { vrednost: 'mala', naziv: 'Mala' },
            { vrednost: 'normalna', naziv: 'Normalna' },
            { vrednost: 'velika', naziv: 'Velika' },
          ].map((p) => (
            <button key={p.vrednost} onClick={() => {
              setPisava(p.vrednost)
              const velikosti: any = { mala: '25px', normalna: '35px', velika: '45px' }
              const jeApp = window.matchMedia('(display-mode: standalone)').matches || window.innerWidth < 1024
              if (jeApp) document.documentElement.style.fontSize = velikosti[p.vrednost]
              else document.documentElement.style.removeProperty('font-size')
            }}
              className={`py-3 rounded-xl border text-sm font-semibold transition-all ${
                pisava === p.vrednost
                  ? 'bg-[#6c63ff22] border-[#6c63ff66] text-[#a09aff]'
                  : 'bg-[#13131f] border-[#1e1e32] text-[#5a5a80]'
              }`}>
              {p.naziv}
            </button>
          ))}
        </div>
      </div>

      {/* Prikaz garaže */}
      <div id="garaza-prikaz" className="scroll-mt-28 bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5 lg:col-span-2">
        <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-1">Prikaz garaže</p>
        <p className="text-[#3a3a5a] text-xs mb-3">Višina kartic avtov na začetnem zaslonu</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { vrednost: 'malo', naziv: 'Malo', opis: 'Več avtov' },
            { vrednost: 'srednje', naziv: 'Srednje', opis: 'Privzeto' },
            { vrednost: 'veliko', naziv: 'Veliko', opis: 'Večje slike' },
            { vrednost: 'grid', naziv: '⊞ Grid', opis: '3x kompaktno' },
          ].map((p) => (
            <button key={p.vrednost} onClick={() => setPrikazGaraze(p.vrednost)}
              className={`py-3 px-2 rounded-xl border transition-all text-center ${
                prikazGaraze === p.vrednost ? 'bg-[#6c63ff22] border-[#6c63ff66]' : 'bg-[#13131f] border-[#1e1e32]'
              }`}>
              <p className={`text-sm font-semibold ${prikazGaraze === p.vrednost ? 'text-[#a09aff]' : 'text-white'}`}>{p.naziv}</p>
              <p className="text-[#5a5a80] text-xs mt-0.5">{p.opis}</p>
            </button>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-[#1e1e32]">
          <div className="flex justify-between items-center gap-4 mb-3">
            <div>
              <p className="text-white font-semibold text-sm">Avtov v vrstici na webu</p>
              <p className="text-[#5a5a80] text-xs mt-0.5">Velja za računalnik in širši ekran</p>
            </div>
            <div className="bg-[#6c63ff22] border border-[#6c63ff66] text-[#a09aff] rounded-xl px-4 py-2 font-bold">
              {desktopStolpci}
            </div>
          </div>
          <input
            type="range"
            min="2"
            max="8"
            value={desktopStolpci}
            onChange={(e) => setDesktopStolpci(Number(e.target.value))}
            className="w-full accent-[#6c63ff]"
          />
          <div className="flex justify-between text-[#3a3a5a] text-xs mt-1">
            <span>2</span><span>4</span><span>6</span><span>8</span>
          </div>
        </div>

        {prikazGaraze === 'grid' && (
          <div className="mt-4 pt-4 border-t border-[#1e1e32]">
            <div className="flex justify-between items-center gap-4 mb-3">
              <div>
                <p className="text-white font-semibold text-sm">Avtov v vrstici v app</p>
                <p className="text-[#5a5a80] text-xs mt-0.5">Velja za telefon in nameščeno aplikacijo</p>
              </div>
              <div className="bg-[#3ecfcf22] border border-[#3ecfcf66] text-[#3ecfcf] rounded-xl px-4 py-2 font-bold">
                {mobileGridStolpci}
              </div>
            </div>
            <input
              type="range"
              min="2"
              max="5"
              value={mobileGridStolpci}
              onChange={(e) => setMobileGridStolpci(Number(e.target.value))}
              className="w-full accent-[#3ecfcf]"
            />
            <div className="flex justify-between text-[#3a3a5a] text-xs mt-1">
              <span>2</span><span>3</span><span>4</span><span>5</span>
            </div>
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-[#1e1e32]">
          <div className="flex justify-between items-center gap-4 mb-3">
            <div>
              <p className="text-white font-semibold text-sm">Pisava na karticah</p>
              <p className="text-[#5a5a80] text-xs mt-0.5">Velja za Malo, Srednje, Veliko in Grid</p>
            </div>
            <div className="bg-[#6c63ff22] border border-[#6c63ff66] text-[#a09aff] rounded-xl px-4 py-2 font-bold">
              {garazaPisava}%
            </div>
          </div>
          <input
            type="range"
            min="80"
            max="150"
            step="5"
            value={garazaPisava}
            onChange={(e) => setGarazaPisava(Number(e.target.value))}
            className="w-full accent-[#6c63ff]"
          />
          <div className="flex justify-between text-[#3a3a5a] text-xs mt-1">
            <span>Mala</span><span>Srednja</span><span>Velika</span>
          </div>
        </div>

        {/* Grid nastavitve */}
        {prikazGaraze === 'grid' && (
          <div className="mt-4 pt-4 border-t border-[#1e1e32]">
            <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-3">Prikaži v grid kockici</p>
            <div className="flex flex-col gap-3">
              {[
                { key: 'tablica', naziv: 'Registrska tablica' },
                { key: 'km', naziv: 'Kilometri' },
                { key: 'opomnik', naziv: 'Opomniki na kartici' },
                { key: 'letnik', naziv: 'Letnik' },
                { key: 'gorivo', naziv: 'Tip goriva' },
              ].map((item) => (
                <div key={item.key} className="flex justify-between items-center">
                  <p className="text-white text-sm">{item.naziv}</p>
                  <button
                    onClick={() => setGridNastavitve((prev: any) => ({ ...prev, [item.key]: !prev[item.key] }))}
                    className={`w-10 h-5 rounded-full transition-all relative ${
                      gridNastavitve[item.key as keyof typeof gridNastavitve] ? 'bg-[#6c63ff]' : 'bg-[#2a2a40]'
                    }`}>
                    <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${
                      gridNastavitve[item.key as keyof typeof gridNastavitve] ? 'left-5' : 'left-0.5'
                    }`} />
                  </button>
                </div>
              ))}
            </div>
            {gridNastavitve.opomnik && (
              <OpomnikFilter nastavitve={gridNastavitve} setNastavitve={setGridNastavitve} />
            )}
          </div>
        )}

        {/* Lista nastavitve */}
        {prikazGaraze !== 'grid' && (
          <div className="mt-4 pt-4 border-t border-[#1e1e32]">
            <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-3">Prikaži na kartici</p>
            <div className="flex flex-col gap-3">
              {[
                { key: 'letnik', naziv: 'Letnik' },
                { key: 'gorivo', naziv: 'Gorivo' },
                { key: 'km', naziv: 'Kilometri' },
                { key: 'tablica', naziv: 'Registrska tablica' },
                { key: 'opomnik', naziv: 'Opomniki na kartici' },
              ].map((item) => (
                <div key={item.key} className="flex justify-between items-center">
                  <p className="text-white text-sm">{item.naziv}</p>
                  <button
                    onClick={() => setListaNastavitve((prev: any) => ({ ...prev, [item.key]: !prev[item.key] }))}
                    className={`w-10 h-5 rounded-full transition-all relative ${
                      listaNastavitve[item.key as keyof typeof listaNastavitve] ? 'bg-[#6c63ff]' : 'bg-[#2a2a40]'
                    }`}>
                    <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${
                      listaNastavitve[item.key as keyof typeof listaNastavitve] ? 'left-5' : 'left-0.5'
                    }`} />
                  </button>
                </div>
              ))}
            </div>
            {listaNastavitve.opomnik && (
              <OpomnikFilter nastavitve={listaNastavitve} setNastavitve={setListaNastavitve} />
            )}
          </div>
        )}
      </div>

      <div id="feedback" className="scroll-mt-28 bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5">
        <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-1">Feedback</p>
        <p className="text-white font-semibold text-sm">Predlagaj funkcijo</p>
        <p className="text-[#5a5a80] text-xs mt-1 mb-3">Poslji idejo, tezavo ali predlog za izboljsavo GarageBase.</p>
        <button onClick={() => { trackEvent('feedback_open'); window.location.href = '/feedback' }}
          className="w-full bg-[#f59e0b22] border border-[#f59e0b66] text-[#f59e0b] font-semibold py-3 rounded-xl hover:bg-[#f59e0b33] transition-colors">
          Odpri predloge
        </button>
      </div>

      <div id="pomoc" className="scroll-mt-28 bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5">
        <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-1">Pomoc</p>
        <p className="text-white font-semibold text-sm">Pomocnik</p>
        <p className="text-[#5a5a80] text-xs mt-1 mb-3">Hitri vodic za osnovne funkcije GarageBase.</p>
        <button onClick={() => { trackEvent('assistant_open'); window.location.href = '/pomocnik' }}
          className="w-full bg-[#6c63ff22] border border-[#6c63ff66] text-[#a09aff] font-semibold py-3 rounded-xl hover:bg-[#6c63ff33] transition-colors">
          Odpri pomocnika
        </button>
      </div>

      {/* Autocomplete */}
      <div id="predlogi" className="scroll-mt-28 bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-white font-semibold text-sm">Predlagane besede</p>
            <p className="text-[#5a5a80] text-xs mt-0.5">Autocomplete pri vnosu postaje in servisa</p>
          </div>
          <button onClick={() => setAvtocomplete(!avtocomplete)}
            className={`w-12 h-6 rounded-full transition-all relative ${
              avtocomplete ? 'bg-[#6c63ff]' : 'bg-[#2a2a40]'
            }`}>
            <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${
              avtocomplete ? 'left-6' : 'left-0.5'
            }`} />
          </button>
        </div>
      </div>

      {/* O aplikaciji */}
      <div id="aplikacija" className="scroll-mt-28 bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5">
        <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-3">O aplikaciji</p>
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <span className="text-[#5a5a80] text-sm">Verzija</span>
            <span className="text-white text-sm">1.0.0 Beta</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#5a5a80] text-sm">Spletna stran</span>
            <span className="text-[#6c63ff] text-sm">getgaragebase.com</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#5a5a80] text-sm">Podpora</span>
            <span className="text-[#6c63ff] text-sm">garagebase.app@gmail.com</span>
          </div>
        </div>
      </div>

      {message && (
        <div className={`p-3 rounded-xl text-sm border mb-4 ${
          message.includes('✅') ? 'bg-[#16a34a22] border-[#16a34a44] text-[#4ade80]' : 'bg-[#ef444422] border-[#ef444444] text-[#fca5a5]'
        }`}>
          {message}
        </div>
      )}

      <div className="grid gap-3 lg:col-span-2 sm:grid-cols-2">
        <button onClick={shrani}
          className="w-full bg-[#6c63ff] hover:bg-[#5a52e0] text-white font-semibold py-3 rounded-xl transition-colors">
          Shrani nastavitve
        </button>

        <button onClick={handleLogout}
          className="w-full bg-[#13131f] border border-[#1e1e32] text-[#ef4444] font-semibold py-3 rounded-xl hover:bg-[#ef444411] transition-colors">
          Odjava
        </button>
      </div>
          </main>
        </div>
      </div>

      <BottomNav aktivna="nastavitve" />
    </div>
  )
}
