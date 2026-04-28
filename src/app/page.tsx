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
    { ikona: '⛽', naziv: 'Gorivo', opis: 'Tankanja, poraba, strošek na kilometer in pregled po vozilih.' },
    { ikona: '🔧', naziv: 'Servisi', opis: 'Digitalna servisna knjiga, računi, kilometri in zgodovina popravil.' },
    { ikona: '🔔', naziv: 'Opomniki', opis: 'Registracija, vinjeta, servis, zavarovanje in km opomniki.' },
    { ikona: '📄', naziv: 'Poročila', opis: 'Izvoz zgodovine vozila za prodajo ali lastno evidenco.' },
    { ikona: '📱', naziv: 'Aplikacija', opis: 'Deluje v brskalniku in kot nameščena aplikacija na telefonu.' },
    { ikona: '🚗', naziv: 'Več vozil', opis: 'Avto, motor, kombi, plovilo ali celotna domača garaža.' },
  ]

  return (
    <div className="min-h-screen bg-[#080810] text-white overflow-x-hidden">
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-[#080810]/95 backdrop-blur-md border-b border-white/10' : 'bg-transparent'
      }`}>
        <div className="max-w-6xl mx-auto px-5 py-5 flex justify-between items-center">
          <a href="/" className="text-2xl font-black tracking-tight">Garage<span className="text-[#8b5cf6]">Base</span></a>
          <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-white/70">
            <a href="#funkcije" className="hover:text-white transition-colors">Funkcije</a>
            <a href="#paketi" className="hover:text-white transition-colors">Paketi</a>
            <a href="#kontakt" className="hover:text-white transition-colors">Kontakt</a>
          </div>
          <div className="flex gap-3">
            <a href="/login" className="hidden sm:inline-flex border border-white/15 bg-black/20 hover:bg-white/10 text-white text-sm font-semibold px-5 py-3 rounded-xl transition-colors">Prijava</a>
            <a href="/login" className="bg-[#8b5cf6] hover:bg-[#7c3aed] shadow-[0_0_28px_rgba(139,92,246,0.45)] text-white text-sm font-bold px-5 py-3 rounded-xl transition-all">Začni brezplačno</a>
          </div>
        </div>
      </nav>

      <section className="relative min-h-[92vh] flex items-center px-5 pt-28 pb-14 overflow-hidden">
        <img src="/landing-garagebase.jpg" alt="GarageBase" className="absolute inset-0 w-full h-full object-cover object-center" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#080810_0%,#080810ee_28%,#08081088_58%,#08081022_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#08081099_0%,transparent_35%,#080810_100%)]" />

        <div className="relative max-w-6xl mx-auto w-full grid lg:grid-cols-[0.95fr_1.05fr] gap-10 items-center">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-white/8 border border-white/12 rounded-full px-4 py-2 mb-8 backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-[#3ecfcf] shadow-[0_0_16px_rgba(62,207,207,0.8)]" />
              <span className="text-[#d8d3ff] text-xs font-bold uppercase tracking-[0.18em]">Web + mobilna aplikacija</span>
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black leading-[0.98] tracking-tight mb-7">
              Tvoja garaža. Vse na enem mestu.
            </h1>
            <p className="text-white/72 text-lg sm:text-xl leading-relaxed max-w-xl mb-9">
              Servisi, stroški, opomniki, gorivo in poročila za vsako vozilo. Urejeno za vsakdanjo uporabo in pripravljeno za prodajo vozila.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-10">
              <a href="/login" className="bg-[#8b5cf6] hover:bg-[#7c3aed] text-white font-bold px-8 py-4 rounded-xl transition-all text-lg text-center shadow-[0_0_36px_rgba(139,92,246,0.5)]">Začni brezplačno</a>
              <a href="#funkcije" className="bg-black/35 border border-white/15 hover:bg-white/10 text-white font-bold px-8 py-4 rounded-xl transition-all text-lg text-center backdrop-blur-md">Oglej si funkcije</a>
            </div>

            <div className="grid grid-cols-3 gap-3 max-w-lg">
              <div className="rounded-xl bg-black/35 border border-white/10 p-4 backdrop-blur-md"><p className="text-2xl font-black">PWA</p><p className="text-white/50 text-xs mt-1">namestitev</p></div>
              <div className="rounded-xl bg-black/35 border border-white/10 p-4 backdrop-blur-md"><p className="text-2xl font-black text-[#3ecfcf]">PDF</p><p className="text-white/50 text-xs mt-1">report</p></div>
              <div className="rounded-xl bg-black/35 border border-white/10 p-4 backdrop-blur-md"><p className="text-2xl font-black text-[#a78bfa]">QR</p><p className="text-white/50 text-xs mt-1">prenos</p></div>
            </div>
          </div>
          <div className="hidden lg:block" />
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
            <p className="text-[#8a8aa8] text-lg leading-relaxed">Osnovna garaža za začetek, napredni reporti in prenos zgodovine pa kot nadgradnja, ko jih potrebuješ.</p>
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
