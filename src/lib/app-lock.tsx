'use client'

import { useEffect, useState } from 'react'

const enabledKey = 'garagebase_app_lock_enabled'
const credentialKey = 'garagebase_app_lock_credential'
const sessionUnlockedKey = 'garagebase_app_lock_session_unlocked'

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

function base64UrlToBuffer(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
  const binary = window.atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

function isAppLockSupported() {
  return typeof window !== 'undefined' &&
    window.isSecureContext &&
    'PublicKeyCredential' in window &&
    'credentials' in navigator
}

function disableLocalAppLock() {
  localStorage.removeItem(enabledKey)
  localStorage.removeItem(credentialKey)
  sessionStorage.setItem(sessionUnlockedKey, 'true')
}

export function hasAppLockCredential() {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(enabledKey) === 'true' && !!localStorage.getItem(credentialKey) && isAppLockSupported()
}

export async function unlockWithAppLock() {
  const credentialId = localStorage.getItem(credentialKey)
  if (!credentialId) throw new Error('Biometrija ni nastavljena.')
  if (!isAppLockSupported()) throw new Error('Biometrija na tej napravi ni podprta.')
  const challenge = crypto.getRandomValues(new Uint8Array(32))
  await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: [{ id: base64UrlToBuffer(credentialId), type: 'public-key' }],
      userVerification: 'required',
      timeout: 60000,
    },
  })
  sessionStorage.setItem(sessionUnlockedKey, 'true')
}

export function AppLock() {
  const [locked, setLocked] = useState(false)
  const [message, setMessage] = useState('')
  const [canDisableLock, setCanDisableLock] = useState(false)
  const [failedAttempts, setFailedAttempts] = useState(0)

  useEffect(() => {
    const path = window.location.pathname
    const skip = path === '/' || path === '/login'
    const enabled = localStorage.getItem(enabledKey) === 'true'
    const credentialId = localStorage.getItem(credentialKey)
    const sessionUnlocked = sessionStorage.getItem(sessionUnlockedKey) === 'true'
    if (skip || !enabled || !credentialId || sessionUnlocked) return

    if (!isAppLockSupported()) {
      disableLocalAppLock()
      return
    }

    setLocked(true)
  }, [])

  const unlock = async () => {
    try {
      await unlockWithAppLock()
      setLocked(false)
      setMessage('')
    } catch {
      const nextFailedAttempts = failedAttempts + 1
      setFailedAttempts(nextFailedAttempts)
      setCanDisableLock(!isAppLockSupported() || nextFailedAttempts >= 2)
      setMessage(isAppLockSupported()
        ? tx('Odklep ni uspel. Poskusi se enkrat.', 'Unlock failed. Try again.')
        : tx('Ta naprava ne podpira biometričnega odklepa. Odstrani lokalni zaklep in se prijavi normalno.', 'This device does not support biometric unlock. Remove the local lock and sign in normally.'))
    }
  }

  const disableLock = () => {
    disableLocalAppLock()
    setLocked(false)
    setMessage('')
  }

  if (!locked) return null

  return (
    <div className="fixed inset-0 z-[200] bg-[#080810] text-white flex items-center justify-center px-6">
      <div className="w-full max-w-[30rem] bg-[#0f0f1a] border border-[#1e1e32] rounded-[28px] p-9 text-center shadow-2xl sm:p-10">
        <div className="w-24 h-24 mx-auto rounded-[28px] bg-[#6c63ff22] border border-[#6c63ff55] flex items-center justify-center text-5xl mb-6">&#128274;</div>
        <h2 className="text-3xl font-bold mb-3">{tx('GarageBase je zaklenjen', 'GarageBase is locked')}</h2>
        <p className="text-[#8a8aa8] text-base sm:text-lg leading-relaxed mb-7">{tx('Odkleni z biometrijo ali zaklepom naprave.', 'Unlock with biometrics or device lock.')}</p>
        <button onClick={unlock} className="w-full bg-[#6c63ff] hover:bg-[#5a52e0] text-white font-semibold py-5 rounded-2xl text-lg transition-colors">
          {tx('Odkleni', 'Unlock')}
        </button>
        {canDisableLock && (
          <button onClick={disableLock} className="mt-4 w-full rounded-2xl border border-[#f59e0b55] bg-[#f59e0b18] py-5 text-lg font-semibold text-[#fbbf24]">
            {tx('Odstrani lokalni zaklep', 'Remove local lock')}
          </button>
        )}
        {message && <p className="text-[#fca5a5] text-base mt-4">{message}</p>}
      </div>
    </div>
  )
}
