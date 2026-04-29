'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useLanguage } from '@/lib/i18n'

export default function OnboardingPage() {
  const { language } = useLanguage()
  const [loading, setLoading] = useState(true)

  const tx = (sl: string, en: string) => language === 'en' ? en : sl

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = '/'
        return
      }

      const raw = localStorage.getItem('garagebase_nastavitve')
      if (raw) {
        try {
          const settings = JSON.parse(raw)
          if (settings.onboardingDone) {
            window.location.href = '/garaza'
            return
          }
        } catch {}
      }
      setLoading(false)
    }
    init()
  }, [])

  const izberiNacin = (nacin: 'lite' | 'full') => {
    const raw = localStorage.getItem('garagebase_nastavitve')
    const current = raw ? JSON.parse(raw) : {}
    const next = {
      ...current,
      nacin,
      onboardingDone: true,
      prikazGaraze: current.prikazGaraze || (nacin === 'lite' ? 'malo' : 'srednje'),
      listaNastavitve: current.listaNastavitve || {
        letnik: true,
        gorivo: true,
        km: true,
        opomnik: true,
        tablica: true,
        opomnikRdeci: true,
        opomnikRumeni: true,
        opomnikZeleni: false,
        opomnikKmRdeci: true,
        opomnikKmRumeni: true,
        opomnikKmZeleni: false,
      },
    }
    localStorage.setItem('garagebase_nastavitve', JSON.stringify(next))
    window.location.href = '/garaza'
  }

  if (loading) return (
    <div className="min-h-screen bg-[#080810] flex items-center justify-center">
      <p className="text-[#5a5a80]">{tx('Nalaganje...', 'Loading...')}</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#080810] px-4 py-8 flex items-center justify-center">
      <div className="w-full max-w-3xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white">
            Garage<span className="text-[#6c63ff]">Base</span>
          </h1>
          <p className="text-[#5a5a80] mt-3">
            {tx('Kako zelis uporabljati aplikacijo?', 'How do you want to use the app?')}
          </p>
          <p className="text-[#8080a0] text-sm mt-2">
            {tx('To lahko kadarkoli spremenis kasneje v nastavitvah.', 'You can change this later at any time in settings.')}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <button
            onClick={() => izberiNacin('lite')}
            className="text-left bg-[#0f0f1a] border border-[#3ecfcf66] hover:bg-[#3ecfcf11] rounded-2xl p-6 transition-all active:scale-[0.99]"
          >
            <div className="w-12 h-12 rounded-2xl bg-[#3ecfcf22] border border-[#3ecfcf66] flex items-center justify-center text-2xl mb-5">⚡</div>
            <h2 className="text-white text-2xl font-bold mb-2">{tx('Enostaven nacin', 'Simple mode')}</h2>
            <p className="text-[#5a5a80] mb-5">
              {tx('Za hiter vnos goriva, servisov, stroskov in osnovnih opomnikov.', 'For quick fuel, service, expense and basic reminder entries.')}
            </p>
            <div className="space-y-2 text-sm text-[#3ecfcf]">
              <p>{tx('Manj gumbov', 'Fewer buttons')}</p>
              <p>{tx('Hitrejsi prvi zaslon', 'Faster first screen')}</p>
              <p>{tx('Primeren za vsakdanjo uporabo', 'Good for everyday use')}</p>
            </div>
          </button>

          <button
            onClick={() => izberiNacin('full')}
            className="text-left bg-[#0f0f1a] border border-[#6c63ff66] hover:bg-[#6c63ff11] rounded-2xl p-6 transition-all active:scale-[0.99]"
          >
            <div className="w-12 h-12 rounded-2xl bg-[#6c63ff22] border border-[#6c63ff66] flex items-center justify-center text-2xl mb-5">📊</div>
            <h2 className="text-white text-2xl font-bold mb-2">{tx('Polni nacin', 'Full mode')}</h2>
            <p className="text-[#5a5a80] mb-5">
              {tx('Za vse funkcije, porocila, QR prenos, grafe in napredne nastavitve.', 'For all features, reports, QR transfer, charts and advanced settings.')}
            </p>
            <div className="space-y-2 text-sm text-[#a09aff]">
              <p>{tx('Vsi pregledi in zgodovine', 'All views and histories')}</p>
              <p>{tx('PDF report in QR prenos', 'PDF report and QR transfer')}</p>
              <p>{tx('Najvec nadzora', 'Most control')}</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
