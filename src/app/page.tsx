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
    { oznaka: 'Gorivo', opis: 'Poraba, tankanja in stroški po vozilih.' },
    { oznaka: 'Servisi', opis: 'Servisna knjiga z računi in kilometri.' },
    { oznaka: 'Opomniki', opis: 'Registracija, vinjeta, servis in zavarovanje.' },
    { oznaka: 'Poročila', opis: 'Pregleden PDF za prodajo vozila.' },
    { oznaka: 'Mobilna app', opis: 'Namesti na telefon in uporabljaj kot aplikacijo.' },
    { oznaka: 'Več vozil', opis: 'Celotna domača garaža na enem mestu.' },
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
            <a href="#paketi" className="hover:text-white transition-colors">Paketi</a>
            <a href="#kontakt" className="hover:text-white transition-colors">Kontakt</a>
          </div>
          <div className="flex gap-3">
            <a href="/login" className="hidden sm:inline-flex border border-white/18 bg-black/20 hover:bg-white/10 text-white text-sm font-semibold px-5 py-3 rounded-xl transition-colors">Prijava</a>
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
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,7,13,0.86)_0%,rgba(7,7,13,0.70)_32%,rgba(7,7,13,0.28)_52%,rgba(7,7,13,0.04)_76%,rgba(7,7,13,0)_100%)]" />
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#07070d]/80 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-[#07070d] via-[#07070d]/38 to-transparent" />

        <div className="relative z-10 min-h-screen max-w-7xl mx-auto px-5 sm:px-8 pt-32 pb-24 flex items-center">
          <div className="w-full max-w-[560px] lg:mb-10">
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
