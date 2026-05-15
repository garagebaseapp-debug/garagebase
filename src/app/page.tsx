'use client'

import { useEffect, useState } from 'react'
import { saveStoredLanguage, useLanguage, type Language } from '@/lib/i18n'

type Feature = {
  title: string
  text: string
  report?: boolean
}

type RoadmapItem = {
  title: string
  text: string
}

type LandingTheme = 'temna' | 'svetla'

type LandingCopy = {
  navFeatures: string
  navContact: string
  signIn: string
  start: string
  badge: string
  title: string
  subtitle: string
  viewFeatures: string
  stats: Array<{ value: string; label: string }>
  promoTitle: string
  promoText: string
  featuresKicker: string
  featuresTitle: string
  features: Feature[]
  roadmapKicker: string
  roadmapTitle: string
  roadmapText: string
  roadmap: RoadmapItem[]
  privacy: string
  terms: string
  promoLink: string
  alt: string
  copyright: string
  contact: string
}

const copy: Record<Language, LandingCopy> = {
  sl: {
    navFeatures: 'Funkcije',
    navContact: 'Kontakt',
    signIn: 'Prijava',
    start: 'Začni brezplačno',
    badge: 'Web + mobilna aplikacija',
    title: 'Tvoja garaža. Vse na enem mestu.',
    subtitle: 'Servisi, stroški, opomniki, gorivo in poročila za vsako vozilo. Urejeno za vsakdanjo uporabo in pripravljeno za prodajo vozila.',
    viewFeatures: 'Oglej si funkcije',
    stats: [
      { value: 'PWA', label: 'namestitev' },
      { value: 'PDF', label: 'report' },
      { value: 'QR', label: 'prenos' },
    ],
    promoTitle: 'Launch promocija',
    promoText: 'V obdobju testiranja so vse funkcije GarageBase odklenjene brez doplačila do 31. 12. 2026. Po tem datumu bodo napredne funkcije lahko del plačljivih paketov; uporabnike bomo o paketih in cenah obvestili vnaprej.',
    featuresKicker: 'Funkcije',
    featuresTitle: 'Narejeno za realno uporabo vozila',
    features: [
      { title: 'Gorivo', text: 'Poraba, tankanja in stroški po vozilih.' },
      { title: 'Servisi', text: 'Servisna knjiga z računi in kilometri.' },
      { title: 'Opomniki', text: 'Registracija, vinjeta, servis in zavarovanje.' },
      { title: 'Poročila', text: 'Pregleden PDF za prodajo vozila.', report: true },
      { title: 'Mobilna app', text: 'Namesti na telefon in uporabljaj kot aplikacijo.' },
      { title: 'Več vozil', text: 'Celotna domača garaža na enem mestu.' },
      { title: 'AI scan računov', text: 'Avtomatsko branje računov je v testiranju in planirano za 2027.' },
    ],
    roadmapKicker: 'V načrtu za 2027',
    roadmapTitle: 'Naslednji korak: manj ročnega dela, več zaupanja',
    roadmapText: 'Po javnem zagonu bomo funkcije dodajali postopno in testirano, da app ostane hiter, stabilen in uporaben tudi pri več uporabnikih.',
    roadmap: [
      { title: 'AI scan računov', text: 'Branje računov za gorivo, servise in stroške, z obveznim pregledom pred shranjevanjem.' },
      { title: 'Backup/export JSON', text: 'Uporabnik si lahko shrani svojo evidenco v berljivi datoteki za mir, zaupanje in GDPR zahteve.' },
      { title: 'Primerjava vozil', text: 'Poraba, €/km, servisi in stroški dveh vozil prikazani drug ob drugem.' },
      { title: 'Boljši grafi', text: 'Trend stroškov po mesecih, jasne osi in pregled, kje vozilo dejansko porablja denar.' },
      { title: 'Več jezikov', text: 'Poleg slovenščine in angleščine postopno še jeziki za širšo uporabo v EU.' },
      { title: 'Pametni opomniki', text: 'Boljši predlogi za servis, registracijo, gume in ponavljajoče stroške.' },
    ],
    privacy: 'Zasebnost',
    terms: 'Pogoji uporabe',
    promoLink: 'Launch promocija',
    alt: 'GarageBase aplikacija na računalniku, tablici in telefonu',
    copyright: 'GarageBase © 2026',
    contact: 'garagebase.app@gmail.com · getgaragebase.com',
  },
  en: {
    navFeatures: 'Features',
    navContact: 'Contact',
    signIn: 'Sign in',
    start: 'Start for free',
    badge: 'Web + mobile app',
    title: 'Your garage. Everything in one place.',
    subtitle: 'Services, costs, reminders, fuel and reports for every vehicle. Organized for everyday use and ready when selling a vehicle.',
    viewFeatures: 'View features',
    stats: [
      { value: 'PWA', label: 'install' },
      { value: 'PDF', label: 'report' },
      { value: 'QR', label: 'transfer' },
    ],
    promoTitle: 'Launch promotion',
    promoText: 'During the testing period all GarageBase features are unlocked at no extra charge until 31 Dec 2026. After that date, advanced features may become part of paid plans; users will be notified about plans and prices in advance.',
    featuresKicker: 'Features',
    featuresTitle: 'Built for real vehicle use',
    features: [
      { title: 'Fuel', text: 'Consumption, fill-ups and costs by vehicle.' },
      { title: 'Services', text: 'Service book with receipts and mileage.' },
      { title: 'Reminders', text: 'Registration, vignette, service and insurance.' },
      { title: 'Reports', text: 'Clear PDF for selling a vehicle.', report: true },
      { title: 'Mobile app', text: 'Install it on your phone and use it like an app.' },
      { title: 'Multiple vehicles', text: 'Your whole home garage in one place.' },
      { title: 'AI receipt scan', text: 'Automatic receipt reading is being tested and is planned for 2027.' },
    ],
    roadmapKicker: 'Planned for 2027',
    roadmapTitle: 'Next step: less manual work, more trust',
    roadmapText: 'After the public launch, new features will be added gradually and tested carefully so the app stays fast, stable and useful with more users.',
    roadmap: [
      { title: 'AI receipt scan', text: 'Receipt reading for fuel, services and expenses, with user review before anything is saved.' },
      { title: 'JSON backup/export', text: 'Users can save their own records in a readable file for trust, portability and GDPR requests.' },
      { title: 'Vehicle comparison', text: 'Consumption, cost per distance, services and expenses for two vehicles side by side.' },
      { title: 'Better charts', text: 'Monthly cost trends, clear axes and a better view of where a vehicle really spends money.' },
      { title: 'More languages', text: 'After Slovenian and English, more languages for broader EU use.' },
      { title: 'Smarter reminders', text: 'Better suggestions for service, registration, tires and recurring expenses.' },
    ],
    privacy: 'Privacy',
    terms: 'Terms',
    promoLink: 'Launch promotion',
    alt: 'GarageBase app on laptop, tablet and phone',
    copyright: 'GarageBase © 2026',
    contact: 'garagebase.app@gmail.com · getgaragebase.com',
  },
}

