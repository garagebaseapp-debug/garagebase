'use client'

import { supabase } from '@/lib/supabase'

type AdminCheckResult = {
  isAdmin: boolean
  user: any
}

let adminCheckCache: { userId: string; result: AdminCheckResult; savedAt: number } | null = null
let adminCheckInFlight: Promise<AdminCheckResult> | null = null

export async function checkCurrentUserAdmin() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) {
    adminCheckCache = null
    return { isAdmin: false, user: null }
  }

  if (
    adminCheckCache &&
    adminCheckCache.userId === user.id &&
    Date.now() - adminCheckCache.savedAt < 5 * 60 * 1000
  ) {
    return adminCheckCache.result
  }
  if (adminCheckInFlight) return adminCheckInFlight

  const { data: sessionData } = await supabase.auth.getSession()
  const jwt = sessionData.session?.access_token
  if (!jwt) return { isAdmin: false, user }

  adminCheckInFlight = (async () => {
    const response = await fetch('/api/admin/check', {
      headers: { Authorization: `Bearer ${jwt}` },
      cache: 'no-store',
    })
    if (!response.ok) return { isAdmin: false, user }
    const result = await response.json()
    return { isAdmin: Boolean(result.isAdmin), user }
  })()

  try {
    const result = await adminCheckInFlight
    adminCheckCache = { userId: user.id, result, savedAt: Date.now() }
    return result
  } catch {
    return { isAdmin: false, user }
  } finally {
    adminCheckInFlight = null
  }
}
