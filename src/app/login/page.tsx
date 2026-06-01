'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { hasAppLockCredential, unlockWithAppLock } from '@/lib/app-lock'
import { getStoredLanguage } from '@/lib/i18n'

const LOGIN_RATE_LIMIT_MAX = 10
const LOGIN_RATE_LIMIT_WINDOW_MS = 60 * 1000
const LOGIN_RATE_LIMIT_KEY = 'garagebase_login_attempts'

const rateLimitBucket = (email: string) => email.trim().toLowerCase() || 'anonymous'

const readLoginAttempts = () => {
  try {
    const raw = localStorage.getItem(LOGIN_RATE_LIMIT_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

const writeLoginAttempts = (attempts: Record<string, number[]>) => {
  try {
    localStorage.setItem(LOGIN_RATE_LIMIT_KEY, JSON.stringify(attempts))
  } catch {}
}

const checkLoginRateLimit = (email: string) => {
  const now = Date.now()
  const bucket = rateLimitBucket(email)
  const attempts = readLoginAttempts() as Record<string, number[]>
  const recent = (attempts[bucket] || []).filter((time) => now - time < LOGIN_RATE_LIMIT_WINDOW_MS)
  if (recent.length >= LOGIN_RATE_LIMIT_MAX) {
    const retryMs = LOGIN_RATE_LIMIT_WINDOW_MS - (now - recent[0])
    return { allowed: false, retrySeconds: Math.max(1, Math.ceil(retryMs / 1000)) }
  }
  attempts[bucket] = [...recent, now]
  writeLoginAttempts(attempts)
  return { allowed: true, retrySeconds: 0 }
}

const clearLoginRateLimit = (email: string) => {
  const bucket = rateLimitBucket(email)
  const attempts = readLoginAttempts() as Record<string, number[]>
  if (!attempts[bucket]) return
  delete attempts[bucket]
  writeLoginAttempts(attempts)
}

export default function LoginPage() {
  const [language, setLanguage] = useState<'sl' | 'en'>('sl')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [isRegister, setIsRegister] = useState(false)
  const [resetMode, setResetMode] = useState(false)
  const [biometricReady, setBiometricReady] = useState(false)
  const [acceptedLegal, setAcceptedLegal] = useState(false)
  const tx = (sl: string, en: string) => language === 'en' ? en : sl
  const cleanEmail = () => email.trim().toLowerCase()
  const authErrorText = (error: any) => {
    const text = String(error?.message || '')
    const lower = text.toLowerCase()
    if (lower.includes('invalid login credentials')) return tx('Email ali geslo ni pravilno.', 'Email or password is not correct.')
    if (lower.includes('email not confirmed')) return tx('Najprej potrdi registracijo prek povezave v emailu.', 'Confirm your registration using the link in your email first.')
    if (lower.includes('password should be at least') || lower.includes('weak password')) return tx('Geslo mora imeti vsaj 6 znakov.', 'Password must have at least 6 characters.')
    if (lower.includes('unable to validate email') || lower.includes('invalid email')) return tx('Vpiši veljaven email naslov.', 'Enter a valid email address.')
    if (lower.includes('rate limit')) return tx('Preveč poskusov. Poskusi znova malo kasneje.', 'Too many attempts. Try again a little later.')
    return text || tx('Prijava trenutno ni uspela. Poskusi znova.', 'Sign-in failed right now. Try again.')
  }

  const markAfterLoginHome = () => {
    const stamp = String(Date.now())
    try {
      sessionStorage.removeItem('garagebase_seen_domov_this_session')
      sessionStorage.setItem('garagebase_after_login_home', stamp)
      localStorage.setItem('garagebase_after_login_home', stamp)
    } catch {}
  }

  const afterLoginPath = () => {
    try {
      const settings = JSON.parse(localStorage.getItem('garagebase_nastavitve') || '{}')
      return settings?.nacin === 'lite' ? '/garaza?direct=1' : '/domov?login=1'
    } catch {
      return '/domov?login=1'
    }
  }

  useEffect(() => {
    setLanguage(getStoredLanguage() === 'en' ? 'en' : 'sl')
    document.body.classList.add('landing')
    setBiometricReady(hasAppLockCredential())
    const url = new URL(window.location.href)
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    if (url.searchParams.get('type') === 'recovery' || hash.get('type') === 'recovery') {
      setResetMode(true)
      setMessage('Vpiši novo geslo in ga shrani.')
    }
    return () => document.body.classList.remove('landing')
  }, [])

  const handleBiometricLogin = async () => {
    setLoading(true)
    setMessage('')
    try {
      const { data } = await supabase.auth.getSession()
      if (!data.session) {
        setMessage('Za biometrijo mora biti seja še aktivna. Najprej se enkrat prijavi z geslom.')
        setLoading(false)
        return
      }
      await unlockWithAppLock()
      markAfterLoginHome()
      window.location.replace(afterLoginPath())
    } catch {
      setMessage('Biometrična prijava ni uspela. Poskusi znova ali uporabi geslo.')
    }
    setLoading(false)
  }

  const handleAuth = async () => {
    setLoading(true)
    setMessage('')
    const normalizedEmail = cleanEmail()

    if (resetMode) {
      if (newPassword.length < 6) {
        setMessage(tx('Novo geslo mora imeti vsaj 6 znakov.', 'The new password must have at least 6 characters.'))
        setLoading(false)
        return
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) setMessage(authErrorText(error))
      else {
        setMessage(tx('Geslo je spremenjeno. Zdaj se lahko prijaviš.', 'Password changed. You can sign in now.'))
        setResetMode(false)
        setPassword('')
        setNewPassword('')
      }
      setLoading(false)
      return
    }

    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      setMessage(tx('Vpiši veljaven email naslov.', 'Enter a valid email address.'))
      setLoading(false)
      return
    }
    if (password.length < 6) {
      setMessage(tx('Geslo mora imeti vsaj 6 znakov.', 'Password must have at least 6 characters.'))
      setLoading(false)
      return
    }

    if (isRegister) {
      if (!acceptedLegal) {
        setMessage(tx('Za registracijo se moraš strinjati s pogoji uporabe in politiko zasebnosti.', 'To register, you must accept the terms of use and privacy policy.'))
        setLoading(false)
        return
      }
      const { data, error } = await supabase.auth.signUp({ email: normalizedEmail, password })
      if (error) setMessage(authErrorText(error))
      else {
        try {
          const current = JSON.parse(localStorage.getItem('garagebase_nastavitve') || '{}')
          localStorage.setItem('garagebase_nastavitve', JSON.stringify({ ...current, pisava: current.pisava || 140, fontPresetVersion: current.fontPresetVersion || 3 }))
        } catch {}
        if (data.session) {
          clearLoginRateLimit(normalizedEmail)
          markAfterLoginHome()
          window.location.replace(afterLoginPath())
          return
        }
        const identities = data.user?.identities || []
        setMessage(identities.length === 0
          ? tx('Če račun že obstaja, se prijavi ali uporabi pozabljeno geslo. Če je nov, preveri email za potrditev.', 'If the account already exists, sign in or use forgot password. If it is new, check your email to confirm it.')
          : tx('Preveri email za potrditev registracije.', 'Check your email to confirm registration.'))
      }
    } else {
      const rateLimit = checkLoginRateLimit(normalizedEmail)
      if (!rateLimit.allowed) {
        setMessage(tx(`Preveč poskusov prijave. Poskusi znova čez ${rateLimit.retrySeconds} s.`, `Too many login attempts. Try again in ${rateLimit.retrySeconds}s.`))
        setLoading(false)
        return
      }
      const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password })
      if (error) setMessage(authErrorText(error))
      else {
        clearLoginRateLimit(normalizedEmail)
        markAfterLoginHome()
        window.location.replace(afterLoginPath())
      }
    }
    setLoading(false)
  }

  const sendPasswordReset = async () => {
    if (!cleanEmail()) {
      setMessage(tx('Najprej vpiši email naslov.', 'Enter your email address first.'))
      return
    }
    setLoading(true)
    setMessage('')
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail(), {
      redirectTo: `${window.location.origin}/login?type=recovery`,
    })
    if (error) setMessage(authErrorText(error))
    else setMessage(tx('Poslali smo ti email povezavo za ponastavitev gesla.', 'We sent you a password reset link by email.'))
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#080810] flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[#6c63ff] opacity-10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/4 w-[300px] h-[300px] bg-[#3ecfcf] opacity-5 rounded-full blur-[100px]" />
      </div>

      <div className="relative w-full max-w-md">
        <a href="/" className="flex items-center gap-2 text-[#5a5a80] hover:text-white transition-colors text-sm mb-8">
          ← Nazaj
        </a>

        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-white">
            Garage<span className="text-[#6c63ff]">Base</span>
          </h1>
          <p className="text-[#5a5a80] mt-2 text-sm">
            Tvoja avto evidenca - vse na enem mestu
          </p>
        </div>

        <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-8">
          <h2 className="text-white font-semibold text-xl mb-6">
            {resetMode ? 'Ponastavi geslo' : isRegister ? 'Ustvari račun' : 'Prijava'}
          </h2>

          <div className="mb-4">
            <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Email naslov</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="ime@email.com"
              className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
          </div>

          {resetMode ? (
            <div className="mb-6">
              <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Novo geslo</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Vsaj 6 znakov"
                className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
            </div>
          ) : (
            <div className="mb-3">
              <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Geslo</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="Vsaj 6 znakov"
                className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
            </div>
          )}

          {!isRegister && !resetMode && (
            <button type="button" onClick={sendPasswordReset} disabled={loading}
              className="mb-5 text-sm font-semibold text-[#a09aff] hover:underline disabled:opacity-50">
              Pozabljeno geslo?
            </button>
          )}

          {isRegister && (
            <label className="mb-5 flex items-start gap-3 rounded-xl border border-[#1e1e32] bg-[#13131f] p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedLegal}
                onChange={(e) => setAcceptedLegal(e.target.checked)}
                className="mt-1 h-4 w-4 accent-[#6c63ff]"
              />
              <span className="text-[#8a8aa8] text-xs leading-relaxed">
                Strinjam se s <a href="/terms" target="_blank" className="text-[#a09aff] underline">Pogoji uporabe</a>,
                {' '}<a href="/privacy" target="_blank" className="text-[#a09aff] underline">Politiko zasebnosti</a>
                {' '}in <a href="/promo" target="_blank" className="text-[#a09aff] underline">launch promocijo</a>.
              </span>
            </label>
          )}

          {message && (
            <div className={`mb-4 p-3 rounded-xl text-sm border ${
              message.includes('Preveri') || message.includes('Poslali') || message.includes('spremenjeno') || message.includes('Check') || message.includes('sent') || message.includes('changed')
                ? 'bg-[#16a34a22] border-[#16a34a44] text-[#4ade80]'
                : 'bg-[#ef444422] border-[#ef444444] text-[#fca5a5]'
            }`}>
              {message}
            </div>
          )}

          <button onClick={handleAuth} disabled={loading}
            className="w-full bg-[#6c63ff] hover:bg-[#5a52e0] text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50">
            {loading ? 'Prosim počakaj...' : resetMode ? 'Shrani novo geslo' : isRegister ? 'Ustvari račun' : 'Prijava'}
          </button>

          {!isRegister && !resetMode && biometricReady && (
            <button onClick={handleBiometricLogin} disabled={loading}
              className="w-full mt-3 bg-[#13131f] border border-[#3ecfcf66] text-[#3ecfcf] font-semibold py-3 rounded-xl transition-colors disabled:opacity-50">
              Prijava z biometrijo
            </button>
          )}

          {!resetMode && (
            <p className="text-center text-[#5a5a80] text-sm mt-4">
              {isRegister ? 'Že imaš račun?' : 'Nimaš računa?'}{' '}
              <span onClick={() => setIsRegister(!isRegister)}
                className="text-[#6c63ff] cursor-pointer hover:underline">
                {isRegister ? 'Prijava' : 'Registracija'}
              </span>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
