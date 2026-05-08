'use client'

import { supabase } from '@/lib/supabase'

export async function checkCurrentUserAdmin() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return { isAdmin: false, user: null }

  const { data: sessionData } = await supabase.auth.getSession()
  const jwt = sessionData.session?.access_token
  if (!jwt) return { isAdmin: false, user }

  try {
    const response = await fetch('/api/admin/check', {
      headers: { Authorization: `Bearer ${jwt}` },
      cache: 'no-store',
    })
    if (!response.ok) return { isAdmin: false, user }
    const result = await response.json()
    return { isAdmin: Boolean(result.isAdmin), user }
  } catch {
    return { isAdmin: false, user }
  }
}
