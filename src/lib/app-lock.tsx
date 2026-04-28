'use client'

import { useEffect, useState } from 'react'

const enabledKey = 'garagebase_app_lock_enabled'
const credentialKey = 'garagebase_app_lock_credential'
const sessionUnlockedKey = 'garagebase_app_lock_session_unlocked'

function base64UrlToBuffer(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
  const binary = window.atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}


export function hasAppLockCredential() {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(enabledKey) === 'true' && !!localStorage.getItem(credentialKey) && 'PublicKeyCredential' in window
}

export async function unlockWithAppLock() {
  const credentialId = localStorage.getItem(credentialKey)
  if (!credentialId) throw new Error('Biometrija ni nastavljena.')
  const challenge = crypto.getRandomValues(new Uint8Array(32))
  await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: [{ id: base64UrlToBuffer(credentialId), type: 'public-key' }],
      userVerification: 'required',
      timeout: 60000
    }
  })
  sessionStorage.setItem(sessionUnlockedKey, 'true')
}
export function AppLock() {
  const [locked, setLocked] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const path = window.location.pathname
    const skip = path === '/' || path === '/login'
    const enabled = localStorage.getItem(enabledKey) === 'true'
    const credentialId = localStorage.getItem(credentialKey)
    const sessionUnlocked = sessionStorage.getItem(sessionUnlockedKey) === 'true'
    if (!skip && enabled && credentialId && !sessionUnlocked && 'PublicKeyCredential' in window) {
      setLocked(true)
    }
  }, [])

  const unlock = async () => {
    try {
      await unlockWithAppLock()
      setLocked(false)
      setMessage('')
    } catch (error) {
      setMessage('Odklep ni uspel. Poskusi se enkrat.')
    }
  }

  if (!locked) return null

  return (
    <div className="fixed inset-0 z-[200] bg-[#080810] text-white flex items-center justify-center px-5">
      <div className="w-full max-w-sm bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-6 text-center shadow-2xl">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-[#6c63ff22] border border-[#6c63ff55] flex items-center justify-center text-3xl mb-4">🔒</div>
        <h2 className="text-xl font-bold mb-2">GarageBase je zaklenjen</h2>
        <p className="text-[#8a8aa8] text-sm leading-relaxed mb-5">Odkleni z biometrijo ali zaklepom naprave.</p>
        <button onClick={unlock} className="w-full bg-[#6c63ff] hover:bg-[#5a52e0] text-white font-semibold py-3 rounded-xl transition-colors">
          Odkleni
        </button>
        {message && <p className="text-[#fca5a5] text-sm mt-3">{message}</p>}
      </div>
    </div>
  )
}
