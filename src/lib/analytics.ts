import { supabase } from '@/lib/supabase'

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0-beta'
const RELEASE_CHANNEL = process.env.NEXT_PUBLIC_RELEASE_CHANNEL || 'local'
const RECENT_EVENTS_KEY = 'garagebase_recent_events'
let cachedAnalyticsUser: { id: string; email: string | null } | null | undefined

type AnalyticsMetadata = Record<string, unknown>

type StoredSettings = {
  nacin?: unknown
  jezik?: unknown
  tema?: unknown
  pisava?: unknown
  prikazGaraze?: unknown
  desktopStolpci?: unknown
  mobileGridStolpci?: unknown
  valuta?: unknown
}

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean
}

async function getAnalyticsUser() {
  if (cachedAnalyticsUser !== undefined) return cachedAnalyticsUser
  try {
    const { data } = await supabase.auth.getSession()
    const user = data.session?.user
    cachedAnalyticsUser = user ? { id: user.id, email: user.email?.toLowerCase() || null } : null
    return cachedAnalyticsUser
  } catch {
    cachedAnalyticsUser = null
    return null
  }
}

function getClientContext() {
  if (typeof window === 'undefined') return {}
  let storedSettings: StoredSettings | null = null
  try {
    storedSettings = JSON.parse(localStorage.getItem('garagebase_nastavitve') || 'null') as StoredSettings | null
  } catch {
    storedSettings = null
  }
  return {
    appVersion: APP_VERSION,
    releaseChannel: RELEASE_CHANNEL,
    pageUrl: window.location.href,
    userAgent: navigator.userAgent,
    language: navigator.language,
    online: navigator.onLine,
    standalone: window.matchMedia('(display-mode: standalone)').matches,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
    },
    settings: storedSettings ? {
      usageMode: storedSettings.nacin,
      language: storedSettings.jezik,
      theme: storedSettings.tema,
      fontSize: storedSettings.pisava,
      garageDisplay: storedSettings.prikazGaraze,
      desktopColumns: storedSettings.desktopStolpci,
      mobileGridColumns: storedSettings.mobileGridStolpci,
      currency: storedSettings.valuta,
    } : null,
  }
}

function getClientPlatform() {
  if (typeof window === 'undefined') return {
    key: 'unknown',
    label: 'Unknown',
    os: 'unknown',
    display: 'unknown',
  }
  const userAgent = navigator.userAgent || ''
  const isAndroid = /Android/i.test(userAgent)
  const isIos = /iPhone|iPad|iPod/i.test(userAgent)
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as NavigatorWithStandalone).standalone === true
  const isDesktopWidth = window.innerWidth >= 1024
  const os = isAndroid ? 'android' : isIos ? 'ios' : isDesktopWidth ? 'desktop' : 'mobile'
  const key = standalone
    ? isAndroid ? 'android_app' : isIos ? 'ios_app' : 'desktop_pwa'
    : isAndroid ? 'android_web' : isIos ? 'ios_web' : isDesktopWidth ? 'desktop_web' : 'mobile_web'
  const label: Record<string, string> = {
    android_app: 'Android app',
    android_web: 'Android web',
    ios_app: 'iOS app',
    ios_web: 'iOS web',
    desktop_pwa: 'Desktop PWA',
    desktop_web: 'Desktop web',
    mobile_web: 'Mobile web',
  }
  return {
    key,
    label: label[key] || 'Unknown',
    os,
    display: standalone ? 'standalone' : 'browser',
    standalone,
    width: window.innerWidth,
    height: window.innerHeight,
  }
}

function rememberEvent(eventName: string, metadata: AnalyticsMetadata) {
  if (typeof window === 'undefined') return
  try {
    const current = JSON.parse(localStorage.getItem(RECENT_EVENTS_KEY) || '[]')
    const next = [
      ...current,
      {
        eventName,
        pagePath: `${window.location.pathname}${window.location.search}`,
        createdAt: new Date().toISOString(),
        metadata,
      },
    ].slice(-12)
    localStorage.setItem(RECENT_EVENTS_KEY, JSON.stringify(next))
  } catch {
    // Ignore local breadcrumb failures.
  }
}

function getRecentEvents() {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(RECENT_EVENTS_KEY) || '[]')
  } catch {
    return []
  }
}

export async function trackEvent(eventName: string, metadata: AnalyticsMetadata = {}) {
  try {
    rememberEvent(eventName, metadata)
    const user = await getAnalyticsUser()
    if (!user) return
    const pagePath = typeof window !== 'undefined'
      ? `${window.location.pathname}${window.location.search}`
      : null

    await supabase.from('app_events').insert({
      user_id: user.id,
      event_name: eventName,
      page_path: pagePath,
      car_id: metadata.carId || metadata.car_id || null,
      metadata: {
        ...metadata,
        clientPlatform: getClientPlatform(),
        userEmail: user.email,
        appVersion: APP_VERSION,
        releaseChannel: RELEASE_CHANNEL,
      },
    })
  } catch (error) {
    console.warn('GarageBase analytics event skipped:', eventName, error)
  }
}

export async function trackError(errorName: string, metadata: AnalyticsMetadata = {}) {
  try {
    const user = await getAnalyticsUser()
    const pagePath = typeof window !== 'undefined'
      ? `${window.location.pathname}${window.location.search}`
      : null
    const clientContext = getClientContext()
    const recentEvents = getRecentEvents()
    const finalMetadata = {
      ...metadata,
      ...clientContext,
      recentEvents,
    }

    await supabase.from('app_errors').insert({
      user_id: user?.id || null,
      error_name: errorName,
      page_path: pagePath,
      message: String(metadata.message || ''),
      stack: metadata.stack ? String(metadata.stack).slice(0, 4000) : null,
      app_version: APP_VERSION,
      release_channel: RELEASE_CHANNEL,
      device_info: typeof window !== 'undefined' ? navigator.userAgent : null,
      metadata: finalMetadata,
    })
  } catch (error) {
    console.warn('GarageBase error tracking skipped:', errorName, error)
  }
}
