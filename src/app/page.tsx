'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [isRegister, setIsRegister] = useState(false)

  const handleAuth = async () => {
    setLoading(true)
    setMessage('')

    if (isRegister) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setMessage(error.message)
      else setMessage('Preveri email za potrditev registracije!')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setMessage(error.message)
      else window.location.href = '/dashboard'
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#080810] flex items-center justify-center px-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-white">
            Garage<span className="text-[#6c63ff]">Base</span>
          </h1>
          <p className="text-[#5a5a80] mt-2 text-sm">
            Tvoja avto evidenca — vse na enem mestu
          </p>
        </div>

        {/* Card */}
        <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-8">

          <h2 className="text-white font-semibold text-xl mb-6">
            {isRegister ? 'Ustvari račun' : 'Prijava'}
          </h2>

          {/* Email */}
          <div className="mb-4">
            <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">
              Email naslov
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ime@email.com"
              className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors"
            />
          </div>

          {/* Password */}
          <div className="mb-6">
            <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">
              Geslo
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Vsaj 6 znakov"
              className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors"
            />
          </div>

          {/* Message */}
          {message && (
            <div className="mb-4 p-3 rounded-xl bg-[#6c63ff22] border border-[#6c63ff44] text-[#a09aff] text-sm">
              {message}
            </div>
          )}

          {/* Button */}
          <button
            onClick={handleAuth}
            disabled={loading}
            className="w-full bg-[#6c63ff] hover:bg-[#5a52e0] text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50"
          >
            {loading ? 'Prosim počakaj...' : isRegister ? 'Ustvari račun' : 'Prijava'}
          </button>

          {/* Toggle */}
          <p className="text-center text-[#5a5a80] text-sm mt-4">
            {isRegister ? 'Že imaš račun?' : 'Nimaš računa?'}{' '}
            <span
              onClick={() => setIsRegister(!isRegister)}
              className="text-[#6c63ff] cursor-pointer hover:underline"
            >
              {isRegister ? 'Prijava' : 'Registracija'}
            </span>
          </p>

        </div>
      </div>
    </div>
  )
}