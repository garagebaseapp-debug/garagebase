'use client'

import { useEffect, useState } from 'react'
import { saveStoredLanguage, useLanguage, type Language } from '@/lib/i18n'

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false)
  const { language } = useLanguage()

  useEffect(() => {
    document.body.classList.add('landing')
    const handleScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', handleScroll)
    return () => {
      document.body.classList.remove('landing')
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  const funkcije = [
    { oznaka: 'Gorivo', opis: 'Poraba, tankanja in stroški po vozilih.' },
    { oznaka: 'Servisi', opis: 'Servisna knjiga z računi in kilometri.' },
    { oznaka: 'Opomniki', opis: 'Registracija, vinjeta, servis in zavarovanje.' },
    { oznaka: 'Poročila', opis: 'Pregleden PDF za prodajo vozila.' },
    { oznaka: 'Mobilna app', opis: 'Namesti na telefon in uporabljaj kot aplikacijo.' },
    { oznaka: 'Več vozil', opis: 'Celotna domača garaža na enem mestu.' },
    { oznaka: 'AI scan racunov', opis: 'Avtomatsko branje racunov je v testiranju in planirano za 2027.' },
  ]

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

  return (
    <div className="min-h-screen bg-[#07070d] text-white overflow-x-hidden">
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-[#07070d]/92 backdrop-blur-md border-b border-white/10' : 'bg-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-5 flex justify-between items-center">
          <a href="/" className="text-2xl font-black tracking-tight">Garage<span className="text-[#8b5cf6]">Base</span></a>
          <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-white/74">
            <a href="#funkcije" className="hover:text-white transition-colors">Funkcije</a>
            <a href="#kontakt" className="hover:text-white transition-colors">Kontakt</a>
          </div>
          <div className="flex items-center gap-3">
            <div className="landing-lang hidden sm:flex items-center rounded-xl border border-white/18 bg-black/18 p-1 backdrop-blur-sm" data-gb-no-translate>
              {[
                { code: 'sl', label: '🇸🇮 SL' },
                { code: 'en', label: '🇬🇧 EN' },
              ].map((item) => (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => saveStoredLanguage(item.code as Language)}
                  className={`px-3 py-2 rounded-lg text-xs font-black transition-all ${
                    language === item.code ? 'bg-white text-[#141426]' : 'text-white/72 hover:text-white'
                  }`}
                  aria-label={`Language ${item.code.toUpperCase()}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <a href="/login" className="landing-login hidden sm:inline-flex border border-white/18 bg-black/20 hover:bg-white/10 text-white text-sm font-semibold px-5 py-3 rounded-xl transition-colors">Prijava</a>
            <a href="/login" className="bg-[#8b5cf6] hover:bg-[#7c3aed] shadow-[0_0_28px_rgba(139,92,246,0.45)] text-white text-sm font-bold px-5 py-3 rounded-xl transition-all">Začni brezplačno</a>
          </div>
        </div>
      </nav>

      <section className="relative min-h-screen overflow-hidden bg-[#07070d]">
        <img
          src="/landing-garagebase.png"
          alt="GarageBase aplikacija na računalniku, tablici in telefonu"
          className="absolute inset-0 h-full w-full object-cover object-[64%_center] lg:object-center"
        />
        <div className="landing-hero-shade absolute inset-0 bg-[linear-gradient(90deg,rgba(7,7,13,0.86)_0%,rgba(7,7,13,0.70)_32%,rgba(7,7,13,0.28)_52%,rgba(7,7,13,0.04)_76%,rgba(7,7,13,0)_100%)]" />
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#07070d]/80 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-[#07070d] via-[#07070d]/38 to-transparent" />

        <div className="landing-report-mockup absolute z-10 hidden xl:block">
          <div className="landing-report-paper relative w-[285px] overflow-hidden rounded-[12px] border border-white/35 bg-white/94 p-4 text-[#151527] shadow-[0_30px_55px_rgba(0,0,0,0.38)]">
            <div className="landing-report-curl" />
            <div className="flex items-start justify-between gap-3 border-b border-[#e7e8f6] pb-2.5">
              <div>
                <p className="text-base font-black">Garage<span className="text-[#8b5cf6]">Base</span></p>
                <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.16em] text-[#6c63ff]">Verified report</p>
              </div>
              <div className="h-9 w-12 rounded-lg bg-gradient-to-br from-[#dbeafe] to-[#eef2ff] border border-[#d8dcf0]" />
            </div>

            <div className="mt-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-[8px] font-bold uppercase text-[#7a8096]">Vozilo</p>
                <p className="text-sm font-black leading-tight">Volvo XC90</p>
                <p className="mt-1 text-[8px] text-[#7a8096]">2018 - Diesel - 178.900 km</p>
              </div>
              <div className="rounded-md border border-[#dfe3f4] px-2 py-1 text-center">
                <p className="text-[7px] text-[#7a8096]">LASTNIKI</p>
                <p className="text-xs font-black">2</p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-1.5">
              {[
                ['Servisi', '8'],
                ['Gorivo', '96'],
                ['Stroski', '12'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-[#f5f6ff] p-1.5">
                  <p className="text-[7px] font-bold uppercase text-[#7a8096]">{label}</p>
                  <p className="text-sm font-black">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-3 flex gap-2.5 rounded-xl border border-[#8b5cf6]/25 bg-[#f8f7ff] p-2.5">
              <div className="relative grid h-[58px] w-[58px] shrink-0 grid-cols-12 gap-[1px] rounded-md border-2 border-[#3ecfcf] bg-white p-1 shadow-[0_0_0_4px_rgba(62,207,207,0.12)]">
                {qrCells.flatMap((row, rowIndex) =>
                  row.split('').map((cell, colIndex) => (
                    <span
                      key={`${rowIndex}-${colIndex}`}
                      className={cell === '1' ? 'bg-[#151527]' : 'bg-white'}
                    />
                  )),
                )}
                <span className="absolute -top-3 left-2 rounded-full bg-[#071018] px-2 py-0.5 text-[7px] font-black uppercase tracking-[0.12em] text-[#3ecfcf] shadow-[0_0_18px_rgba(62,207,207,0.4)]">QR</span>
              </div>
              <div className="pt-1">
                <p className="text-[8px] font-black uppercase tracking-[0.12em] text-[#6c63ff]">Preverjanje</p>
                <p className="mt-1 text-[9px] font-semibold leading-snug text-[#34344a]">
                  Skeniraj QR in preveri, ali je PDF enak zapisu v bazi.
                </p>
              </div>
            </div>

            <div className="mt-3 space-y-1.5 opacity-70">
              {[82, 64, 74, 52].map((width, index) => (
                <div key={index} className="h-1.5 rounded-full bg-[#e7e8f6]" style={{ width: `${width}%` }} />
              ))}
            </div>
          </div>
        </div>

        <div className="relative z-10 min-h-screen max-w-7xl mx-auto px-5 sm:px-8 pt-32 pb-24 flex items-center">
          <div className="landing-copy w-full max-w-[560px] lg:mb-10">
            <div className="inline-flex items-center gap-2 bg-black/24 border border-white/16 rounded-full px-4 py-2 mb-7 backdrop-blur-sm">
              <span className="w-2 h-2 rounded-full bg-[#3ecfcf] shadow-[0_0_16px_rgba(62,207,207,0.85)]" />
              <span className="text-[#ddd8ff] text-xs font-bold uppercase tracking-[0.18em]">Web + mobilna aplikacija</span>
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black leading-[1.02] tracking-tight mb-7 max-w-[540px]">
              Tvoja garaža. Vse na enem mestu.
            </h1>
            <p className="text-white/76 text-lg sm:text-xl leading-relaxed max-w-[520px] mb-9">
              Servisi, stroški, opomniki, gorivo in poročila za vsako vozilo. Urejeno za vsakdanjo uporabo in pripravljeno za prodajo vozila.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-9">
              <a href="/login" className="bg-[#8b5cf6] hover:bg-[#7c3aed] text-white font-bold px-8 py-4 rounded-xl transition-all text-lg text-center shadow-[0_0_36px_rgba(139,92,246,0.48)]">Začni brezplačno</a>
              <a href="#funkcije" className="bg-black/24 border border-white/18 hover:bg-white/10 text-white font-bold px-8 py-4 rounded-xl transition-all text-lg text-center backdrop-blur-sm">Oglej si funkcije</a>
            </div>

            <div className="grid grid-cols-3 gap-3 max-w-lg">
              <div className="rounded-xl bg-black/26 border border-white/12 p-4 backdrop-blur-sm"><p className="text-2xl font-black">PWA</p><p className="text-white/58 text-xs mt-1">namestitev</p></div>
              <div className="rounded-xl bg-black/26 border border-white/12 p-4 backdrop-blur-sm"><p className="text-2xl font-black text-[#3ecfcf]">PDF</p><p className="text-white/58 text-xs mt-1">report</p></div>
              <div className="rounded-xl bg-black/26 border border-white/12 p-4 backdrop-blur-sm"><p className="text-2xl font-black text-[#a78bfa]">QR</p><p className="text-white/58 text-xs mt-1">prenos</p></div>
            </div>
            <div className="mt-4 max-w-lg rounded-xl border border-[#3ecfcf55] bg-[#3ecfcf12] p-4 backdrop-blur-sm">
              <p className="text-[#3ecfcf] text-xs font-black uppercase tracking-[0.16em]">Launch promocija</p>
              <p className="mt-2 text-white/86 text-sm leading-relaxed">
                V obdobju testiranja so vse funkcije GarageBase odklenjene brez doplacila do 31. 12. 2026. Po tem datumu bodo napredne funkcije lahko del placljivih paketov; uporabnike bomo o paketih in cenah obvestili vnaprej.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="funkcije" className="py-24 px-5 bg-[#080810]">
        <div className="max-w-6xl mx-auto">
          <div className="mb-12">
            <p className="text-[#8b5cf6] text-sm font-bold uppercase tracking-[0.18em] mb-3">Funkcije</p>
            <h2 className="text-3xl md:text-5xl font-black">Narejeno za realno uporabo vozila</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {funkcije.map((f) => (
              <div key={f.oznaka} className="bg-[#0f0f1a] border border-[#1e1e32] rounded-xl p-6 hover:border-[#8b5cf666] transition-colors">
                <p className="text-white font-bold text-lg mb-2">{f.oznaka}</p>
                <p className="text-[#8a8aa8] text-sm leading-relaxed">{f.opis}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="px-5 py-6 border-t border-[#1e1e32] bg-[#080810]">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[#8a8aa8]">
          <a href="/privacy" className="hover:text-white transition-colors">Zasebnost</a>
          <a href="/terms" className="hover:text-white transition-colors">Pogoji uporabe</a>
          <a href="/promo" className="hover:text-white transition-colors">Launch promocija</a>
        </div>
      </div>

      <footer id="kontakt" className="py-12 px-5 border-t border-[#1e1e32]">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between gap-4 text-sm text-[#8a8aa8]">
          <p><span className="text-white font-bold">Garage</span><span className="text-[#8b5cf6] font-bold">Base</span> © 2026</p>
          <p>garagebase.app@gmail.com · getgaragebase.com</p>
        </div>
      </footer>
    </div>
  )
}
