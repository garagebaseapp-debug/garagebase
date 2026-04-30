import { supabase } from '@/lib/supabase'

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0-beta'
const RELEASE_CHANNEL = process.env.NEXT_PUBLIC_RELEASE_CHANNEL || 'local'
const RECENT_EVENTS_KEY = 'garagebase_recent_events'

function getClientContext() {
  if (typeof window === 'undefined') return {}
  let storedSettings: any = null
  try {
    storedSettings = JSON.parse(localStorage.getItem('garagebase_nastavitve') || 'null')
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
    } : null,
  }
}

function rememberEvent(eventName: string, metadata: Record<string, any>) {
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

export async function trackEvent(eventName: string, metadata: Record<string, any> = {}) {
  try {
    rememberEvent(eventName, metadata)
    const { data: { user } } = await supabase.auth.getUser()
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
        appVersion: APP_VERSION,
        releaseChannel: RELEASE_CHANNEL,
      },
    })
  } catch (error) {
    console.warn('GarageBase analytics event skipped:', eventName, error)
  }
}

export async function trackError(errorName: string, metadata: Record<string, any> = {}) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
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
