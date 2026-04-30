'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { hasAppLockCredential, unlockWithAppLock } from '@/lib/app-lock'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [isRegister, setIsRegister] = useState(false)
  const [resetMode, setResetMode] = useState(false)
  const [biometricReady, setBiometricReady] = useState(false)
  const [acceptedLegal, setAcceptedLegal] = useState(false)

  useEffect(() => {
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
      window.location.href = '/garaza'
    } catch {
      setMessage('Biometrična prijava ni uspela. Poskusi znova ali uporabi geslo.')
    }
    setLoading(false)
  }

  const handleAuth = async () => {
    setLoading(true)
    setMessage('')

    if (resetMode) {
      if (newPassword.length < 6) {
        setMessage('Novo geslo mora imeti vsaj 6 znakov.')
        setLoading(false)
        return
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) setMessage(error.message)
      else {
        setMessage('Geslo je spremenjeno. Zdaj se lahko prijaviš.')
        setResetMode(false)
        setPassword('')
        setNewPassword('')
      }
      setLoading(false)
      return
    }

    if (isRegister) {
      if (!acceptedLegal) {
        setMessage('Za registracijo se moraš strinjati s pogoji uporabe in politiko zasebnosti.')
        setLoading(false)
        return
      }
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setMessage(error.message)
      else setMessage('Preveri email za potrditev registracije!')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setMessage(error.message)
      else {
        const raw = localStorage.getItem('garagebase_nastavitve')
        let onboardingDone = false
        if (raw) {
          try { onboardingDone = JSON.parse(raw).onboardingDone === true } catch {}
        }
        window.location.href = onboardingDone ? '/garaza' : '/onboarding'
      }
    }
    setLoading(false)
  }

  const sendPasswordReset = async () => {
    if (!email) {
      setMessage('Najprej vpiši email naslov.')
      return
    }
    setLoading(true)
    setMessage('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login?type=recovery`,
    })
    if (error) setMessage(error.message)
    else setMessage('Poslali smo ti email povezavo za ponastavitev gesla.')
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
              message.includes('Preveri') || message.includes('Poslali') || message.includes('spremenjeno')
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
