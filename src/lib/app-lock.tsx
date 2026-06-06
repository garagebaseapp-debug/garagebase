'use client'

import { useEffect, useState } from 'react'

const enabledKey = 'garagebase_app_lock_enabled'
const modeKey = 'garagebase_app_lock_mode'
const credentialKey = 'garagebase_app_lock_credential'
const patternKey = 'garagebase_app_lock_pattern'
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
  localStorage.removeItem(modeKey)
  localStorage.removeItem(credentialKey)
  localStorage.removeItem(patternKey)
  sessionStorage.setItem(sessionUnlockedKey, 'true')
}

export function hasAppLockCredential() {
  if (typeof window === 'undefined') return false
  const mode = localStorage.getItem(modeKey) || 'biometric'
  return localStorage.getItem(enabledKey) === 'true' && (
    (mode === 'pattern' && !!localStorage.getItem(patternKey)) ||
    (mode !== 'pattern' && !!localStorage.getItem(credentialKey) && isAppLockSupported())
  )
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
  const [mode, setMode] = useState<'biometric' | 'pattern'>('biometric')
  const [patternInput, setPatternInput] = useState<number[]>([])

  useEffect(() => {
    const path = window.location.pathname
    const skip = path === '/' || path === '/login'
    const enabled = localStorage.getItem(enabledKey) === 'true'
    const lockMode = localStorage.getItem(modeKey) === 'pattern' ? 'pattern' : 'biometric'
    const credentialId = localStorage.getItem(credentialKey)
    const savedPattern = localStorage.getItem(patternKey)
    const sessionUnlocked = sessionStorage.getItem(sessionUnlockedKey) === 'true'
    if (skip || !enabled || sessionUnlocked) return
    if (lockMode === 'pattern' && !savedPattern) return
    if (lockMode !== 'pattern' && !credentialId) return

    if (lockMode !== 'pattern' && !isAppLockSupported()) {
      disableLocalAppLock()
      return
    }

    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setMode(lockMode)
      setLocked(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const unlockWithPattern = (nextPattern: number[]) => {
    const savedPattern = localStorage.getItem(patternKey)
    if (!savedPattern) return
    if (nextPattern.join('-') === savedPattern) {
      sessionStorage.setItem(sessionUnlockedKey, 'true')
      setLocked(false)
      setMessage('')
      return
    }
    const nextFailedAttempts = failedAttempts + 1
    setFailedAttempts(nextFailedAttempts)
    setCanDisableLock(nextFailedAttempts >= 4)
    setMessage(tx('Vzorec ni pravilen. Poskusi še enkrat.', 'Pattern is not correct. Try again.'))
    setPatternInput([])
  }

  const addPatternPoint = (point: number) => {
    if (patternInput.includes(point)) return
    const nextPattern = [...patternInput, point]
    setPatternInput(nextPattern)
    if (nextPattern.length >= 4) unlockWithPattern(nextPattern)
  }

  const unlock = async () => {
    if (mode === 'pattern') {
      if (patternInput.length >= 4) unlockWithPattern(patternInput)
      else setMessage(tx('Izberi vsaj 4 pike vzorca.', 'Select at least 4 pattern dots.'))
      return
    }
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
        : tx('Ta naprava ne podpira varnega sistemskega odklepa. Odstrani lokalni zaklep in se prijavi normalno.', 'This device does not support secure system unlock. Remove the local lock and sign in normally.'))
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
        <p className="text-[#8a8aa8] text-base sm:text-lg leading-relaxed mb-7">
          {mode === 'pattern'
            ? tx('Vnesi svoj GarageBase vzorec.', 'Enter your GarageBase pattern.')
            : tx('Odkleni z obrazom, odtisom, PIN-om ali vzorcem naprave.', 'Unlock with face, fingerprint, PIN or device pattern.')}
        </p>
        {mode === 'pattern' && (
          <div className="mx-auto mb-6 grid w-full max-w-[14rem] grid-cols-3 gap-4">
            {Array.from({ length: 9 }, (_, index) => index + 1).map((point) => {
              const selected = patternInput.includes(point)
              return (
                <button
                  key={point}
                  type="button"
                  onClick={() => addPatternPoint(point)}
                  aria-label={`${tx('Pika', 'Dot')} ${point}`}
                  className={`flex h-14 w-14 items-center justify-center rounded-full border transition-colors ${
                    selected ? 'border-[#6c63ff] bg-[#6c63ff] text-white shadow-lg shadow-[#6c63ff33]' : 'border-[#2a2a40] bg-[#151526] text-[#8a8aa8]'
                  }`}
                >
                  <span className="h-3 w-3 rounded-full bg-current" />
                </button>
              )
            })}
          </div>
        )}
        <button onClick={unlock} className="w-full bg-[#6c63ff] hover:bg-[#5a52e0] text-white font-semibold py-5 rounded-2xl text-lg transition-colors">
          {mode === 'pattern' ? tx('Potrdi vzorec', 'Confirm pattern') : tx('Odkleni', 'Unlock')}
        </button>
        {mode === 'pattern' && (
          <button onClick={() => { setPatternInput([]); setMessage('') }} className="mt-4 w-full rounded-2xl border border-[#2a2a40] bg-[#151526] py-4 text-base font-semibold text-[#c8c8dc]">
            {tx('Počisti vzorec', 'Clear pattern')}
          </button>
        )}
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
