'use client'

import { useEffect, useState } from 'react'
import { saveStoredLanguage, useLanguage, type Language } from '@/lib/i18n'

type Feature = {
  title: string
  text: string
  report?: boolean
}

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

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false)
  const { language } = useLanguage()
  const t = copy[language]

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
          <a href="/" className="text-2xl font-black tracking-tight">
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
            <a href="/login" className="landing-login hidden rounded-xl border border-white/18 bg-black/20 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10 sm:inline-flex">
              {t.signIn}
            </a>
            <a href="/login" className="rounded-xl bg-[#8b5cf6] px-5 py-3 text-sm font-bold text-white shadow-[0_0_28px_rgba(139,92,246,0.45)] transition-all hover:bg-[#7c3aed]">
              {t.start}
            </a>
          </div>
        </div>
      </nav>

      <section className="relative min-h-screen overflow-hidden bg-[#07070d]">
        <img
          src="/landing-garagebase.png"
          alt={t.alt}
          className="absolute inset-0 h-full w-full object-cover object-[66%_62%] lg:object-[center_64%]"
        />
        <div className="landing-hero-shade absolute inset-0 bg-[linear-gradient(90deg,rgba(7,7,13,0.86)_0%,rgba(7,7,13,0.70)_32%,rgba(7,7,13,0.28)_52%,rgba(7,7,13,0.04)_76%,rgba(7,7,13,0)_100%)]" />
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#07070d]/80 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-[#07070d] via-[#07070d]/38 to-transparent" />

        <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl items-center px-5 pb-24 pt-32 sm:px-8">
          <div className="landing-copy w-full max-w-[560px] lg:mb-10">
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
              <a href="/login" className="rounded-xl bg-[#8b5cf6] px-8 py-4 text-center text-lg font-bold text-white shadow-[0_0_36px_rgba(139,92,246,0.48)] transition-all hover:bg-[#7c3aed]">
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

      <section id="funkcije" className="bg-[#080810] px-5 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12">
            <p className="mb-3 text-sm font-bold uppercase tracking-[0.18em] text-[#8b5cf6]">{t.featuresKicker}</p>
            <h2 className="text-3xl font-black md:text-5xl">{t.featuresTitle}</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {t.features.map((feature) => (
              <div key={feature.title} className="rounded-xl border border-[#1e1e32] bg-[#0f0f1a] p-6 transition-colors hover:border-[#8b5cf666]">
                <p className="mb-2 text-lg font-bold text-white">{feature.title}</p>
                <p className="text-sm leading-relaxed text-[#8a8aa8]">{feature.text}</p>
                {feature.report && (
                  <div className="mt-5 rounded-xl border border-[#6c63ff33] bg-[#080810] p-4">
                    <div className="relative mx-auto w-[180px]">
                      <div className="absolute inset-0 translate-x-4 -translate-y-3 rotate-3 rounded-md border border-white/10 bg-white/80 shadow-lg" />
                      <div className="relative rotate-[-2deg] overflow-hidden rounded-md bg-white p-3 text-[#151527] shadow-[0_18px_38px_rgba(0,0,0,0.35)]">
                        <div className="flex items-start justify-between border-b border-[#e7e8f6] pb-2">
                          <div>
                            <p className="text-xs font-black">Garage<span className="text-[#8b5cf6]">Base</span></p>
                            <p className="mt-0.5 text-[7px] font-black uppercase tracking-[0.14em] text-[#6c63ff]">Verified report</p>
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
                            {language === 'en' ? 'QR checks whether the PDF matches the database record.' : 'QR preveri, ali je PDF enak zapisu v bazi.'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
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

