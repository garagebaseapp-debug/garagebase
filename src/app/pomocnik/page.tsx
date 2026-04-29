'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BackButton, BottomNav } from '@/lib/nav'
import { useLanguage } from '@/lib/i18n'

export default function PomocnikPage() {
  const { language } = useLanguage()
  const [firstCarId, setFirstCarId] = useState<string | null>(null)
  const [activeGuide, setActiveGuide] = useState('start')
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
    {
      id: 'start',
      icon: '🚗',
      title: tx('Dodaj prvo vozilo', 'Add first vehicle'),
      body: tx('Vnesi osnovne podatke, sliko in kilometre.', 'Enter basic data, photo and mileage.'),
      href: '/dodaj-avto',
      steps: [
        tx('Odpri Dodaj avto.', 'Open Add vehicle.'),
        tx('Vnesi znamko, model, letnik in trenutne kilometre.', 'Enter make, model, year and current mileage.'),
        tx('Dodaj sliko, ker bo vozilo potem lazje prepoznavno v garazi in reportu.', 'Add a photo so the vehicle is easier to recognize in the garage and report.'),
      ],
    },
    {
      id: 'fuel',
      icon: '⛽',
      title: tx('Vnesi tankanje', 'Add fill-up'),
      body: tx('Vnesi km, litre, ceno in po zelji sliko racuna.', 'Enter mileage, liters, price and optionally receipt photo.'),
      href: carLink('/vnos-goriva'),
      steps: [
        tx('Najprej izberi vozilo.', 'First choose the vehicle.'),
        tx('Kilometri ne smejo biti nizji od zadnjega vnosa.', 'Mileage cannot be lower than the last entry.'),
        tx('Ce dodas sliko racuna, klikni Preberi racun ali prilepi tekst racuna in klikni Uporabi tekst.', 'If you add a receipt photo, click Read receipt or paste receipt text and click Use text.'),
      ],
    },
    {
      id: 'receipt',
      icon: '📷',
      title: tx('Slikaj racun', 'Scan receipt'),
      body: tx('Slika se shrani pri vnosu in je kasneje vidna v zgodovini ter reportu.', 'The photo is saved with the entry and later visible in history and report.'),
      href: carLink('/vnos-goriva'),
      steps: [
        tx('Slikaj racun cim bolj naravnost in z dovolj svetlobe.', 'Take the receipt photo as straight as possible with enough light.'),
        tx('Ce avtomatsko branje ne deluje na napravi, uporabi rocni tekst spodaj.', 'If automatic reading does not work on the device, use the manual text field below.'),
        tx('Pred shranjevanjem vedno preveri znesek, litre in datum.', 'Always check amount, liters and date before saving.'),
      ],
    },
    {
      id: 'report',
      icon: '📄',
      title: tx('Pripravi report', 'Prepare report'),
      body: tx('Report lahko vsebuje QR za branje, uvoz zgodovine, sliko vozila in racune.', 'Report can include QR for reading, history import, vehicle photo and receipts.'),
      href: firstCarId ? `/report?car=${firstCarId}` : '/dodaj-avto',
      steps: [
        tx('Odpri vozilo in klikni Report.', 'Open a vehicle and click Report.'),
        tx('Obkljukaj Samo za branje, Izvoz zgodovine, Sliko vozila in Slike racunov po potrebi.', 'Select Read only, History export, Vehicle photo and Receipt photos as needed.'),
        tx('Jezik PDF reporta sledi jeziku aplikacije.', 'The PDF report language follows the app language.'),
      ],
    },
    {
      id: 'transfer',
      icon: '🔁',
      title: tx('Prenos zgodovine', 'History transfer'),
      body: tx('QR uvoz doda vozilo novemu lastniku in oznaci mejo stare zgodovine.', 'QR import adds the vehicle to the new owner and marks the old-history boundary.'),
      href: '/scan',
      steps: [
        tx('Prodajalec v reportu obkljuka Izvoz zgodovine.', 'The seller selects History export in the report.'),
        tx('Kupec skenira QR za uvoz in potrdi uvoz vozila.', 'The buyer scans the import QR and confirms vehicle import.'),
        tx('V reportu ostane vidno, kje se zacnejo vnosi novega lastnika.', 'The report keeps showing where the new owner entries begin.'),
      ],
    },
    {
      id: 'mode',
      icon: '⚙️',
      title: tx('Spremeni Lite/Full', 'Change Lite/Full'),
      body: tx('Nacin uporabe lahko vedno spremenis v nastavitvah.', 'You can always change usage mode in settings.'),
      href: '/nastavitve',
      steps: [
        tx('Lite je za hiter vsakdanji vnos.', 'Lite is for fast everyday entry.'),
        tx('Full prikaze vse zgodovine, grafe, report in napredne nastavitve.', 'Full shows all histories, charts, report and advanced settings.'),
        tx('Preklop ne izbrise podatkov.', 'Switching does not delete data.'),
      ],
    },
  ]
  const selectedGuide = guides.find((g) => g.id === activeGuide) || guides[0]

  return (
    <div className="min-h-screen bg-[#080810] px-4 py-6 pb-24">
      <div className="flex items-center gap-3 mb-6">
        <BackButton href="/nastavitve" />
        <div>
          <h1 className="text-xl font-bold text-white">🧭 {tx('Pomocnik', 'Assistant')}</h1>
          <p className="text-[#5a5a80] text-sm">{tx('Hitri vodic po GarageBase.', 'Quick GarageBase guide.')}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        {guides.map((g) => (
          <button key={g.id} onClick={() => setActiveGuide(g.id)}
            className={`rounded-2xl border p-4 text-left transition-all ${
              activeGuide === g.id
                ? 'bg-[#6c63ff22] border-[#6c63ff66]'
                : 'bg-[#0f0f1a] border-[#1e1e32] hover:border-[#6c63ff66]'
            }`}>
            <span className="block text-2xl mb-2">{g.icon}</span>
            <span className="block text-white font-bold text-sm">{g.title}</span>
            <span className="block text-[#5a5a80] text-xs mt-1">{g.body}</span>
          </button>
        ))}
      </div>

      <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5">
        <div className="flex items-start gap-4 mb-4">
          <span className="text-4xl">{selectedGuide.icon}</span>
          <div>
            <h2 className="text-white font-bold text-lg">{selectedGuide.title}</h2>
            <p className="text-[#5a5a80] text-sm mt-1">{selectedGuide.body}</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 mb-5">
          {selectedGuide.steps.map((step, index) => (
            <div key={step} className="flex gap-3 rounded-xl bg-[#13131f] p-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#6c63ff22] text-sm font-bold text-[#a09aff]">{index + 1}</span>
              <p className="text-[#d7d7ea] text-sm leading-relaxed">{step}</p>
            </div>
          ))}
        </div>

        <button onClick={() => window.location.href = selectedGuide.href}
          className="w-full rounded-xl bg-[#6c63ff] py-3 font-semibold text-white">
          {tx('Odpri', 'Open')}
        </button>
      </div>

      <BottomNav aktivna="nastavitve" />
    </div>
  )
}
