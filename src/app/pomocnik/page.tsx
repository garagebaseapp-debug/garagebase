'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BackButton, BottomNav } from '@/lib/nav'
import { useLanguage } from '@/lib/i18n'

export default function PomocnikPage() {
  const { language } = useLanguage()
  const [firstCarId, setFirstCarId] = useState<string | null>(null)
  const tx = (sl: string, en: string) => language === 'en' ? en : sl

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/'; return }
      const cached = localStorage.getItem('garagebase_garaza_cache')
      if (cached) {
        try {
          const parsed = JSON.parse(cached)
          if (parsed.avti?.[0]?.id) setFirstCarId(parsed.avti[0].id)
        } catch {}
      }
    }
    init()
  }, [])

  const carLink = (path: string) => firstCarId ? `${path}?car=${firstCarId}` : '/dodaj-avto'
  const guides = [
    { icon: '🚗', title: tx('Dodaj prvo vozilo', 'Add first vehicle'), body: tx('Vnesi osnovne podatke, sliko in kilometre.', 'Enter basic data, photo and mileage.'), href: '/dodaj-avto' },
    { icon: '⛽', title: tx('Vnesi tankanje', 'Add fill-up'), body: tx('Vnesi km, litre, ceno in po zelji sliko racuna.', 'Enter mileage, liters, price and optionally receipt photo.'), href: carLink('/vnos-goriva') },
    { icon: '📷', title: tx('Slikaj racun', 'Scan receipt'), body: tx('V osnovnem nacinu sliko prilozi vnosu, podatke pa dopolnis rocno.', 'In basic mode attach the photo to the entry and fill data manually.'), href: carLink('/vnos-goriva') },
    { icon: '📄', title: tx('Pripravi report', 'Prepare report'), body: tx('Report je v polnem nacinu pri vozilu.', 'Report is available in full mode on the vehicle.'), href: firstCarId ? `/report?car=${firstCarId}` : '/dodaj-avto' },
    { icon: '⚙️', title: tx('Spremeni Lite/Full', 'Change Lite/Full'), body: tx('Nacin uporabe lahko vedno spremenis v nastavitvah.', 'You can always change usage mode in settings.'), href: '/nastavitve' },
  ]

  return (
    <div className="min-h-screen bg-[#080810] px-4 py-6 pb-24">
      <div className="flex items-center gap-3 mb-6">
        <BackButton href="/nastavitve" />
        <div>
          <h1 className="text-xl font-bold text-white">🧭 {tx('Pomocnik', 'Assistant')}</h1>
          <p className="text-[#5a5a80] text-sm">{tx('Hitri vodic po GarageBase.', 'Quick GarageBase guide.')}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {guides.map((g) => (
          <button key={g.title} onClick={() => window.location.href = g.href}
            className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-4 text-left flex gap-4 items-center hover:border-[#6c63ff66] transition-all">
            <span className="text-3xl">{g.icon}</span>
            <span>
              <span className="block text-white font-bold">{g.title}</span>
              <span className="block text-[#5a5a80] text-sm mt-1">{g.body}</span>
            </span>
          </button>
        ))}
      </div>

      <BottomNav aktivna="nastavitve" />
    </div>
  )
}
