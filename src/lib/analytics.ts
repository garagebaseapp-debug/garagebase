import { supabase } from '@/lib/supabase'

export async function trackEvent(eventName: string, metadata: Record<string, any> = {}) {
  try {
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
      metadata,
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

    await supabase.from('app_errors').insert({
      user_id: user?.id || null,
      error_name: errorName,
      page_path: pagePath,
      message: String(metadata.message || ''),
      stack: metadata.stack ? String(metadata.stack).slice(0, 4000) : null,
      metadata,
    })
  } catch (error) {
    console.warn('GarageBase error tracking skipped:', errorName, error)
  }
}
