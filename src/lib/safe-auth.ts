'use client'

import { supabase } from '@/lib/supabase'

export function isBrowserOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

export async function getSafeAuthUser() {
  try {
    if (isBrowserOffline()) {
      const { data } = await supabase.auth.getSession()
      return data.session?.user || null
    }

    const { data } = await supabase.auth.getUser()
    return data.user || null
  } catch {
    try {
      const { data } = await supabase.auth.getSession()
      return data.session?.user || null
    } catch {
      return null
    }
  }
}
