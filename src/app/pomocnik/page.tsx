'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BackButton, BottomNav } from '@/lib/nav'
import { useLanguage } from '@/lib/i18n'
import { trackEvent } from '@/lib/analytics'

type Guide = {
  id: string
  icon: string
  title: string
  body: string
  href: string
  keywords: string[]
  steps: string[]
}

export default function PomocnikPage() {
  const { language } = useLanguage()
  const [firstCarId, setFirstCarId] = useState<string | null>(null)
  const [activeGuide, setActiveGuide] = useState('start')
  const [question, setQuestion] = useState('')
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
    trackEvent('assistant_page_open')
  }, [])

  const carLink = (path: string) => firstCarId ? `${path}?car=${firstCarId}` : '/dodaj-avto'

  const guides: Guide[] = useMemo(() => [
    {
      id: 'start',
      icon: '🚗',
      title: tx('Dodaj prvo vozilo', 'Add first vehicle'),
      body: tx('Vnesi osnovne podatke, sliko in kilometre.', 'Enter basic data, photo and mileage.'),
      href: '/dodaj-avto',
      keywords: ['avto', 'vozilo', 'dodaj', 'car', 'vehicle', 'add'],
      steps: [
        tx('Odpri Dodaj avto.', 'Open Add vehicle.'),
        tx('Vnesi znamko, model, letnik in trenutne kilometre.', 'Enter make, model, year and current mileage.'),
        tx('Dodaj sliko, ker bo vozilo lazje prepoznavno v garazi in reportu.', 'Add a photo so the vehicle is easier to recognize in the garage and report.'),
      ],
    },
    {
      id: 'fuel',
      icon: '⛽',
      title: tx('Vnesi tankanje', 'Add fill-up'),
      body: tx('Vnesi km, litre, ceno in po zelji sliko racuna.', 'Enter mileage, liters, price and optionally receipt photo.'),
      href: carLink('/vnos-goriva'),
      keywords: ['gorivo', 'tankanje', 'bencin', 'dizel', 'fuel', 'fill', 'litri', 'liters'],
      steps: [
        tx('Najprej izberi vozilo.', 'First choose the vehicle.'),
        tx('Kilometri ne smejo biti nizji od zadnjega vnosa.', 'Mileage cannot be lower than the last entry.'),
        tx('Ce dodas sliko racuna, preveri znesek, litre in datum pred shranjevanjem.', 'If you add a receipt photo, check amount, liters and date before saving.'),
      ],
    },
    {
      id: 'service',
      icon: '🔧',
      title: tx('Vnesi servis', 'Add service'),
      body: tx('Shrani servis, racune in samodejno ustvari naslednji opomnik.', 'Save service, receipts and automatically create the next reminder.'),
      href: carLink('/vnos-servisa'),
      keywords: ['servis', 'olje', 'filter', 'mehanik', 'service', 'oil', 'repair'],
      steps: [
        tx('Izberi vozilo in vnesi datum ter kilometre.', 'Choose the vehicle and enter date and mileage.'),
        tx('Opis dela naj ostane tak, kot ga zelis kasneje videti v porocilu.', 'Keep the work description as you want it to appear in the report.'),
        tx('Ce ves naslednji interval, vnesi km ali dni in app ustvari opomnik.', 'If you know the next interval, enter km or days and the app creates a reminder.'),
      ],
    },
    {
      id: 'expense',
      icon: '💰',
      title: tx('Dodaj strosek', 'Add expense'),
      body: tx('Za zavarovanje, registracijo, gume in ostale stroske.', 'For insurance, registration, tires and other costs.'),
      href: carLink('/vnos-stroska'),
      keywords: ['strosek', 'zavarovanje', 'registracija', 'gume', 'expense', 'insurance', 'tires'],
      steps: [
        tx('Izberi vozilo in kategorijo stroska.', 'Choose the vehicle and expense category.'),
        tx('Dodaj znesek, datum in po potrebi sliko racuna.', 'Add amount, date and optionally a receipt photo.'),
        tx('Strosek se prikaze v rubriki Stroski in v PDF reportu.', 'The expense appears under Costs and in the PDF report.'),
      ],
    },
    {
      id: 'receipt',
      icon: '📷',
      title: tx('Slikaj racun', 'Scan receipt'),
      body: tx('Slika se shrani pri vnosu in je kasneje vidna v zgodovini ter reportu.', 'The photo is saved with the entry and later visible in history and report.'),
      href: carLink('/vnos-goriva'),
      keywords: ['racun', 'slika', 'scan', 'ocr', 'receipt', 'photo'],
      steps: [
        tx('Slikaj racun cim bolj naravnost in z dovolj svetlobe.', 'Take the receipt photo as straight as possible with enough light.'),
        tx('Ce avtomatsko branje ne deluje, uporabi rocni vnos.', 'If automatic reading does not work, use manual entry.'),
        tx('Pred shranjevanjem vedno preveri znesek, litre in datum.', 'Always check amount, liters and date before saving.'),
      ],
    },
    {
      id: 'report',
      icon: '📄',
      title: tx('Pripravi report', 'Prepare report'),
      body: tx('Report lahko vsebuje QR za branje, uvoz zgodovine, sliko vozila in racune.', 'Report can include QR for reading, history import, vehicle photo and receipts.'),
      href: firstCarId ? `/report?car=${firstCarId}` : '/dodaj-avto',
      keywords: ['report', 'pdf', 'porocilo', 'izvoz', 'prodaja', 'document'],
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
      keywords: ['qr', 'prenos', 'uvoz', 'zgodovina', 'scan', 'transfer', 'import'],
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
      keywords: ['lite', 'full', 'nacin', 'mode', 'nastavitve', 'settings'],
      steps: [
        tx('Lite je za hiter vsakdanji vnos.', 'Lite is for fast everyday entry.'),
        tx('Full prikaze vse zgodovine, grafe, report in napredne nastavitve.', 'Full shows all histories, charts, report and advanced settings.'),
        tx('Preklop ne izbrise podatkov.', 'Switching does not delete data.'),
      ],
    },
    {
      id: 'theme',
      icon: '🌓',
      title: tx('Temni ali svetli nacin', 'Dark or light mode'),
      body: tx('Preklopis videz appa in weba.', 'Switch app and web appearance.'),
      href: '/nastavitve',
      keywords: ['temno', 'svetlo', 'dark', 'light', 'barva', 'vidno'],
      steps: [
        tx('Odpri Nastavitve.', 'Open Settings.'),
        tx('Preklopi Temni/Svetli nacin.', 'Switch Dark/Light mode.'),
        tx('Nastavitev ostane shranjena za naslednji obisk.', 'The setting stays saved for the next visit.'),
      ],
    },
  ], [firstCarId, language])

  const selectedGuide = guides.find((g) => g.id === activeGuide) || guides[0]
  const questionValue = question.toLowerCase().trim()
  const suggestedGuides = questionValue
    ? guides.filter((guide) => {
        const haystack = `${guide.title} ${guide.body} ${guide.keywords.join(' ')}`.toLowerCase()
        return questionValue.split(/\s+/).some((word) => word.length > 2 && haystack.includes(word))
      }).slice(0, 3)
    : guides.slice(0, firstCarId ? 4 : 3)

  const selectGuide = (id: string) => {
    setActiveGuide(id)
    trackEvent('assistant_guide_selected', { guide: id })
  }

  return (
    <div className="min-h-screen bg-[#080810] px-4 py-6 pb-24">
      <div className="flex items-center gap-3 mb-6">
        <BackButton href="/nastavitve" />
        <div>
          <h1 className="text-xl font-bold text-white">🧭 {tx('Pomocnik', 'Assistant')}</h1>
          <p className="text-[#5a5a80] text-sm">{tx('Hitri vodic po GarageBase.', 'Quick GarageBase guide.')}</p>
        </div>
      </div>

      <div className="mb-4 rounded-3xl border border-[#1e1e32] bg-[#0f0f1a] p-5">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#6c63ff]">
          {tx('Kaj zelis narediti?', 'What do you want to do?')}
        </p>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={tx('Npr. rad bi izvozil PDF, skeniral racun, prenesel avto novemu lastniku...', 'E.g. I want to export a PDF, scan a receipt, transfer a car to a new owner...')}
          className="mt-3 min-h-24 w-full rounded-2xl border border-[#1e1e32] bg-[#13131f] px-4 py-3 text-sm text-white outline-none focus:border-[#6c63ff]"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {(suggestedGuides.length ? suggestedGuides : guides.slice(0, 3)).map((guide) => (
            <button key={guide.id} onClick={() => selectGuide(guide.id)}
              className="rounded-full border border-[#6c63ff44] bg-[#6c63ff11] px-4 py-2 text-xs font-bold text-[#a09aff]">
              {guide.icon} {guide.title}
            </button>
          ))}
        </div>
      </div>

      {!firstCarId && (
        <div className="mb-4 rounded-2xl border border-[#f59e0b66] bg-[#f59e0b18] p-4">
          <p className="font-bold text-[#f59e0b]">{tx('Najprej dodaj vozilo', 'Add a vehicle first')}</p>
          <p className="mt-1 text-sm text-[#fbbf24]">
            {tx('Nekatere funkcije potrebujejo izbrano vozilo. Ko dodas prvi avto, te bo pomocnik vodil direktno do pravih vnosov.', 'Some features need a selected vehicle. After adding the first car, the assistant will link directly to the right entries.')}
          </p>
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {guides.map((guide) => (
          <button key={guide.id} onClick={() => selectGuide(guide.id)}
            className={`rounded-2xl border p-4 text-left transition-all ${
              activeGuide === guide.id
                ? 'bg-[#6c63ff22] border-[#6c63ff66]'
                : 'bg-[#0f0f1a] border-[#1e1e32] hover:border-[#6c63ff66]'
            }`}>
            <span className="mb-2 block text-2xl">{guide.icon}</span>
            <span className="block text-sm font-bold text-white">{guide.title}</span>
            <span className="mt-1 block text-xs text-[#5a5a80]">{guide.body}</span>
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-[#1e1e32] bg-[#0f0f1a] p-5">
        <div className="mb-4 flex items-start gap-4">
          <span className="text-4xl">{selectedGuide.icon}</span>
          <div>
            <h2 className="text-lg font-bold text-white">{selectedGuide.title}</h2>
            <p className="mt-1 text-sm text-[#5a5a80]">{selectedGuide.body}</p>
          </div>
        </div>

        <div className="mb-5 flex flex-col gap-3">
          {selectedGuide.steps.map((step, index) => (
            <div key={step} className="flex gap-3 rounded-xl bg-[#13131f] p-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#6c63ff22] text-sm font-bold text-[#a09aff]">{index + 1}</span>
              <p className="text-sm leading-relaxed text-[#d7d7ea]">{step}</p>
            </div>
          ))}
        </div>

        <button onClick={() => {
            trackEvent('assistant_action_opened', { guide: selectedGuide.id, href: selectedGuide.href })
            window.location.href = selectedGuide.href
          }}
          className="w-full rounded-xl bg-[#6c63ff] py-3 font-semibold text-white">
          {tx('Odpri', 'Open')}
        </button>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {[
          { title: tx('Podatki se ne izgubijo', 'Data is not lost'), text: tx('Vnosi se shranjujejo v Supabase in ostanejo povezani s tvojim racunom.', 'Entries are saved in Supabase and stay connected to your account.') },
          { title: tx('PDF sledi jeziku', 'PDF follows language'), text: tx('Ce imas app v anglescini, bo tudi porocilo v anglescini.', 'If the app is in English, the report is also in English.') },
          { title: tx('Predlogi so dobrodosli', 'Suggestions are welcome'), text: tx('Ce pomocnik ne odgovori dovolj dobro, poslji predlog in ga vidimo v adminu.', 'If the assistant does not answer well enough, send feedback and we see it in admin.') },
        ].map((tip) => (
          <div key={tip.title} className="rounded-2xl border border-[#1e1e32] bg-[#0f0f1a] p-4">
            <p className="font-bold text-white">{tip.title}</p>
            <p className="mt-1 text-sm text-[#5a5a80]">{tip.text}</p>
          </div>
        ))}
      </div>

      <BottomNav aktivna="nastavitve" />
    </div>
  )
}