const qrCells = [
  '111011101011',
  '101010001001',
  '111010111101',
  '000011000100',
  '101110101111',
  '100010001001',
  '111011101101',
  '001000100000',
  '111101011101',
  '100001000101',
  '101111101111',
  '000100010001',
]

const appLabels = {
  sl: {
    fuel: 'Gorivo',
    service: 'Servis',
    reminders: 'Opomniki',
    costs: 'Stroski',
    settings: 'Nastavitve',
    report: 'Report',
    km: 'km',
    active: 'Aktivno',
  },
  en: {
    fuel: 'Fuel',
    service: 'Service',
    reminders: 'Reminders',
    costs: 'Costs',
    settings: 'Settings',
    report: 'Report',
    km: 'mi',
    active: 'Active',
  },
}

const MiniIcon = ({ kind }: { kind: string }) => {
  const common = 'h-7 w-7'
  if (kind === 'fuel') {
    return (
      <svg className={common} viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <path d="M9 4h10a2 2 0 0 1 2 2v21H7V6a2 2 0 0 1 2-2Z" fill="#ff4f6d" />
        <path d="M10 7h8v6h-8V7Z" fill="#f6fbff" />
        <path d="M21 9h3l3 4v11a2 2 0 0 1-4 0v-6a2 2 0 0 0-2-2" stroke="#ffcf33" strokeWidth="2" strokeLinecap="round" />
        <path d="M6 27h16" stroke="#f6fbff" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }
  if (kind === 'service') {
    return (
      <svg className={common} viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <path d="m21 5 6 6-4 4-3-3-9 14-5-5 14-9-3-3 4-4Z" fill="#f2efff" />
        <path d="m7 22 3 3" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }
  if (kind === 'reminders') {
    return (
      <svg className={common} viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <path d="M16 5c-4 0-7 3-7 8v4l-3 5h20l-3-5v-4c0-5-3-8-7-8Z" fill="#ffd056" />
        <path d="M13 24a3 3 0 0 0 6 0" stroke="#ff7a1a" strokeWidth="2" strokeLinecap="round" />
        <path d="M16 3v3" stroke="#fff3b0" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }
  if (kind === 'costs') {
    return (
      <svg className={common} viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <rect x="7" y="7" width="18" height="20" rx="3" fill="#eef2ff" />
        <path d="M11 12h10M11 17h10M11 22h5" stroke="#3ecfcf" strokeWidth="2" strokeLinecap="round" />
        <path d="M9 5h4v4H9V5Zm10 0h4v4h-4V5Z" fill="#ff4f6d" />
      </svg>
    )
  }
  if (kind === 'settings') {
    return (
      <svg className={common} viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <path d="M16 10a6 6 0 1 0 0 12 6 6 0 0 0 0-12Zm0-6 2 4 5-1 2 4-3 4 3 4-2 4-5-1-2 4-2-4-5 1-2-4 3-4-3-4 2-4 5 1 2-4Z" fill="#d8d4ff" />
        <circle cx="16" cy="16" r="3" fill="#6c63ff" />
      </svg>
    )
  }
  return (
    <svg className={common} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M9 4h10l5 5v19H9V4Z" fill="#f2efff" />
      <path d="M19 4v6h5" fill="#cbc4ff" />
      <path d="M12 15h9M12 19h9M12 23h6" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

const MenuTile = ({ kind, label, active = false }: { kind: string, label: string, active?: boolean }) => (
  <div className={`flex min-h-16 items-center justify-center gap-3 rounded-2xl border p-4 text-center ${
    active
      ? 'border-[#6c63ff88] bg-[#23194d] text-white shadow-[0_18px_36px_rgba(108,99,255,0.22)]'
      : 'border-[#d9ddf4] bg-white/72 text-[#27274a] shadow-[0_16px_34px_rgba(25,25,55,0.08)]'
  }`}>
    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${active ? 'bg-white/10' : 'bg-[#f3f0ff]'}`}>
      <MiniIcon kind={kind} />
    </span>
    <span className="text-sm font-black sm:text-base">{label}</span>
  </div>
)

const FeatureIconShowcase = ({ kind, label }: { kind: string, label: string }) => (
  <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border border-[#d8d4ff] bg-[radial-gradient(circle_at_45%_38%,rgba(139,92,246,0.22),rgba(255,255,255,0.92)_58%)] shadow-[0_18px_42px_rgba(108,99,255,0.18)]">
    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]" title={label}>
      <div className="[&_svg]:h-10 [&_svg]:w-10">
        <MiniIcon kind={kind} />
      </div>
    </div>
  </div>
)

const VehicleCardMini = ({ name, status, tone }: { name: string, status: string, tone: string }) => (
  <div className="relative min-h-28 overflow-hidden rounded-2xl border border-white/10 bg-[#11111f] p-3 shadow-[0_14px_32px_rgba(0,0,0,0.38)]">
    <div className={`absolute inset-0 bg-gradient-to-br ${tone} opacity-62`} />
    <div className="relative flex items-start justify-between gap-2">
      <div>
        <p className="text-xs font-black leading-tight text-white">{name}</p>
        <p className="mt-1 text-[10px] font-bold text-white/72">42.300 km</p>
      </div>
      <span className={`rounded-full px-2 py-1 text-[8px] font-black ${status === 'OK' ? 'bg-[#22c55e] text-[#06140b]' : 'bg-[#ef4444] text-white'}`}>
        {status}
      </span>
    </div>
    <div className="relative mt-6 h-12 rounded-xl bg-black/24">
      <div className="absolute bottom-3 left-5 h-3 w-16 rounded-full bg-black/45" />
      <div className="absolute bottom-5 left-7 h-5 w-24 rounded-[60%_40%_42%_58%] bg-white/24" />
      <div className="absolute bottom-3 left-10 h-4 w-4 rounded-full bg-[#07070d] ring-2 ring-white/16" />
      <div className="absolute bottom-3 left-24 h-4 w-4 rounded-full bg-[#07070d] ring-2 ring-white/16" />
    </div>
  </div>
)

const DeviceShowcase = () => (
  <div className="relative mt-5 h-56 overflow-hidden rounded-2xl border border-[#cfd7f3] bg-[#eef3ff] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.86)]">
    <img
      src="/landing-mobile-app.png"
      alt=""
      className="h-full w-full rounded-xl object-contain object-center"
    />
  </div>
)

const VehicleTabletShowcase = () => (
  <div className="relative mt-5 h-56 overflow-hidden rounded-2xl border border-[#cfd7f3] bg-[#eef3ff] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.86)]">
    <img
      src="/landing-multi-vehicles.png"
      alt=""
      className="h-full w-full rounded-xl object-contain object-top"
    />
  </div>
)

const FeatureVisual = ({ kind, language }: { kind: string, language: Language }) => {
  const labels = appLabels[language]

  if (kind === 'report') {
    return (
      <div className="mt-5 rounded-2xl border border-[#d8ddf5] bg-[#f7f8ff] p-4">
        <div className="relative mx-auto w-[180px]">
          <div className="absolute inset-0 translate-x-4 -translate-y-3 rotate-3 rounded-md border border-white/10 bg-white/80 shadow-lg" />
          <div className="relative rotate-[-2deg] overflow-hidden rounded-md bg-white p-3 text-[#151527] shadow-[0_18px_38px_rgba(0,0,0,0.35)]">
            <div className="flex items-start justify-between border-b border-[#e7e8f6] pb-2">
              <div>
                <p className="text-xs font-black">Garage<span className="text-[#8b5cf6]">Base</span></p>
                <p className="mt-0.5 text-[7px] font-black uppercase tracking-[0.14em] text-[#6c63ff]">
                  {language === 'en' ? 'GarageBase report' : 'GarageBase porocilo'}
                </p>
              </div>
              <div className="h-7 w-10 rounded bg-[#eef2ff]" />
            </div>
            <p className="mt-2 text-[9px] font-black">Volvo XC90</p>
            <p className="text-[7px] text-[#7a8096]">2018 - Diesel - 178.900 km</p>
            <div className="mt-2 grid grid-cols-3 gap-1">
              {['8', '96', '12'].map((value, index) => (
                <div key={index} className="rounded bg-[#f5f6ff] p-1 text-center text-[9px] font-black">{value}</div>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-[#8b5cf633] bg-[#f8f7ff] p-2">
              <div className="grid h-10 w-10 shrink-0 grid-cols-12 gap-[1px] rounded border border-[#3ecfcf] bg-white p-1">
                {qrCells.flatMap((row, rowIndex) =>
                  row.split('').map((cell, colIndex) => (
                    <span key={`${rowIndex}-${colIndex}`} className={cell === '1' ? 'bg-[#151527]' : 'bg-white'} />
                  )),
                )}
              </div>
              <p className="text-[7px] font-bold leading-tight text-[#34344a]">
                {language === 'en' ? 'QR opens the digital GarageBase record.' : 'QR odpre digitalni GarageBase zapis.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (kind === 'mobile') {
    return <DeviceShowcase />
  }

  if (kind === 'vehicles') {
    return <VehicleTabletShowcase />
  }

  if (kind === 'fuel' || kind === 'service' || kind === 'reminders') {
    return <FeatureIconShowcase kind={kind} label={kind === 'fuel' ? labels.fuel : kind === 'service' ? labels.service : labels.reminders} />
  }

  return (
    <div className="mt-4 rounded-2xl bg-white/70 p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <MenuTile kind="costs" label={labels.costs} />
        <MenuTile kind="settings" label={labels.settings} />
        <MenuTile kind="report" label={labels.report} active />
        <div className="flex min-h-16 items-center justify-center gap-3 rounded-2xl border border-[#2b2458] bg-[#25185a] p-4 text-sm font-black text-white shadow-[0_18px_36px_rgba(37,24,90,0.22)]">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/20 text-xl">⌗</span>
          AI OCR
        </div>
      </div>
    </div>
  )
}

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false)
  const [theme, setTheme] = useState<LandingTheme>('temna')
  const { language } = useLanguage()
  const t = copy[language]
  const isLightTheme = theme === 'svetla'
  const heroImage = isLightTheme ? '/landing-hero-light-garage.png' : '/landing-hero-dark-garage.png'

  const updateTheme = (nextTheme: LandingTheme) => {
    setTheme(nextTheme)
    try {
      const raw = localStorage.getItem('garagebase_nastavitve')
      const current = raw ? JSON.parse(raw) : {}
      localStorage.setItem('garagebase_nastavitve', JSON.stringify({ ...current, tema: nextTheme }))
    } catch {}
    document.documentElement.classList.toggle('light-mode', nextTheme === 'svetla')
    window.dispatchEvent(new CustomEvent('garagebase-theme-change', { detail: nextTheme }))
  }

  useEffect(() => {
    const readTheme = () => {
      try {
        const raw = localStorage.getItem('garagebase_nastavitve')
        const current = raw ? JSON.parse(raw) : {}
        const storedTheme: LandingTheme = current.tema === 'svetla' ? 'svetla' : 'temna'
        setTheme(storedTheme)
        document.documentElement.classList.toggle('light-mode', storedTheme === 'svetla')
      } catch {
        setTheme(document.documentElement.classList.contains('light-mode') ? 'svetla' : 'temna')
      }
    }
    readTheme()
    const onThemeChange = () => readTheme()
    window.addEventListener('storage', onThemeChange)
    window.addEventListener('garagebase-theme-change', onThemeChange)
    return () => {
      window.removeEventListener('storage', onThemeChange)
      window.removeEventListener('garagebase-theme-change', onThemeChange)
    }
  }, [])

  useEffect(() => {
    document.body.classList.add('landing')
    const previousFontSize = document.documentElement.style.fontSize
    const previousScale = document.documentElement.style.getPropertyValue('--gb-app-font-scale')
    document.documentElement.style.fontSize = '16px'
    document.documentElement.style.setProperty('--gb-app-font-scale', '1')
    const handleScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', handleScroll)
    return () => {
      document.body.classList.remove('landing')
      document.documentElement.style.fontSize = previousFontSize
      if (previousScale) document.documentElement.style.setProperty('--gb-app-font-scale', previousScale)
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#07070d] text-white">
      <nav
        className={`fixed left-0 right-0 top-0 z-50 transition-all duration-300 ${
          scrolled ? 'border-b border-white/10 bg-[#07070d]/92 backdrop-blur-md' : 'bg-transparent'
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
          <a href="/" className="gb-landing-brand text-2xl font-black tracking-tight">
            Garage<span className="text-[#8b5cf6]">Base</span>
          </a>
          <div className="hidden items-center gap-8 text-sm font-semibold text-white/74 md:flex">
            <a href="#funkcije" className="transition-colors hover:text-white">{t.navFeatures}</a>
            <a href="#kontakt" className="transition-colors hover:text-white">{t.navContact}</a>
          </div>
          <div className="flex items-center gap-3">
            <div className="landing-lang hidden items-center rounded-xl border border-white/18 bg-black/18 p-1 backdrop-blur-sm sm:flex" data-gb-no-translate>
              {[
                { code: 'sl' as Language, label: 'SI SL' },
                { code: 'en' as Language, label: 'GB EN' },
              ].map((item) => (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => saveStoredLanguage(item.code)}
                  className={`rounded-lg px-3 py-2 text-xs font-black transition-all ${
                    language === item.code ? 'bg-white text-[#141426]' : 'text-white/72 hover:text-white'
                  }`}
                  aria-label={`Language ${item.code.toUpperCase()}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="landing-theme hidden items-center rounded-xl border border-white/18 bg-black/18 p-1 backdrop-blur-sm sm:flex" data-gb-no-translate>
              {[
                { code: 'temna' as LandingTheme, label: '☾', aria: language === 'en' ? 'Dark mode' : 'Temni način' },
                { code: 'svetla' as LandingTheme, label: '☀', aria: language === 'en' ? 'Light mode' : 'Svetli način' },
              ].map((item) => (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => updateTheme(item.code)}
                  className={`rounded-lg px-3 py-2 text-xs font-black transition-all ${
                    theme === item.code ? 'bg-white text-[#141426]' : 'text-white/72 hover:text-white'
                  }`}
                  aria-label={item.aria}
                  title={item.aria}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <a href="/login" className="landing-login hidden rounded-xl border border-white/18 bg-black/20 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10 sm:inline-flex">
              {t.signIn}
            </a>
            <a href="/login" className="gb-landing-primary rounded-xl bg-[#8b5cf6] px-5 py-3 text-sm font-bold text-white shadow-[0_0_28px_rgba(139,92,246,0.45)] transition-all hover:bg-[#7c3aed]">
              {t.start}
            </a>
          </div>
        </div>
      </nav>

      <section className="landing-hero relative min-h-[92svh] overflow-hidden bg-[#07070d]">
        <img
          src={heroImage}
          alt={t.alt}
          className="landing-hero-image absolute inset-0 h-full w-full object-cover object-[66%_62%] lg:object-[center_66%]"
        />
        <div className="landing-hero-shade absolute inset-0 bg-[linear-gradient(90deg,rgba(7,7,13,0.86)_0%,rgba(7,7,13,0.70)_32%,rgba(7,7,13,0.28)_52%,rgba(7,7,13,0.04)_76%,rgba(7,7,13,0)_100%)]" />
        <div className="landing-top-fade absolute inset-x-0 top-0 h-32" />
        <div className="landing-bottom-fade absolute inset-x-0 bottom-0 h-44" />

        <div className="relative z-10 mx-auto flex min-h-[92svh] max-w-7xl items-center px-5 pb-14 pt-24 sm:px-8 lg:pb-16 lg:pt-28">
          <div className="landing-copy w-full max-w-[560px]">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/16 bg-black/24 px-4 py-2 backdrop-blur-sm">
              <span className="h-2 w-2 rounded-full bg-[#3ecfcf] shadow-[0_0_16px_rgba(62,207,207,0.85)]" />
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#ddd8ff]">{t.badge}</span>
            </div>

            <h1 className="mb-7 max-w-[540px] text-5xl font-black leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
              {t.title}
            </h1>
            <p className="mb-9 max-w-[520px] text-lg leading-relaxed text-white/76 sm:text-xl">
              {t.subtitle}
            </p>

            <div className="mb-9 flex flex-col gap-4 sm:flex-row">
              <a href="/login" className="gb-landing-primary rounded-xl bg-[#8b5cf6] px-8 py-4 text-center text-lg font-bold text-white shadow-[0_0_36px_rgba(139,92,246,0.48)] transition-all hover:bg-[#7c3aed]">
                {t.start}
              </a>
              <a href="#funkcije" className="rounded-xl border border-white/18 bg-black/24 px-8 py-4 text-center text-lg font-bold text-white backdrop-blur-sm transition-all hover:bg-white/10">
                {t.viewFeatures}
              </a>
            </div>

            <div className="grid max-w-lg grid-cols-3 gap-3">
              {t.stats.map((item, index) => (
                <div key={item.value} className="rounded-xl border border-white/12 bg-black/26 p-4 backdrop-blur-sm">
                  <p className={`text-2xl font-black ${index === 1 ? 'text-[#3ecfcf]' : index === 2 ? 'text-[#a78bfa]' : ''}`}>
                    {item.value}
                  </p>
                  <p className="mt-1 text-xs text-white/58">{item.label}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 max-w-lg rounded-xl border border-[#3ecfcf55] bg-[#3ecfcf12] p-4 backdrop-blur-sm">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#3ecfcf]">{t.promoTitle}</p>
              <p className="mt-2 text-sm leading-relaxed text-white/86">{t.promoText}</p>
            </div>
          </div>
        </div>
      </section>

      <section id="funkcije" className="bg-[#f4f6ff] px-5 py-24 text-[#09091b]">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12">
            <p className="mb-3 text-sm font-bold uppercase tracking-[0.18em] text-[#8b5cf6]">{t.featuresKicker}</p>
            <h2 className="text-3xl font-black md:text-5xl">{t.featuresTitle}</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {t.features.map((feature, index) => {
              const kind = feature.report ? 'report' : index === 0 ? 'fuel' : index === 1 ? 'service' : index === 2 ? 'reminders' : index === 4 ? 'mobile' : index === 5 ? 'vehicles' : 'scan'
              const isIconCard = kind === 'fuel' || kind === 'service' || kind === 'reminders'
              const isScanCard = kind === 'scan'

              return (
                <div
                  key={feature.title}
                  className={`rounded-[22px] border p-6 shadow-[0_18px_46px_rgba(22,22,55,0.08)] transition-colors hover:border-[#8b5cf666] ${
                    isScanCard
                      ? 'border-[#e3e7f8] bg-[linear-gradient(105deg,rgba(255,255,255,0.94),rgba(248,247,255,0.86))] lg:col-span-3'
                      : 'border-[#d8ddf5] bg-white/82'
                  }`}
                >
                  {isIconCard ? (
                    <div className="flex min-h-28 items-center gap-5">
                      <FeatureVisual kind={kind} language={language} />
                      <div className="min-w-0 flex-1">
                        <p className="mb-2 text-xl font-black text-[#09091b]">{feature.title}</p>
                        <p className="text-base leading-relaxed text-[#38385f]">{feature.text}</p>
                      </div>
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#d8d4ff] bg-[#f6f3ff] text-xl font-black text-[#6c63ff]">›</span>
                    </div>
                  ) : (
                    <>
                      <div className={isScanCard ? 'grid gap-4 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.65fr)] lg:items-center' : ''}>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-xl font-black text-[#09091b]">{feature.title}</p>
                            {isScanCard && (
                              <span className="rounded-full bg-[#8b5cf622] px-3 py-1 text-xs font-black uppercase text-[#6c63ff]">Novo</span>
                            )}
                          </div>
                          <p className="mt-3 text-base leading-relaxed text-[#38385f]">{feature.text}</p>
                        </div>
                        <FeatureVisual kind={kind} language={language} />
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>

          <div className="mt-16 rounded-[24px] border border-[#d8ddf5] bg-white/82 p-6 shadow-[0_18px_46px_rgba(22,22,55,0.08)] sm:p-8">
            <div className="max-w-3xl">
              <p className="mb-3 text-sm font-bold uppercase tracking-[0.18em] text-[#3ecfcf]">{t.roadmapKicker}</p>
              <h2 className="text-3xl font-black text-[#09091b] md:text-4xl">{t.roadmapTitle}</h2>
              <p className="mt-4 text-base leading-relaxed text-[#38385f]">{t.roadmapText}</p>
            </div>
            <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {t.roadmap.map((item) => (
                <div key={item.title} className="rounded-2xl border border-[#e1e5f6] bg-white/72 p-5 shadow-[0_12px_28px_rgba(22,22,55,0.06)]">
                  <p className="flex items-center gap-2 text-base font-black text-[#09091b]">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full border border-[#8b5cf666] text-sm text-[#6c63ff]">✓</span>
                    {item.title}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-[#555579]">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="border-t border-[#1e1e32] bg-[#080810] px-5 py-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[#8a8aa8]">
          <a href="/privacy" className="transition-colors hover:text-white">{t.privacy}</a>
          <a href="/terms" className="transition-colors hover:text-white">{t.terms}</a>
          <a href="/promo" className="transition-colors hover:text-white">{t.promoLink}</a>
        </div>
      </div>

      <footer id="kontakt" className="border-t border-[#1e1e32] px-5 py-12">
        <div className="mx-auto flex max-w-6xl flex-col justify-between gap-4 text-sm text-[#8a8aa8] md:flex-row">
          <p><span className="font-bold text-white">Garage</span><span className="font-bold text-[#8b5cf6]">Base</span> © 2026</p>
          <p>{t.contact}</p>
        </div>
      </footer>
    </div>
  )
}

