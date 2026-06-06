'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Controls = {
  status?: string
  blocked_until?: string | null
  reason?: string | null
  feature_limits?: Record<string, unknown>
}

function language() {
  try {
    const settings = JSON.parse(localStorage.getItem('garagebase_nastavitve') || '{}')
    return settings.jezik === 'en' || settings.language === 'en' ? 'en' : 'sl'
  } catch {
    return 'sl'
  }
}

function tx(sl: string, en: string) {
  return language() === 'en' ? en : sl
}

const publicPaths = ['/', '/login', '/privacy', '/terms', '/promo']

function isPublicPath(pathname: string) {
  return publicPaths.includes(pathname)
}

function activeBlock(controls: Controls) {
  if (controls.status !== 'blocked') return false
  if (!controls.blocked_until) return true
  return new Date(controls.blocked_until).getTime() > Date.now()
}

function limitedPath(pathname: string, limits: Record<string, unknown>) {
  if (limits.readOnly && (
    pathname.startsWith('/vnos-') ||
    pathname === '/dodaj-avto' ||
    pathname === '/uvoz-podatkov' ||
    pathname === '/nastavitve-avta'
  )) return 'readOnly'
  if (limits.blockReports && pathname === '/report') return 'blockReports'
  if (limits.blockQrTransfer && (pathname === '/scan' || pathname === '/prenos')) return 'blockQrTransfer'
  if (limits.blockPush && pathname === '/opomniki') return 'blockPush'
  return ''
}

function messageFor(reason: string, controls: Controls) {
  if (activeBlock(controls)) {
    return {
      title: tx('Račun je začasno omejen', 'Account is temporarily limited'),
      body: controls.reason || tx('Za pomoč kontaktiraj podporo GarageBase.', 'Contact GarageBase support for help.'),
    }
  }
  if (reason === 'readOnly') {
    return {
      title: tx('Račun je v načinu samo za branje', 'Account is in read-only mode'),
      body: tx('Pregledi delujejo, novi vnosi pa so trenutno omejeni.', 'Views still work, but new entries are currently limited.'),
    }
  }
  if (reason === 'blockReports') {
    return {
      title: tx('PDF/report je trenutno omejen', 'PDF/report is currently limited'),
      body: tx('Ta funkcija je ročno omejena za ta račun.', 'This feature is manually limited for this account.'),
    }
  }
  if (reason === 'blockQrTransfer') {
    return {
      title: tx('QR/prenos je trenutno omejen', 'QR/transfer is currently limited'),
      body: tx('Prenos zgodovine je ročno omejen za ta račun.', 'History transfer is manually limited for this account.'),
    }
  }
  return {
    title: tx('Funkcija je trenutno omejena', 'Feature is currently limited'),
    body: tx('Za pomoč kontaktiraj podporo GarageBase.', 'Contact GarageBase support for help.'),
  }
}

export function UserAdminControlsGate() {
  const [blockedMessage, setBlockedMessage] = useState<{ title: string; body: string } | null>(null)

  useEffect(() => {
    let cancelled = false

    const checkControls = async () => {
      if (typeof window === 'undefined') return
      const pathname = window.location.pathname
      if (isPublicPath(pathname)) return

      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) return

      const response = await fetch('/api/user-controls', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      if (!response.ok) return
      const controls: Controls = await response.json()
      if (cancelled) return

      localStorage.setItem('garagebase_user_admin_controls', JSON.stringify(controls || {}))
      const limits = controls?.feature_limits || {}
      const reason = activeBlock(controls) ? 'blocked' : limitedPath(pathname, limits)
      if (reason) setBlockedMessage(messageFor(reason, controls))
      else setBlockedMessage(null)
    }

    checkControls().catch(() => {})
    const checkAfterClick = () => window.setTimeout(() => checkControls().catch(() => {}), 350)
    window.addEventListener('popstate', checkControls)
    window.addEventListener('focus', checkControls)
    window.addEventListener('click', checkAfterClick, true)
    return () => {
      cancelled = true
      window.removeEventListener('popstate', checkControls)
      window.removeEventListener('focus', checkControls)
      window.removeEventListener('click', checkAfterClick, true)
    }
  }, [])

  if (!blockedMessage) return null

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#080810]/95 px-5">
      <div className="w-full max-w-md rounded-[28px] border border-[#ef444466] bg-[#11111d] p-6 text-center shadow-2xl shadow-black/40">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-[#ef4444]">GarageBase</p>
        <h2 className="mt-3 text-2xl font-black text-white">{blockedMessage.title}</h2>
        <p className="mt-3 text-sm leading-relaxed text-[#c7c7d8]">{blockedMessage.body}</p>
        <button
          onClick={() => { window.location.href = '/nastavitve' }}
          className="mt-5 w-full rounded-2xl bg-[#6c63ff] px-5 py-3 text-sm font-black text-white"
        >
          {tx('Odpri nastavitve', 'Open settings')}
        </button>
      </div>
    </div>
  )
}
