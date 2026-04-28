'use client'

import { useEffect, useState } from 'react'

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false)

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
    { ikona: '⛽', naziv: 'Gorivo', opis: 'Poraba, tankanja in stroški po vozilih.' },
    { ikona: '🔧', naziv: 'Servisi', opis: 'Servisna knjiga z računi in kilometri.' },
    { ikona: '🔔', naziv: 'Opomniki', opis: 'Registracija, vinjeta, servis in zavarovanje.' },
    { ikona: '📄', naziv: 'Poročila', opis: 'Pregleden PDF za prodajo vozila.' },
    { ikona: '📱', naziv: 'Mobilna app', opis: 'Namesti na telefon in uporabljaj kot aplikacijo.' },
    { ikona: '🚗', naziv: 'Več vozil', opis: 'Celotna domača garaža na enem mestu.' },
  ]

  return (
    <div className="min-h-screen bg-[#080810] text-white overflow-x-hidden">
      <section className="relative min-h-screen px-5 py-8 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(139,92,246,0.22),transparent_36%),#080810]" />

        <div className="relative max-w-6xl mx-auto min-h-[calc(100vh-64px)] rounded-[28px] border border-white/12 bg-[#101019]/92 overflow-hidden shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
          <img src="/landing-garagebase.jpg" alt="GarageBase aplikacija" className="absolute right-0 top-0 h-full w-full object-cover object-center opacity-100" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,#101019_0%,#101019_38%,rgba(16,16,25,0.78)_54%,rgba(16,16,25,0.12)_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(16,16,25,0.04),rgba(16,16,25,0.2)_70%,#101019_100%)]" />

          <nav className={`relative z-10 px-6 md:px-10 py-6 flex items-center justify-between transition-all duration-300 ${scrolled ? 'bg-[#101019]/80 backdrop-blur-md' : ''}`}>
            <a href="/" className="text-2xl font-black tracking-tight">Garage<span className="text-[#8b5cf6]">Base</span></a>
            <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-white/80">
              <a href="#funkcije" className="hover:text-white transition-colors">Funkcije</a>
              <a href="#paketi" className="hover:text-white transition-colors">Paketi</a>
              <a href="#kontakt" className="hover:text-white transition-colors">Kontakt</a>
            </div>
            <div className="flex gap-3">
              <a href="/login" className="hidden sm:inline-flex border border-white/15 bg-black/25 hover:bg-white/10 text-white text-sm font-semibold px-5 py-3 rounded-xl transition-colors">Prijava</a>
              <a href="/login" className="bg-[#8b5cf6] hover:bg-[#7c3aed] shadow-[0_0_28px_rgba(139,92,246,0.45)] text-white text-sm font-bold px-5 py-3 rounded-xl transition-all">Začni brezplačno</a>
            </div>
          </nav>

          <div className="relative z-10 px-6 md:px-10 pt-16 md:pt-28 pb-14 max-w-[610px]">
            <h1 className="text-5xl md:text-7xl font-black leading-[1.02] tracking-tight mb-7">
              Tvoja garaža. Vse na enem mestu.
            </h1>
            <p className="text-white/72 text-lg md:text-xl leading-relaxed max-w-xl mb-8">
              Evidenca servisov, stroškov, opomnikov in poročil za vsa tvoja vozila.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-10">
              <a href="/login" className="bg-[#8b5cf6] hover:bg-[#7c3aed] text-white font-bold px-8 py-4 rounded-xl transition-all text-lg text-center shadow-[0_0_36px_rgba(139,92,246,0.5)]">Začni brezplačno</a>
              <a href="#funkcije" className="bg-black/25 border border-white/15 hover:bg-white/10 text-white font-bold px-8 py-4 rounded-xl transition-all text-lg text-center backdrop-blur-md">Oglej si funkcije</a>
            </div>

            <div className="grid grid-cols-3 gap-3 max-w-lg">
              <div className="rounded-xl bg-black/28 border border-white/10 p-4 backdrop-blur-sm"><p className="text-2xl font-black">PWA</p><p className="text-white/55 text-xs mt-1">namestitev</p></div>
              <div className="rounded-xl bg-black/28 border border-white/10 p-4 backdrop-blur-sm"><p className="text-2xl font-black text-[#3ecfcf]">PDF</p><p className="text-white/55 text-xs mt-1">report</p></div>
              <div className="rounded-xl bg-black/28 border border-white/10 p-4 backdrop-blur-sm"><p className="text-2xl font-black text-[#a78bfa]">QR</p><p className="text-white/55 text-xs mt-1">prenos</p></div>
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
              <div key={f.naziv} className="bg-[#0f0f1a] border border-[#1e1e32] rounded-xl p-6 hover:border-[#8b5cf666] transition-colors">
                <div className="text-3xl mb-4">{f.ikona}</div>
                <h3 className="text-white font-bold text-lg mb-2">{f.naziv}</h3>
                <p className="text-[#8a8aa8] text-sm leading-relaxed">{f.opis}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="paketi" className="py-24 px-5 bg-[#0a0a14]">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-[0.8fr_1.2fr] gap-10 items-start">
          <div>
            <p className="text-[#8b5cf6] text-sm font-bold uppercase tracking-[0.18em] mb-3">Paketi</p>
            <h2 className="text-3xl md:text-5xl font-black mb-5">Začni brezplačno</h2>
            <p className="text-[#8a8aa8] text-lg leading-relaxed">Začni z osnovno evidenco in kasneje dodaj report, QR prenos zgodovine in napredne funkcije.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              ['Free', '0€', '1 vozilo'], ['Basic', '3€', '2 vozili'], ['Pro', '7€', '5 vozil']
            ].map(([naziv, cena, opis]) => (
              <div key={naziv} className="bg-[#0f0f1a] border border-[#1e1e32] rounded-xl p-6">
                <p className="text-[#8a8aa8] text-xs uppercase tracking-wider mb-2">{opis}</p>
                <h3 className="text-white font-bold text-2xl">{naziv}</h3>
                <p className="text-[#8b5cf6] text-4xl font-black my-4">{cena}</p>
                <a href="/login" className="block text-center bg-[#13131f] border border-[#2a2a40] hover:border-[#8b5cf666] rounded-xl py-3 font-bold">Izberi</a>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer id="kontakt" className="py-12 px-5 border-t border-[#1e1e32]">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between gap-4 text-sm text-[#8a8aa8]">
          <p><span className="text-white font-bold">Garage</span><span className="text-[#8b5cf6] font-bold">Base</span> © 2026</p>
          <p>garagebase.app@gmail.com · getgaragebase.com</p>
        </div>
      </footer>
    </div>
  )
}
