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

function isSamePushKey(subscription: PushSubscription, vapidPublicKey: string) {
  const currentKey = subscription.options?.applicationServerKey
  if (!currentKey) return false
  const nextKey = urlBase64ToUint8Array(vapidPublicKey)
  const current = new Uint8Array(currentKey)
  if (current.length !== nextKey.length) return false
  return current.every((value, index) => value === nextKey[index])
}

async function getFreshPushSubscription(registration: ServiceWorkerRegistration, vapidPublicKey: string) {
  let subscription = await registration.pushManager.getSubscription()
  if (subscription && !isSamePushKey(subscription, vapidPublicKey)) {
    await subscription.unsubscribe()
    subscription = null
  }

  return subscription || await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
  })
}

const defaultNotificationSettings = {
  enabled: true,
  dateReminders: true,
  kmReminders: true,
  transitionAlerts: true,
  dailyRedAlerts: true,
  sendTime: '08:00',
}

export default function Nastavitve() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [nacin, setNacin] = useState<'lite' | 'full'>('full')
  const [jezik, setJezik] = useState('sl')
  const [pisava, setPisava] = useState(100)
  const [prikazGaraze, setPrikazGaraze] = useState('srednje')
  const [desktopStolpci, setDesktopStolpci] = useState(5)
  const [mobileGridStolpci, setMobileGridStolpci] = useState(3)
  const [garazaPisava, setGarazaPisava] = useState(100)
  const [avtocomplete, setAvtocomplete] = useState(true)
  const [datumFormat, setDatumFormat] = useState('dd.mm.yyyy')
  const [enotaRazdalje, setEnotaRazdalje] = useState<'km' | 'mi'>('km')
  const [valuta, setValuta] = useState<'EUR' | 'USD'>('EUR')
  const [tema, setTema] = useState('temna')
  const [notifikacije, setNotifikacije] = useState<'neznano' | 'dovoljeno' | 'zavrnjeno'>('neznano')
  const [notifikacijeLoading, setNotifikacijeLoading] = useState(false)
  const [testLoading, setTestLoading] = useState(false)
  const [dbTestLoading, setDbTestLoading] = useState(false)
  const [reminderTestLoading, setReminderTestLoading] = useState(false)
  const [notificationSettings, setNotificationSettings] = useState(defaultNotificationSettings)
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
  const [settingsView, setSettingsView] = useState('')
  const [notificationSaveState, setNotificationSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [repeatPassword, setRepeatPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)

  const showSection = (section: string) => settingsView === 'vse' || settingsView === section
  const tx = (sl: string, en: string) => jezik === 'en' ? en : sl

  const fontOptions = [
    { value: 85, title: tx('Zelo majhno', 'Very small'), desc: tx('Največ prostora', 'Most space') },
    { value: 100, title: tx('Majhno', 'Small'), desc: tx('Privzeto', 'Default') },
    { value: 140, title: tx('Srednje', 'Medium'), desc: tx('Lažje branje', 'Easier reading') },
    { value: 200, title: tx('Veliko', 'Large'), desc: tx('Za slabši vid', 'For lower vision') },
    { value: 300, title: tx('Zelo veliko', 'Very large'), desc: tx('Največja pisava', 'Largest text') },
  ]

  const normalizeFontPercent = (value: any) => {
    if (typeof value === 'number' && Number.isFinite(value)) return Math.min(300, Math.max(85, value))
    const legacy: Record<string, number> = { mala: 90, normalna: 100, velika: 120 }
    return legacy[value] || 100
  }

  const settingsSections = [
    { id: 'vse', title: tx('Vse nastavitve', 'All settings'), desc: tx('Pregled vseh nastavitev', 'Overview of all settings'), tone: 'from-[#6c63ff] to-[#8b5cf6]' },
    { id: 'profil', title: tx('Profil', 'Profile'), desc: tx('Račun, paket in geslo', 'Account, plan and password'), tone: 'from-[#8b5cf6] to-[#3b82f6]' },
    { id: 'obvestila', title: tx('Obvestila', 'Notifications'), desc: tx('Ura, prioritete in telefon', 'Time, priorities and phone'), tone: 'from-[#f59e0b] to-[#ef4444]' },
    { id: 'varnost', title: tx('Varnost', 'Security'), desc: tx('Odklep in zasebnost', 'Unlock and privacy'), tone: 'from-[#22c55e] to-[#14b8a6]' },
    { id: 'prenos', title: tx('Prenos', 'Transfer'), desc: tx('QR, uvoz in računi', 'QR, import and receipts'), tone: 'from-[#14b8a6] to-[#06b6d4]' },
    { id: 'uporaba', title: tx('Uporaba', 'Usage'), desc: tx('Lite ali Full način', 'Lite or Full mode'), tone: 'from-[#3b82f6] to-[#6c63ff]' },
    { id: 'prikaz', title: tx('Prikaz', 'Display'), desc: tx('Pisava, kartice in grid', 'Font, cards and grid'), tone: 'from-[#a855f7] to-[#ec4899]' },
    { id: 'pomoc', title: tx('Pomoč', 'Help'), desc: tx('Predlogi, napake in pomočnik', 'Suggestions, bugs and assistant'), tone: 'from-[#f97316] to-[#f59e0b]' },
    { id: 'aplikacija', title: tx('Aplikacija', 'App'), desc: tx('Verzija in podpora', 'Version and support'), tone: 'from-[#64748b] to-[#94a3b8]' },
    { id: 'brisanje', title: tx('Izbris računa', 'Delete account'), desc: tx('Trajno brisanje podatkov', 'Permanent data deletion'), tone: 'from-[#ef4444] to-[#fb7185]' },
  ]

  const applyFontSize = (value: any) => {
    const percent = normalizeFontPercent(value)
    const rootPx = 16 * (percent / 100)
    document.documentElement.style.fontSize = `${Math.min(48, Math.max(14, rootPx))}px`
    document.documentElement.style.setProperty('--gb-app-font-scale', String(percent / 100))
  }

  const spremeniPisavo = (value: number) => {
    const next = normalizeFontPercent(value)
    setPisava(next)
    applyFontSize(next)
  }

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
      currency: values.valuta || valuta,
      autocomplete: values.avtocomplete !== undefined ? values.avtocomplete : avtocomplete,
      appLockEnabled: localStorage.getItem('garagebase_app_lock_enabled') === 'true',
      gridSettings: values.gridNastavitve || gridNastavitve,
      listSettings: values.listaNastavitve || listaNastavitve,
    })
  }

  const shraniPushSubscriptionNaServer = async (subscription: PushSubscription, settings = notificationSettings) => {
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    const response = await fetch('/api/push-subscription', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        notificationSettings: settings,
      })
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(result.error || result.details || 'Push povezave ni bilo mogoce shraniti.')
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
        const nextPisava = normalizeFontPercent(n.pisava)
        setPisava(nextPisava)
        applyFontSize(nextPisava)
        setPrikazGaraze(n.prikazGaraze || 'srednje')
        setDesktopStolpci(n.desktopStolpci || 5)
        setMobileGridStolpci(n.mobileGridStolpci || 3)
        setGarazaPisava(n.garazaPisava || 100)
        setAvtocomplete(n.avtocomplete !== false)
        setDatumFormat(n.datumFormat || 'dd.mm.yyyy')
        setEnotaRazdalje(n.enotaRazdalje === 'mi' ? 'mi' : 'km')
        setValuta(n.valuta === 'USD' ? 'USD' : 'EUR')
        setTema(n.tema || 'temna')
        if (n.notificationSettings) setNotificationSettings({ ...defaultNotificationSettings, ...n.notificationSettings })
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
          if (subscription) {
            const { data: subRow } = await supabase
              .from('push_subscriptions')
              .select('notification_settings')
              .eq('user_id', user.id)
              .maybeSingle()
            if (subRow?.notification_settings) {
              setNotificationSettings({ ...defaultNotificationSettings, ...subRow.notification_settings })
            }
          }
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
      const readyRegistration = await navigator.serviceWorker.ready
      const subscription = await getFreshPushSubscription(readyRegistration, vapidPublicKey)
      await shraniPushSubscriptionNaServer(subscription, notificationSettings)
      setNotifikacije('dovoljeno')
      setMessage('✅ Obvestila so vklopljena!')
      setTimeout(() => setMessage(''), 3000)
    } catch (error) {
      console.error('Napaka:', error)
      const reason = error instanceof Error ? error.message : 'neznana napaka'
      setMessage(`Napaka pri vklopu obvestil: ${reason}`)
    }
    setNotifikacijeLoading(false)
  }

  const posljiTestnoObvestilo = async () => {
    setTestLoading(true)
    try {
      await navigator.serviceWorker.register('/sw.js')
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      if (!subscription) {
        setNotifikacije('neznano')
        setMessage('Obvestila niso povezana s tem telefonom. Klikni Vklopi obvestila.')
        setTestLoading(false)
        return
      }

      registration.active?.postMessage({
        type: 'GARAGEBASE_TEST_NOTIFICATION',
        title: 'GarageBase lokalni test',
        body: 'Ce vidis to obvestilo, telefon in dovoljenja delujejo.',
        url: '/nastavitve'
      })

      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      const response = await fetch('/api/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          title: 'GarageBase test',
          body: 'Če vidiš to obvestilo, push deluje.',
          url: '/nastavitve'
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(async () => ({ error: await response.text() }))
        if (errorData.statusCode === 410 || errorData.statusCode === 404) {
          await subscription.unsubscribe()
          setNotifikacije('neznano')
          throw new Error('Stara push povezava je potekla. Klikni Vklopi obvestila in potem se enkrat Poslji test.')
        }
        throw new Error(errorData.error || errorData.body || 'Testno obvestilo ni bilo poslano.')
      }

      setMessage('Test poslan. Najprej mora priti lokalni test, nato server push.')
      setTimeout(() => setMessage(''), 3000)
    } catch (error: any) {
      console.error('Test obvestila:', error)
      setMessage(`Test obvestila ni uspel: ${error.message || 'neznana napaka'}`)
    }
    setTestLoading(false)
  }

  const posljiBazaTestnoObvestilo = async () => {
    setDbTestLoading(true)
    try {
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidPublicKey) throw new Error('Push kljuci niso nastavljeni.')

      await navigator.serviceWorker.register('/sw.js')
      const registration = await navigator.serviceWorker.ready
      const subscription = await getFreshPushSubscription(registration, vapidPublicKey)

      await shraniPushSubscriptionNaServer(subscription, notificationSettings)
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      const response = await fetch('/api/push-db-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          title: 'GarageBase test iz baze',
          body: `To obvestilo je poslano iz Supabase zapisa. Nastavljena ura: ${notificationSettings.sendTime}.`,
          url: '/nastavitve'
        })
      })

      const result = await response.json().catch(() => ({}))
      if (!response.ok || result.sent < 1) {
        const details = result.failed?.length ? ` Napaka: ${result.failed.join(', ')}` : ''
        throw new Error(`${result.error || 'Test iz baze ni bil poslan.'}${details}`)
      }

      setMessage(`Test iz baze poslan (${result.sent || 0}/${result.found || result.sent || 0} naprav).`)
      setTimeout(() => setMessage(''), 6000)
    } catch (error: any) {
      console.error('Test iz baze:', error)
      setMessage(`Test iz baze ni uspel: ${error.message || 'neznana napaka'}`)
    }
    setDbTestLoading(false)
  }

  const posljiTestOpomnikovZdaj = async () => {
    setReminderTestLoading(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      const response = await fetch('/api/push-reminder-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

      const result = await response.json().catch(() => ({}))
      if (!response.ok || result.sent < 1) {
        throw new Error(result.error || 'Test opomnikov ni poslal obvestila.')
      }

      setMessage(`Test opomnikov poslan: ${result.redReminders} rdecih opomnikov, ${result.sent}/${result.devices} naprav.`)
      setTimeout(() => setMessage(''), 7000)
    } catch (error: any) {
      console.error('Test opomnikov:', error)
      setMessage(`Test opomnikov ni uspel: ${error.message || 'neznana napaka'}`)
    }
    setReminderTestLoading(false)
  }

  const shraniNotificationSettings = async (nextSettings: typeof defaultNotificationSettings) => {
    try {
      setNotificationSaveState('saving')
      setNotificationSettings(nextSettings)
      const raw = localStorage.getItem('garagebase_nastavitve')
      const current = raw ? JSON.parse(raw) : {}
      localStorage.setItem('garagebase_nastavitve', JSON.stringify({ ...current, notificationSettings: nextSettings }))
      trackEvent('notification_settings_changed', nextSettings)
      if (notifikacije === 'dovoljeno') {
        const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        if (!vapidPublicKey) throw new Error('Push kljuci niso nastavljeni.')
        const registration = await navigator.serviceWorker.ready
        const subscription = await getFreshPushSubscription(registration, vapidPublicKey)
        await shraniPushSubscriptionNaServer(subscription, nextSettings)
      }
      setNotificationSaveState('saved')
      setMessage('Nastavitve obvestil so shranjene.')
      setTimeout(() => {
        setMessage('')
        setNotificationSaveState('idle')
      }, 3000)
    } catch (error: any) {
      console.error('Shranjevanje nastavitev obvestil:', error)
      setNotificationSaveState('error')
      setMessage(`Nastavitev obvestil ni bilo mogoce shraniti: ${error.message || 'neznana napaka'}`)
      setTimeout(() => setNotificationSaveState('idle'), 4000)
    }
  }

  const toggleNotificationSetting = (key: keyof typeof defaultNotificationSettings) => {
    const value = notificationSettings[key]
    if (typeof value !== 'boolean') return
    shraniNotificationSettings({ ...notificationSettings, [key]: !value })
  }

  const izklopiNotifikacije = async () => {
    setNotifikacijeLoading(true)
    try {
      const registration = await navigator.serviceWorker.getRegistration('/sw.js')
      const subscription = await registration?.pushManager.getSubscription()
      await subscription?.unsubscribe()
      if (user) await supabase.from('push_subscriptions').delete().eq('user_id', user.id)
      setNotifikacije('neznano')
      setMessage('Obvestila so izklopljena na tej napravi.')
      setTimeout(() => setMessage(''), 3000)
    } catch (error) {
      console.error('Izklop obvestil:', error)
      setMessage('Obvestil ni bilo mogoce izklopiti.')
    }
    setNotifikacijeLoading(false)
  }

  const shrani = () => {
    const raw = localStorage.getItem('garagebase_nastavitve')
    const current = raw ? JSON.parse(raw) : {}
    const nastavitve = { ...current, nacin, jezik, pisava, prikazGaraze, desktopStolpci, mobileGridStolpci, garazaPisava, avtocomplete, datumFormat, enotaRazdalje, valuta, tema, gridNastavitve, listaNastavitve, notificationSettings, onboardingDone: true }
    localStorage.setItem('garagebase_nastavitve', JSON.stringify(nastavitve))
    trackSettingsSnapshot('settings_saved', nastavitve)
    applyFontSize(pisava)
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

  const spremeniGeslo = async () => {
    if (!oldPassword) {
      setMessage(jezik === 'en' ? 'Enter your current password.' : 'Vpiši trenutno geslo.')
      return
    }
    if (newPassword.length < 6) {
      setMessage(jezik === 'en' ? 'Password must be at least 6 characters.' : 'Geslo mora imeti vsaj 6 znakov.')
      return
    }
    if (newPassword !== repeatPassword) {
      setMessage(jezik === 'en' ? 'New passwords do not match.' : 'Novi gesli se ne ujemata.')
      return
    }
    if (!user?.email) return
    setPasswordLoading(true)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: user.email, password: oldPassword })
    if (signInError) {
      setMessage(jezik === 'en' ? 'Current password is not correct.' : 'Trenutno geslo ni pravilno.')
      setPasswordLoading(false)
      return
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) setMessage(error.message)
    else {
      setOldPassword('')
      setNewPassword('')
      setRepeatPassword('')
      setPasswordDialogOpen(false)
      setMessage(jezik === 'en' ? 'Password changed.' : 'Geslo je spremenjeno.')
    }
    setPasswordLoading(false)
    setTimeout(() => setMessage(''), 3000)
  }

  const posljiResetGesla = async () => {
    if (!user?.email) return
    setPasswordLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/login?type=recovery`,
    })
    if (error) setMessage(error.message)
    else setMessage(jezik === 'en' ? 'Password reset link was sent to your email.' : 'Povezava za ponastavitev gesla je poslana na email.')
    setPasswordLoading(false)
    setTimeout(() => setMessage(''), 5000)
  }

  const izbrisiRacun = async () => {
    const confirmation = deleteConfirmText.trim().toUpperCase()
    if (confirmation !== 'IZBRISI' && confirmation !== 'DELETE') {
      setMessage(tx('Za potrditev vpiši IZBRISI.', 'Type DELETE to confirm.'))
      return
    }
    setDeleteLoading(true)
    setMessage('')
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      const response = await fetch('/api/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'Brisanje računa ni uspelo.')
      localStorage.clear()
      await supabase.auth.signOut()
      window.location.href = '/'
    } catch (error: any) {
      setMessage(`Računa ni bilo mogoče izbrisati: ${error.message || 'neznana napaka'}`)
      setDeleteLoading(false)
    }
  }

  // Filter za datumske in km opomnike
  const reminderTone = {
    red: 'bg-[#ef4444] shadow-[0_0_0_3px_rgba(239,68,68,0.12)]',
    yellow: 'bg-[#f59e0b] shadow-[0_0_0_3px_rgba(245,158,11,0.12)]',
    green: 'bg-[#22c55e] shadow-[0_0_0_3px_rgba(34,197,94,0.12)]',
  }

  const OpomnikFilter = ({ nastavitve, setNastavitve }: { nastavitve: any, setNastavitve: any }) => (
    <div className="mt-3 pt-3 border-t border-[#1e1e32] flex flex-col gap-3">

      {/* Datumski opomniki */}
      <div>
        <p className="text-[#5a5a80] text-xs mb-2">{jezik === 'en' ? 'Show date reminders:' : 'Prikaži datumske opomnike:'}</p>
        <div className="flex gap-2">
          {[
            { key: 'opomnikRdeci', tone: 'red', naziv: jezik === 'en' ? 'Urgent' : 'Nujni', opis: '<7 dni' },
            { key: 'opomnikRumeni', tone: 'yellow', naziv: jezik === 'en' ? 'Soon' : 'Kmalu', opis: '<30 dni' },
            { key: 'opomnikZeleni', tone: 'green', naziv: jezik === 'en' ? 'All' : 'Vsi', opis: '>30 dni' },
          ].map((item) => (
            <button key={item.key}
              onClick={() => setNastavitve((prev: any) => ({ ...prev, [item.key]: !prev[item.key] }))}
              className={`flex-1 py-2 px-1 rounded-xl border text-center transition-all ${
                nastavitve[item.key]
                  ? 'bg-[#6c63ff22] border-[#6c63ff66]'
                  : 'bg-[#13131f] border-[#1e1e32]'
              }`}>
              <p className="text-xs flex items-center justify-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-full ${reminderTone[item.tone as keyof typeof reminderTone]}`} />
                <span>{item.naziv}</span>
              </p>
              <p className="text-[#5a5a80] text-[11px]">{item.opis}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Km opomniki */}
      <div>
        <p className="text-[#5a5a80] text-xs mb-2">{jezik === 'en' ? 'Show mileage reminders:' : 'Prikaži km opomnike:'}</p>
        <div className="flex gap-2">
          {[
            { key: 'opomnikKmRdeci', tone: 'red', naziv: jezik === 'en' ? 'Urgent' : 'Nujni', opis: '<500 km' },
            { key: 'opomnikKmRumeni', tone: 'yellow', naziv: jezik === 'en' ? 'Soon' : 'Kmalu', opis: '<1500 km' },
            { key: 'opomnikKmZeleni', tone: 'green', naziv: jezik === 'en' ? 'All' : 'Vsi', opis: '>1500 km' },
          ].map((item) => (
            <button key={item.key}
              onClick={() => setNastavitve((prev: any) => ({ ...prev, [item.key]: !prev[item.key] }))}
              className={`flex-1 py-2 px-1 rounded-xl border text-center transition-all ${
                nastavitve[item.key]
                  ? 'bg-[#6c63ff22] border-[#6c63ff66]'
                  : 'bg-[#13131f] border-[#1e1e32]'
              }`}>
              <p className="text-xs flex items-center justify-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-full ${reminderTone[item.tone as keyof typeof reminderTone]}`} />
                <span>{item.naziv}</span>
              </p>
              <p className="text-[#5a5a80] text-[11px]">{item.opis}</p>
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
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#6c63ff]">{tx('Nastavitve', 'Settings')}</p>
              <h1 className="mt-2 text-3xl font-black text-white">
                Garage<span className="text-[#6c63ff]">Base</span>
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-[#5a5a80]">
                {tx('Uredi prikaz, varnost, jezik, prenos podatkov in delovanje aplikacije na enem mestu.', 'Manage display, security, language, data transfer and app behavior in one place.')}
              </p>
            </div>
            <div className="rounded-2xl border border-[#1e1e32] bg-[#13131f] px-4 py-3 text-sm text-[#5a5a80]">
              <span className="font-semibold text-white">{user?.email}</span>
              <span className="mx-2 text-[#3a3a5a]">/</span>
              {tx('Free paket', 'Free plan')}
            </div>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="hidden xl:block">
            <nav className="sticky top-28 rounded-3xl border border-[#1e1e32] bg-[#0f0f1a] p-3">
              {settingsSections.map((section) => (
                <button key={section.id} type="button" onClick={() => setSettingsView(section.id)}
                  className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition-all ${
                    settingsView === section.id
                      ? section.id === 'brisanje'
                        ? 'border-[#ef4444aa] bg-[#ef444422] text-[#fca5a5] shadow-lg shadow-[#ef444418]'
                        : 'border-[#6c63ffaa] bg-[#6c63ff2e] text-white shadow-lg shadow-[#6c63ff18]'
                      : 'border-transparent text-[#5a5a80] hover:bg-[#6c63ff11] hover:text-[#a09aff]'
                  }`}>
                  {section.title}
                  <span className={settingsView === section.id ? 'text-current' : 'text-[#3a3a5a]'}>
                    {settingsView === section.id ? tx('Izbrano', 'Selected') : '>'}
                  </span>
                </button>
              ))}
              {isAdmin && (
                <a href="/admin"
                  className="mt-3 flex items-center justify-between rounded-2xl border border-[#6c63ff66] bg-[#6c63ff22] px-4 py-3 text-sm font-semibold text-[#a09aff] transition-colors hover:bg-[#6c63ff33]">
                  {tx('Admin panel', 'Admin panel')}
                  <span className="text-[#3a3a5a]">&gt;</span>
                </a>
              )}
            </nav>
          </aside>

          <main className="grid gap-4 lg:grid-cols-2">
      <div className="xl:hidden lg:col-span-2 rounded-3xl border border-[#1e1e32] bg-[#0f0f1a] p-3">
        <div className="grid grid-cols-2 gap-2">
          {settingsSections.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => setSettingsView(section.id)}
              className={`relative overflow-hidden rounded-2xl border p-3 text-left transition-all ${
                settingsView === section.id
                  ? section.id === 'brisanje'
                    ? 'border-[#ef4444aa] bg-[#ef444422] shadow-lg shadow-[#ef444418] ring-2 ring-[#ef444433]'
                    : 'border-[#6c63ffaa] bg-[#6c63ff2e] shadow-lg shadow-[#6c63ff18] ring-2 ring-[#6c63ff33]'
                  : 'border-[#1e1e32] bg-[#13131f]'
              }`}
            >
              <span className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${section.tone}`} />
              <span className="block text-sm font-bold text-white">{section.title}</span>
              <span className="mt-1 block text-[11px] leading-snug text-[#5a5a80]">{section.desc}</span>
              {settingsView === section.id && (
                <span className="mt-2 inline-flex rounded-full bg-white/10 px-2 py-1 text-[10px] font-bold text-white">
                  {tx('Izbrano', 'Selected')}
                </span>
              )}
            </button>
          ))}
          {isAdmin && (
            <a href="/admin" className="relative overflow-hidden rounded-2xl border border-[#6c63ff66] bg-[#6c63ff22] p-3 text-left shadow-lg shadow-[#6c63ff18]">
              <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#6c63ff] to-[#14b8a6]" />
              <span className="block text-sm font-bold text-white">{tx('Admin panel', 'Admin panel')}</span>
              <span className="mt-1 block text-[11px] leading-snug text-[#5a5a80]">{tx('Samo za administratorje', 'Administrators only')}</span>
            </a>
          )}
        </div>
      </div>

      {settingsView && (
        <>
      {/* Profil */}
      <div id="profil" style={{ display: showSection('profil') ? undefined : 'none' }} className="scroll-mt-28 bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5 lg:col-span-2">
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
        <div className="mt-5 rounded-2xl border border-[#1e1e32] bg-[#13131f] p-4">
          <p className="text-white text-sm font-semibold">{jezik === 'en' ? 'Password' : 'Geslo'}</p>
          <p className="text-[#5a5a80] text-xs mt-1">
            {jezik === 'en' ? 'Change your password or send yourself a reset link.' : 'Spremeni geslo ali si pošlji povezavo za ponastavitev.'}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => setPasswordDialogOpen(true)} disabled={passwordLoading}
              className="rounded-xl bg-[#6c63ff] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
              {jezik === 'en' ? 'Change password' : 'Spremeni geslo'}
            </button>
            <button type="button" onClick={posljiResetGesla} disabled={passwordLoading}
              className="rounded-xl border border-[#3ecfcf66] bg-[#3ecfcf18] px-4 py-3 text-sm font-semibold text-[#3ecfcf] disabled:opacity-60">
              {jezik === 'en' ? 'Forgot password' : 'Pozabljeno geslo'}
            </button>
          </div>
        </div>
      </div>

      {/* Tema */}
      <div id="tema" style={{ display: showSection('profil') ? undefined : 'none' }} className="scroll-mt-28 bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5">
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
      <div id="obvestila" style={{ display: showSection('obvestila') ? undefined : 'none' }} className="scroll-mt-28 bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5">
        <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-1">{jezik === 'en' ? 'Notifications' : 'Obvestila'}</p>
        <p className="text-[#3a3a5a] text-xs mb-3">
          {jezik === 'en' ? 'Reminders for registration, service and vignette' : 'Opomniki za registracijo, servis in vinjeto'}
        </p>
        {notifikacije === 'dovoljeno' ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 bg-[#16a34a22] border border-[#16a34a44] rounded-xl p-3">
              <span className="text-xl">🔔</span>
              <div>
                <p className="text-[#4ade80] text-sm font-semibold">{jezik === 'en' ? 'Notifications are enabled' : 'Obvestila so vklopljena'}</p>
                <p className="text-[#5a5a80] text-xs">
                  {jezik === 'en' ? 'Reminders are sent according to the settings below.' : 'Opomniki se pošiljajo po spodnjih nastavitvah.'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { key: 'enabled', title: jezik === 'en' ? 'Main notification switch' : 'Glavni vklop obvestil', desc: jezik === 'en' ? 'When off, reminders are not sent.' : 'Če je izklopljeno, ne pošiljamo opomnikov.' },
                { key: 'dateReminders', title: jezik === 'en' ? 'Date reminders' : 'Datumski opomniki', desc: jezik === 'en' ? 'Registration, vignette, technical inspection, insurance.' : 'Registracija, vinjeta, tehnični, zavarovanje.' },
                { key: 'kmReminders', title: jezik === 'en' ? 'Mileage reminders' : 'KM opomniki', desc: jezik === 'en' ? 'Service or another reminder based on mileage.' : 'Servis ali drug opomnik po kilometrih.' },
                { key: 'transitionAlerts', title: jezik === 'en' ? 'Priority changes' : 'Prehod prioritet', desc: jezik === 'en' ? 'Notify when a reminder changes from green to yellow or yellow to red.' : 'Obvestilo pri prehodu zelena -> rumena ali rumena -> rdeča.' },
                { key: 'dailyRedAlerts', title: jezik === 'en' ? 'Daily urgent reminder' : 'Dnevni rdeči opomnik', desc: jezik === 'en' ? 'When urgent, remind me every morning.' : 'Ko je nujno, te opomni vsako jutro.' },
              ].map((item) => (
                <button key={item.key} type="button" onClick={() => toggleNotificationSetting(item.key as keyof typeof defaultNotificationSettings)}
                  className={`rounded-xl border p-4 text-left transition-all ${
                    notificationSettings[item.key as keyof typeof defaultNotificationSettings]
                      ? 'bg-[#6c63ff22] border-[#6c63ff66]'
                      : 'bg-[#13131f] border-[#1e1e32]'
                  }`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-white text-sm font-semibold">{item.title}</p>
                      <p className="text-[#5a5a80] text-xs mt-1">{item.desc}</p>
                    </div>
                    <span className={`mt-0.5 h-6 w-11 rounded-full p-0.5 transition-colors ${
                      notificationSettings[item.key as keyof typeof defaultNotificationSettings] ? 'bg-[#6c63ff]' : 'bg-[#2a2a40]'
                    }`}>
                      <span className={`block h-5 w-5 rounded-full bg-white transition-transform ${
                        notificationSettings[item.key as keyof typeof defaultNotificationSettings] ? 'translate-x-5' : ''
                      }`} />
                    </span>
                  </div>
                </button>
              ))}
            </div>
            <div className="rounded-xl border border-[#1e1e32] bg-[#13131f] p-3">
              <label className="text-[#5a5a80] text-xs uppercase tracking-wider">
                {jezik === 'en' ? 'Morning reminder time' : 'Ura jutranjega opomnika'}
              </label>
              <input type="time" step="60" value={notificationSettings.sendTime} onChange={(e) => setNotificationSettings({ ...notificationSettings, sendTime: e.target.value })}
                className="mt-2 w-full rounded-xl border border-[#2a2a40] bg-[#0f0f1a] px-3 py-3 text-white outline-none" />
              <p className="mt-2 text-[11px] text-[#5a5a80]">
                {jezik === 'en'
                  ? 'Reminders are sent once per day at the selected time when active reminders exist.'
                  : 'Obvestila se pošljejo enkrat na dan ob izbrani uri, če imaš aktivne opomnike.'}
              </p>
              <button type="button" onClick={() => shraniNotificationSettings(notificationSettings)} disabled={notificationSaveState === 'saving'}
                className={`mt-3 w-full font-semibold py-3 rounded-xl transition-colors disabled:opacity-70 ${
                  notificationSaveState === 'saved'
                    ? 'bg-[#16a34a] text-white shadow-lg shadow-[#16a34a33]'
                    : notificationSaveState === 'error'
                      ? 'bg-[#ef4444] text-white'
                      : 'bg-[#6c63ff] text-white hover:bg-[#5a52e8]'
                }`}>
                {notificationSaveState === 'saving'
                  ? (jezik === 'en' ? 'Saving...' : 'Shranjujem...')
                  : notificationSaveState === 'saved'
                    ? (jezik === 'en' ? 'Saved ✓' : 'Shranjeno ✓')
                    : notificationSaveState === 'error'
                      ? (jezik === 'en' ? 'Not saved' : 'Ni shranjeno')
                      : (jezik === 'en' ? 'Save notification settings' : 'Shrani nastavitve obvestil')}
              </button>
            </div>
            {isAdmin && (
              <div className="rounded-xl border border-[#6c63ff33] bg-[#6c63ff11] p-3">
                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[#a09aff]">
                  {jezik === 'en' ? 'Admin testing tools' : 'Admin testna orodja'}
                </p>
                <div className="flex flex-col gap-3">
                  <button onClick={posljiTestnoObvestilo} disabled={testLoading}
                    className="w-full bg-[#13131f] border border-[#1e1e32] text-[#a09aff] font-semibold py-3 rounded-xl hover:border-[#6c63ff66] transition-colors disabled:opacity-50">
                    {testLoading ? (jezik === 'en' ? 'Sending test...' : 'Pošiljam test...') : (jezik === 'en' ? 'Send test' : 'Pošlji test')}
                  </button>
                  <button onClick={posljiBazaTestnoObvestilo} disabled={dbTestLoading}
                    className="w-full bg-[#14b8a622] border border-[#14b8a655] text-[#5eead4] font-semibold py-3 rounded-xl hover:bg-[#14b8a633] transition-colors disabled:opacity-50">
                    {dbTestLoading ? (jezik === 'en' ? 'Sending from database...' : 'Pošiljam iz baze...') : (jezik === 'en' ? 'Send database test' : 'Pošlji test iz baze')}
                  </button>
                  <button onClick={posljiTestOpomnikovZdaj} disabled={reminderTestLoading}
                    className="w-full bg-[#f59e0b22] border border-[#f59e0b55] text-[#fbbf24] font-semibold py-3 rounded-xl hover:bg-[#f59e0b33] transition-colors disabled:opacity-50">
                    {reminderTestLoading ? (jezik === 'en' ? 'Checking reminders...' : 'Preverjam opomnike...') : (jezik === 'en' ? 'Test reminders now' : 'Test opomnikov zdaj')}
                  </button>
                </div>
              </div>
            )}
            <button onClick={izklopiNotifikacije} disabled={notifikacijeLoading}
              className="w-full bg-[#ef444422] border border-[#ef444455] text-[#fca5a5] font-semibold py-3 rounded-xl hover:bg-[#ef444433] transition-colors disabled:opacity-50">
              {notifikacijeLoading ? (jezik === 'en' ? 'Disabling...' : 'Izklapljam...') : (jezik === 'en' ? 'Disable notifications on this device' : 'Izklopi obvestila na tej napravi')}
            </button>
          </div>
        ) : notifikacije === 'zavrnjeno' ? (
          <div className="flex items-center gap-3 bg-[#ef444422] border border-[#ef444444] rounded-xl p-3">
            <span className="text-xl">🔕</span>
            <div>
              <p className="text-[#fca5a5] text-sm font-semibold">{jezik === 'en' ? 'Notifications are blocked' : 'Obvestila so zavrnjena'}</p>
              <p className="text-[#5a5a80] text-xs">{jezik === 'en' ? 'Allow them in browser settings.' : 'Dovoli jih v nastavitvah brskalnika'}</p>
            </div>
          </div>
        ) : (
          <button onClick={vklopiNotifikacije} disabled={notifikacijeLoading}
            className="w-full bg-[#6c63ff22] border border-[#6c63ff66] text-[#a09aff] font-semibold py-3 rounded-xl hover:bg-[#6c63ff33] transition-colors disabled:opacity-50">
            {notifikacijeLoading ? (jezik === 'en' ? 'Enabling...' : 'Vklapljam...') : (jezik === 'en' ? '🔔 Enable notifications' : '🔔 Vklopi obvestila')}
          </button>
        )}
      </div>


      {/* App lock */}
      <div id="varnost" style={{ display: showSection('varnost') ? undefined : 'none' }} className="scroll-mt-28 bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5">
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
      <div id="prenos" style={{ display: showSection('prenos') ? undefined : 'none' }} className="scroll-mt-28 bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5">
        <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-1">Prenos</p>
        <p className="text-white font-semibold text-sm">Skeniranje QR</p>
        <p className="text-[#5a5a80] text-xs mt-1 mb-3">Preveri report ali uvozi zgodovino vozila od prejsnjega lastnika.</p>
        <button onClick={() => window.location.href = '/scan'}
          className="w-full bg-[#3ecfcf22] border border-[#3ecfcf66] text-[#3ecfcf] font-semibold py-3 rounded-xl hover:bg-[#3ecfcf33] transition-colors">
          Odpri Scan
        </button>
        <button onClick={() => window.location.href = '/uvoz-podatkov'}
          className="mt-3 w-full bg-[#6c63ff22] border border-[#6c63ff66] text-[#a09aff] font-semibold py-3 rounded-xl hover:bg-[#6c63ff33] transition-colors">
          Uvoz iz drugih app
        </button>
        <button
          onClick={() => isAdmin && (window.location.href = '/vnos-goriva')}
          disabled={!isAdmin}
          className={`mt-3 w-full font-semibold py-3 rounded-xl transition-colors ${
            isAdmin
              ? 'bg-[#f59e0b22] border border-[#f59e0b66] text-[#fbbf24] hover:bg-[#f59e0b33]'
              : 'bg-[#2a2a4018] border border-[#2a2a40] text-[#5a5a80] cursor-not-allowed'
          }`}>
          {jezik === 'en' ? 'Receipt scan' : 'Scan računov'}
        </button>
        {!isAdmin && (
          <p className="mt-2 text-xs text-[#5a5a80]">
            {jezik === 'en'
              ? 'AI receipt scanning is planned for public launch in 2027. Manual entry and receipt photo storage already work.'
              : 'AI skeniranje računov je planirano za javni zagon v letu 2027. Ročni vnos in shranjevanje slike računa že delujeta.'}
          </p>
        )}
      </div>

      {/* Način uporabe */}
      <div id="uporaba" style={{ display: showSection('uporaba') ? undefined : 'none' }} className="scroll-mt-28 bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5">
        <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-1">{tx('Način uporabe', 'Usage mode')}</p>
        <p className="text-[#3a3a5a] text-xs mb-3">{tx('Lite = enostavno, Full = vse možnosti', 'Lite = simple, Full = all options')}</p>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => { setNacin('lite'); trackEvent('mode_lite_selected') }}
            className={`p-4 rounded-xl border transition-all text-left ${
              nacin === 'lite' ? 'bg-[#3ecfcf22] border-[#3ecfcf66]' : 'bg-[#13131f] border-[#1e1e32]'
            }`}>
            <p className="text-lg mb-1">🟢</p>
            <p className={`font-bold text-sm ${nacin === 'lite' ? 'text-[#3ecfcf]' : 'text-white'}`}>Lite</p>
            <p className="text-[#5a5a80] text-xs mt-1">{tx('Samo osnove, brez kompleksnih nastavitev', 'Only basics, without complex settings')}</p>
          </button>
          <button onClick={() => { setNacin('full'); trackEvent('mode_full_selected') }}
            className={`p-4 rounded-xl border transition-all text-left ${
              nacin === 'full' ? 'bg-[#6c63ff22] border-[#6c63ff66]' : 'bg-[#13131f] border-[#1e1e32]'
            }`}>
            <p className="text-lg mb-1">🔵</p>
            <p className={`font-bold text-sm ${nacin === 'full' ? 'text-[#a09aff]' : 'text-white'}`}>Full</p>
            <p className="text-[#5a5a80] text-xs mt-1">{tx('Vse funkcije in napredne nastavitve', 'All features and advanced settings')}</p>
          </button>
        </div>
      </div>

      <div id="format-uporabe" style={{ display: showSection('uporaba') ? undefined : 'none' }} className="scroll-mt-28 bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5">
        <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-3">{tx('Oblika podatkov', 'Data format')}</p>
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-semibold text-white">{tx('Oblika datuma', 'Date format')}</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'dd.mm.yyyy', label: '31.12.2026' },
                { value: 'yyyy-mm-dd', label: '2026-12-31' },
                { value: 'dd/mm/yyyy', label: '31/12/2026' },
                { value: 'mm/dd/yyyy', label: '12/31/2026' },
              ].map((item) => (
                <button key={item.value} type="button" onClick={() => setDatumFormat(item.value)}
                  className={`rounded-xl border px-3 py-3 text-sm font-semibold transition-all ${
                    datumFormat === item.value ? 'border-[#6c63ff66] bg-[#6c63ff22] text-[#a09aff]' : 'border-[#1e1e32] bg-[#13131f] text-[#5a5a80]'
                  }`}>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold text-white">{tx('Enota razdalje', 'Distance unit')}</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'km', label: tx('Kilometri', 'Kilometers') },
                { value: 'mi', label: tx('Milje', 'Miles') },
              ].map((item) => (
                <button key={item.value} type="button" onClick={() => setEnotaRazdalje(item.value as 'km' | 'mi')}
                  className={`rounded-xl border px-3 py-3 text-sm font-semibold transition-all ${
                    enotaRazdalje === item.value ? 'border-[#3ecfcf66] bg-[#3ecfcf22] text-[#3ecfcf]' : 'border-[#1e1e32] bg-[#13131f] text-[#5a5a80]'
                  }`}>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold text-white">{tx('Valuta', 'Currency')}</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'EUR', label: '€ EUR', desc: tx('Evro', 'Euro') },
                { value: 'USD', label: '$ USD', desc: tx('Ameriški dolar', 'US dollar') },
              ].map((item) => (
                <button key={item.value} type="button" onClick={() => setValuta(item.value as 'EUR' | 'USD')}
                  className={`rounded-xl border px-3 py-3 text-sm font-semibold transition-all ${
                    valuta === item.value ? 'border-[#f59e0b66] bg-[#f59e0b22] text-[#fbbf24]' : 'border-[#1e1e32] bg-[#13131f] text-[#5a5a80]'
                  }`}>
                  <span className="block">{item.label}</span>
                  <span className="mt-1 block text-xs opacity-75">{item.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Jezik */}
      <div id="jezik" style={{ display: showSection('uporaba') ? undefined : 'none' }} className="scroll-mt-28 bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5">
        <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-3">Jezik</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { vrednost: 'sl', naziv: 'SI Slovenščina' },
            { vrednost: 'en', naziv: 'GB English' },
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
      <div id="pisava" style={{ display: showSection('prikaz') ? undefined : 'none' }} className="scroll-mt-28 bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5">
        <div className="mb-3 flex items-center justify-between gap-4">
          <div>
            <p className="text-[#5a5a80] text-xs uppercase tracking-wider">{tx('Velikost pisave', 'Font size')}</p>
            <p className="mt-1 text-xs text-[#3a3a5a]">
              {tx('Velja za celotno aplikacijo in se spremeni takoj.', 'Applies to the whole app and updates immediately.')}
            </p>
          </div>
          <div className="rounded-xl border border-[#6c63ff66] bg-[#6c63ff22] px-4 py-2 font-bold text-[#a09aff]">
            {Math.round(pisava)}%
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
          {fontOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => spremeniPisavo(option.value)}
              className={`rounded-xl border px-3 py-3 text-left transition-all ${
                pisava === option.value
                  ? 'border-[#6c63ff] bg-[#6c63ff22] text-[#a09aff] shadow-[0_0_18px_rgba(108,99,255,0.18)]'
                  : 'border-[#1e1e32] bg-[#13131f] text-[#5a5a80] hover:border-[#6c63ff55]'
              }`}
            >
              <span className="block text-sm font-black">{option.title}</span>
              <span className="mt-1 block text-xs">{option.desc}</span>
              <span className="mt-2 inline-flex rounded-lg bg-black/20 px-2 py-1 text-[11px] font-bold">{option.value}%</span>
            </button>
          ))}
        </div>
      </div>

      {/* Prikaz garaže */}
      <div id="garaza-prikaz" style={{ display: showSection('prikaz') ? undefined : 'none' }} className="scroll-mt-28 bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5 lg:col-span-2">
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
            min="70"
            max="200"
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

      <div id="feedback" style={{ display: showSection('pomoc') ? undefined : 'none' }} className="scroll-mt-28 bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5">
        <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-1">Feedback</p>
        <p className="text-white font-semibold text-sm">Predlagaj funkcijo</p>
        <p className="text-[#5a5a80] text-xs mt-1 mb-3">Poslji idejo, tezavo ali predlog za izboljsavo GarageBase.</p>
        <button onClick={() => { trackEvent('feedback_open'); window.location.href = '/feedback' }}
          className="w-full bg-[#f59e0b22] border border-[#f59e0b66] text-[#f59e0b] font-semibold py-3 rounded-xl hover:bg-[#f59e0b33] transition-colors">
          Odpri predloge
        </button>
        <button onClick={() => { trackEvent('bug_report_open'); window.location.href = '/prijava-napake' }}
          className="mt-3 w-full bg-[#ef444422] border border-[#ef444455] text-[#fca5a5] font-semibold py-3 rounded-xl hover:bg-[#ef444433] transition-colors">
          Prijavi napako
        </button>
        {isAdmin && (
          <button onClick={() => window.location.href = '/admin-napake'}
            className="mt-3 w-full bg-[#3ecfcf22] border border-[#3ecfcf66] text-[#3ecfcf] font-semibold py-3 rounded-xl hover:bg-[#3ecfcf33] transition-colors">
            Admin pregled napak
          </button>
        )}
      </div>

      <div id="pomoc" style={{ display: showSection('pomoc') ? undefined : 'none' }} className="scroll-mt-28 bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5">
        <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-1">Pomoc</p>
        <p className="text-white font-semibold text-sm">Pomocnik</p>
        <p className="text-[#5a5a80] text-xs mt-1 mb-3">Hitri vodic za osnovne funkcije GarageBase.</p>
        <button onClick={() => { trackEvent('assistant_open'); window.location.href = '/pomocnik' }}
          className="w-full bg-[#6c63ff22] border border-[#6c63ff66] text-[#a09aff] font-semibold py-3 rounded-xl hover:bg-[#6c63ff33] transition-colors">
          Odpri pomocnika
        </button>
      </div>

      {/* Autocomplete */}
      <div id="predlogi" style={{ display: showSection('aplikacija') ? undefined : 'none' }} className="scroll-mt-28 bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5">
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
      <div id="aplikacija" style={{ display: showSection('aplikacija') ? undefined : 'none' }} className="scroll-mt-28 bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5">
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

      {isAdmin && (
        <div id="admin-panel" style={{ display: showSection('aplikacija') || showSection('pomoc') ? undefined : 'none' }} className="scroll-mt-28 bg-[#0f0f1a] border border-[#6c63ff66] rounded-2xl p-5 lg:col-span-2">
          <p className="text-[#a09aff] text-xs uppercase tracking-wider mb-1">Admin</p>
          <p className="text-white font-semibold text-sm">{jezik === 'en' ? 'Main admin panel' : 'Glavni admin panel'}</p>
          <p className="text-[#5a5a80] text-xs mt-1 mb-3">
            {jezik === 'en'
              ? 'Visible only to accounts added as admins.'
              : 'Vidno samo računom, ki so dodani kot admini.'}
          </p>
          <button onClick={() => window.location.href = '/admin'}
            className="w-full bg-[#6c63ff22] border border-[#6c63ff66] text-[#a09aff] font-semibold py-3 rounded-xl hover:bg-[#6c63ff33] transition-colors">
            {jezik === 'en' ? 'Open admin panel' : 'Odpri admin panel'}
          </button>
        </div>
      )}

      {passwordDialogOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-3xl border border-[#1e1e32] bg-[#0f0f1a] p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-white text-lg font-bold">{jezik === 'en' ? 'Change password' : 'Spremeni geslo'}</p>
                <p className="text-[#5a5a80] text-xs mt-1">
                  {jezik === 'en' ? 'Enter your current password and confirm the new one.' : 'Vpiši trenutno geslo in potrdi novo geslo.'}
                </p>
              </div>
              <button type="button" onClick={() => setPasswordDialogOpen(false)}
                className="h-10 w-10 rounded-xl border border-[#2a2a40] bg-[#13131f] text-[#8a8aa8]">
                ×
              </button>
            </div>
            <div className="flex flex-col gap-3">
              <input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)}
                placeholder={jezik === 'en' ? 'Current password' : 'Trenutno geslo'}
                className="rounded-xl border border-[#2a2a40] bg-[#13131f] px-4 py-3 text-sm text-white outline-none focus:border-[#6c63ff]" />
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                placeholder={jezik === 'en' ? 'New password' : 'Novo geslo'}
                className="rounded-xl border border-[#2a2a40] bg-[#13131f] px-4 py-3 text-sm text-white outline-none focus:border-[#6c63ff]" />
              <input type="password" value={repeatPassword} onChange={(e) => setRepeatPassword(e.target.value)}
                placeholder={jezik === 'en' ? 'Repeat new password' : 'Ponovi novo geslo'}
                className="rounded-xl border border-[#2a2a40] bg-[#13131f] px-4 py-3 text-sm text-white outline-none focus:border-[#6c63ff]" />
              <button type="button" onClick={spremeniGeslo} disabled={passwordLoading}
                className="mt-2 rounded-xl bg-[#6c63ff] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
                {passwordLoading ? (jezik === 'en' ? 'Saving...' : 'Shranjujem...') : (jezik === 'en' ? 'Confirm change' : 'Potrdi spremembo')}
              </button>
            </div>
          </div>
        </div>
      )}

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
          {tx('Shrani nastavitve', 'Save settings')}
        </button>

        <button onClick={handleLogout}
          className="w-full bg-[#13131f] border border-[#1e1e32] text-[#ef4444] font-semibold py-3 rounded-xl hover:bg-[#ef444411] transition-colors">
          {tx('Odjava', 'Sign out')}
        </button>
      </div>

      <div id="brisanje-racuna" style={{ display: showSection('brisanje') ? undefined : 'none' }} className="scroll-mt-28 bg-[#0f0f1a] border border-[#ef444455] rounded-2xl p-5 lg:col-span-2">
        <p className="text-[#ef4444] text-xs uppercase tracking-wider mb-1">{tx('Brisanje računa', 'Delete account')}</p>
        <p className="text-white font-semibold text-sm">{tx('Izbriši račun in vse podatke', 'Delete account and all data')}</p>
        <p className="text-[#5a5a80] text-xs mt-1 mb-3">
          {tx(
            'To izbriše vozila, servise, tankanja, stroške, opomnike, slike, QR prenose, feedback in prijavo.',
            'This deletes vehicles, services, fill-ups, costs, reminders, photos, QR transfers, feedback and login data.'
          )}
        </p>
        {!deleteConfirmOpen ? (
          <button type="button" onClick={() => setDeleteConfirmOpen(true)}
            className="w-full bg-[#ef444422] border border-[#ef444455] text-[#fca5a5] font-semibold py-3 rounded-xl hover:bg-[#ef444433] transition-colors">
            {tx('Izbriši račun', 'Delete account')}
          </button>
        ) : (
          <div className="rounded-xl border border-[#ef444455] bg-[#ef444411] p-4">
            <p className="text-sm font-semibold text-[#fca5a5]">
              {tx(
                'Pozor: po potrditvi podatkov ne moremo več obnoviti. Če si prepričan, vpiši IZBRISI.',
                'Warning: after confirmation, data cannot be restored. If you are sure, type DELETE.'
              )}
            </p>
            <input value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder={tx('IZBRISI', 'DELETE')}
              className="mt-3 w-full rounded-xl border border-[#ef444455] bg-[#13131f] px-4 py-3 text-white outline-none focus:border-[#ef4444]" />
            <div className="mt-3 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => { setDeleteConfirmOpen(false); setDeleteConfirmText('') }}
                className="rounded-xl border border-[#1e1e32] bg-[#13131f] py-3 font-semibold text-[#5a5a80]">
                {tx('Prekliči', 'Cancel')}
              </button>
              <button type="button" onClick={izbrisiRacun} disabled={deleteLoading}
                className="rounded-xl bg-[#ef4444] py-3 font-semibold text-white disabled:opacity-60">
                {deleteLoading ? tx('Brišem...', 'Deleting...') : tx('Dokončno izbriši', 'Delete permanently')}
              </button>
            </div>
          </div>
        )}
      </div>
        </>
      )}
          </main>
        </div>
      </div>

      <BottomNav aktivna="nastavitve" />
    </div>
  )
}
