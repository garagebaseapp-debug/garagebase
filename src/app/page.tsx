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

  return (
    <div className="min-h-screen bg-[#080810] text-white overflow-x-hidden">

      {/* Navigacija */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-[#080810]/95 backdrop-blur-md border-b border-[#1e1e32]' : 'bg-transparent'
      }`}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold">
            <span className="text-white drop-shadow-[0_0_10px_rgba(0,0,0,1)]">Garage</span><span className="text-[#6c63ff]">Base</span>
          </h1>
          <div className="hidden md:flex items-center gap-8">
            <a href="#funkcije" className="text-[#5a5a80] hover:text-white transition-colors text-sm">Funkcije</a>
            <a href="#paketi" className="text-[#5a5a80] hover:text-white transition-colors text-sm">Paketi</a>
            <a href="#kontakt" className="text-[#5a5a80] hover:text-white transition-colors text-sm">Kontakt</a>
          </div>
          <div className="flex gap-3">
            <a href="/login" className="text-[#5a5a80] hover:text-white transition-colors text-sm px-4 py-2">
              Prijava
            </a>
            <a href="/login" className="bg-[#6c63ff] hover:bg-[#5a52e0] text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
              Začni brezplačno
            </a>
          </div>
        </div>
      </nav>

      {/* Hero sekcija z garažnim ozadjem */}
      <section className="relative min-h-screen flex items-center justify-center px-6 pt-20 overflow-hidden">

        {/* Garažno ozadje — slika */}
        <div className="absolute inset-0">
          <img src="/garaza.png" alt="Garaža"
            className="w-full h-full object-cover object-center opacity-85" />
          {/* Overlay za čitljivost teksta */}
          <div className="absolute inset-0"
            style={{ background: 'linear-gradient(to bottom, #080810bb 0%, #08081066 30%, #08081033 60%, #080810cc 100%)' }} />
          {/* Osvetlitev naprav desno spodaj */}
          <div className="absolute inset-0"
            style={{ background: 'radial-gradient(ellipse at 80% 75%, rgba(108,99,255,0.4) 0%, rgba(62,207,207,0.2) 25%, transparent 55%)' }} />
        </div>

        <div className="relative max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-[#6c63ff22] border border-[#6c63ff44] rounded-full px-4 py-1.5 mb-8">
            <div className="w-2 h-2 bg-[#3ecfcf] rounded-full animate-pulse" />
            <span className="text-[#a09aff] text-xs font-semibold uppercase tracking-wider">Nova aplikacija za vozila</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight text-white" style={{ textShadow: '0 2px 20px rgba(0,0,0,0.9), 0 0 40px rgba(0,0,0,0.8)' }}>
            Tvoja garaža.
            <br />
            <span className="text-[#6c63ff]">Vse na enem</span>
            <br />
            mestu.
          </h1>

          <p className="text-[#5a5a80] text-lg md:text-xl mb-10 max-w-2xl mx-auto leading-relaxed">
            Evidenca goriva, servisov, stroškov in opomnikov za vsa tvoja vozila.
            Verificiran PDF report pri prodaji avta.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="/login"
              className="bg-[#6c63ff] hover:bg-[#5a52e0] text-white font-semibold px-8 py-4 rounded-xl transition-all text-lg hover:scale-105">
              Začni brezplačno →
            </a>
            <a href="#funkcije"
              className="bg-[#0f0f1a] border border-[#1e1e32] hover:border-[#6c63ff44] text-white font-semibold px-8 py-4 rounded-xl transition-all text-lg">
              Oglej si funkcije
            </a>
          </div>

          {/* Statistike */}
          <div className="grid grid-cols-3 gap-6 mt-16 max-w-lg mx-auto">
            <div className="bg-[#0f0f1a80] border border-[#1e1e32] rounded-2xl p-4 backdrop-blur-sm">
              <p className="text-3xl font-bold text-white">100%</p>
              <p className="text-[#5a5a80] text-xs mt-1">Brezplačen začetek</p>
            </div>
            <div className="bg-[#0f0f1a80] border border-[#6c63ff33] rounded-2xl p-4 backdrop-blur-sm">
              <p className="text-3xl font-bold text-[#6c63ff]">PWA</p>
              <p className="text-[#5a5a80] text-xs mt-1">Dela kot app</p>
            </div>
            <div className="bg-[#0f0f1a80] border border-[#3ecfcf33] rounded-2xl p-4 backdrop-blur-sm">
              <p className="text-3xl font-bold text-[#3ecfcf]">PDF</p>
              <p className="text-[#5a5a80] text-xs mt-1">Prodajni report</p>
            </div>
          </div>
        </div>
      </section>

      {/* Funkcije */}
      <section id="funkcije" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[#6c63ff] text-sm font-semibold uppercase tracking-wider mb-3">Funkcije</p>
            <h2 className="text-3xl md:text-5xl font-bold">Vse kar rabiš za svoje vozilo</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { ikona: '⛽', naziv: 'Sledenje gorivu', opis: 'Vnašaj tankanja, izračunaj porabo L/100km in primerjaj stroške med postajami.', barva: '#3ecfcf' },
              { ikona: '🔧', naziv: 'Servisna knjiga', opis: 'Digitalna servisna knjiga z slikami računov. Nikoli več izgubljen papir.', barva: '#f59e0b' },
              { ikona: '🔔', naziv: 'Pametni opomniki', opis: 'Opomniki za registracijo, vinjeto, servis in zavarovanje. Datum in km opomniki z barvnimi conami.', barva: '#6c63ff' },
              { ikona: '📊', naziv: 'Pregled stroškov', opis: 'Grafi stroškov po mesecih. Koliko te avto stane na kilometer?', barva: '#6c63ff' },
              { ikona: '📄', naziv: 'PDF prodajni report', opis: 'Verificiran report celotne zgodovine vozila. Kupec vidi vse — servisna knjiga, gorivo, stroški.', barva: '#3ecfcf' },
              { ikona: '🚗', naziv: 'Več vozil', opis: 'Upravljaj celo garažo. Vsak avto svoja evidenca, opomniki in historia.', barva: '#f59e0b' },
            ].map((f, i) => (
              <div key={i} className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-6 hover:border-[#2a2a50] transition-all">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-4"
                  style={{ backgroundColor: `${f.barva}15`, border: `1px solid ${f.barva}30` }}>
                  {f.ikona}
                </div>
                <h3 className="text-white font-bold text-lg mb-2">{f.naziv}</h3>
                <p className="text-[#5a5a80] text-sm leading-relaxed">{f.opis}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Zakaj GarageBase */}
      <section className="py-24 px-6 bg-[#0a0a14]">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-[#6c63ff] text-sm font-semibold uppercase tracking-wider mb-3">Zakaj GarageBase</p>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">Namesto papirnih računov in pozabljenih rokov</h2>
              <div className="flex flex-col gap-4">
                {[
                  '✅ Vse evidence na enem mestu — gorivo, servis, stroški',
                  '✅ Opomniki ki te res opozorijo — push notifikacije',
                  '✅ Verificiran PDF za prodajo avta — kupec zaupa',
                  '✅ Deluje kot app — namesti na domači zaslon',
                  '✅ Glasovni vnos — vneseš tankanje med vožnjo',
                ].map((t, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <p className="text-[#5a5a80] text-sm leading-relaxed">{t}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-6">
              <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-4">Primer — BMW 320d</p>
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center p-3 bg-[#13131f] rounded-xl">
                  <div className="flex items-center gap-3">
                    <span>⛽</span>
                    <div>
                      <p className="text-white text-sm font-semibold">Gorivo skupaj</p>
                      <p className="text-[#5a5a80] text-xs">6.8 L/100km povprečje</p>
                    </div>
                  </div>
                  <p className="text-[#3ecfcf] font-bold">1.240 €</p>
                </div>
                <div className="flex justify-between items-center p-3 bg-[#13131f] rounded-xl">
                  <div className="flex items-center gap-3">
                    <span>🔧</span>
                    <div>
                      <p className="text-white text-sm font-semibold">Servisi</p>
                      <p className="text-[#5a5a80] text-xs">4 servisi v letu</p>
                    </div>
                  </div>
                  <p className="text-[#f59e0b] font-bold">680 €</p>
                </div>
                <div className="flex justify-between items-center p-3 bg-[#13131f] rounded-xl">
                  <div className="flex items-center gap-3">
                    <span>📋</span>
                    <div>
                      <p className="text-white text-sm font-semibold">Registracija</p>
                      <p className="text-[#5a5a80] text-xs">Opomnik: 23 dni</p>
                    </div>
                  </div>
                  <p className="text-[#f59e0b] font-bold">23 dni</p>
                </div>
                <div className="mt-2 p-3 bg-[#6c63ff15] border border-[#6c63ff33] rounded-xl">
                  <div className="flex justify-between">
                    <p className="text-[#5a5a80] text-xs">Skupaj stroški</p>
                    <p className="text-white font-bold">1.920 €</p>
                  </div>
                  <div className="flex justify-between mt-1">
                    <p className="text-[#5a5a80] text-xs">Cena na km</p>
                    <p className="text-[#6c63ff] font-bold">0.096 €/km</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Paketi */}
      <section id="paketi" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[#6c63ff] text-sm font-semibold uppercase tracking-wider mb-3">Paketi</p>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Začni brezplačno</h2>
            <p className="text-[#5a5a80]">Nadgradi kadarkoli. Brez vezave.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {[
              {
                naziv: 'Free', cena: '0', opis: 'Za začetek', barva: '#3ecfcf', vozila: '1 vozilo',
                funkcije: ['✅ Vnos goriva in servisov', '✅ Opomniki', '✅ Slika vozila', '✅ 50MB storage', '❌ Grafi stroškov', '❌ PDF report', '❌ Glasovni vnos'],
                gumb: 'Začni brezplačno', poudarjen: false
              },
              {
                naziv: 'Basic', cena: '3', opis: 'Za navadne uporabnike', barva: '#6c63ff', vozila: '2 vozili',
                funkcije: ['✅ Vse od Free', '✅ Grafi stroškov', '✅ Glasovni vnos', '✅ PDF report', '✅ 200MB storage', '✅ Push notifikacije', '❌ QR prenos zgodovine'],
                gumb: 'Izberi Basic', poudarjen: false
              },
              {
                naziv: 'Pro', cena: '7', opis: 'Za resne uporabnike', barva: '#6c63ff', vozila: '5 vozil',
                funkcije: ['✅ Vse od Basic', '✅ QR prenos zgodovine', '✅ Km opomniki', '✅ Uvoz zgodovine CSV', '✅ 1GB storage', '✅ Prioritetna podpora', '✅ Vse funkcije'],
                gumb: 'Izberi Pro', poudarjen: true
              },
            ].map((p, i) => (
              <div key={i} className={`rounded-2xl p-6 border transition-all relative ${
                p.poudarjen ? 'bg-[#6c63ff15] border-[#6c63ff66] md:-mt-4' : 'bg-[#0f0f1a] border-[#1e1e32]'
              }`}>
                {p.poudarjen && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#6c63ff] text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                    Najbolj popularno
                  </div>
                )}
                <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2">{p.opis}</p>
                <h3 className="text-white font-bold text-2xl mb-1">{p.naziv}</h3>
                <div className="flex items-end gap-1 mb-2">
                  <p className="text-4xl font-bold" style={{ color: p.barva }}>{p.cena}€</p>
                  <p className="text-[#5a5a80] text-sm mb-1">/mes</p>
                </div>
                <p className="text-[#5a5a80] text-xs mb-6 pb-4 border-b border-[#1e1e32]">🚗 {p.vozila}</p>
                <div className="flex flex-col gap-2 mb-6">
                  {p.funkcije.map((f, j) => (
                    <p key={j} className="text-sm" style={{ color: f.startsWith('✅') ? '#a0a0c0' : '#3a3a5a' }}>{f}</p>
                  ))}
                </div>
                <a href="/login" className={`block text-center font-semibold py-3 rounded-xl transition-colors ${
                  p.poudarjen ? 'bg-[#6c63ff] hover:bg-[#5a52e0] text-white' : 'bg-[#13131f] border border-[#1e1e32] hover:border-[#6c63ff44] text-white'
                }`}>
                  {p.gumb}
                </a>
              </div>
            ))}
          </div>
          <p className="text-center text-[#3a3a5a] text-sm mt-8">
            Letna naročnina — prihranite 20% · PDF report za Free uporabnike 20€ enkratno
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[#0a0a14]" />
          <div className="absolute left-0 right-0 top-0 h-px"
            style={{ background: 'linear-gradient(to right, transparent, #6c63ff, #3ecfcf, #6c63ff, transparent)' }} />
          <div className="absolute left-0 right-0 bottom-0 h-px"
            style={{ background: 'linear-gradient(to right, transparent, #6c63ff, #3ecfcf, #6c63ff, transparent)' }} />
        </div>
        <div className="relative max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">
            Začni danes.
            <br />
            <span className="text-[#6c63ff]">Brezplačno.</span>
          </h2>
          <p className="text-[#5a5a80] text-lg mb-10">
            Registracija traja manj kot minuto. Kreditna kartica ni potrebna.
          </p>
          <a href="/login"
            className="inline-block bg-[#6c63ff] hover:bg-[#5a52e0] text-white font-semibold px-10 py-4 rounded-xl transition-all text-lg hover:scale-105">
            Ustvari brezplačen račun →
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer id="kontakt" className="py-12 px-6 border-t border-[#1e1e32]">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <h3 className="text-white font-bold text-lg mb-1">
              Garage<span className="text-[#6c63ff]">Base</span>
            </h3>
            <p className="text-[#5a5a80] text-sm">Tvoja avto evidenca — vse na enem mestu</p>
          </div>
          <div className="flex flex-col items-center md:items-end gap-1">
            <p className="text-[#5a5a80] text-sm">📧 garagebase.app@gmail.com</p>
            <p className="text-[#5a5a80] text-sm">🌐 getgaragebase.com</p>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-8 pt-6 border-t border-[#1e1e32] flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-[#3a3a5a] text-xs">© 2026 GarageBase. Vse pravice pridržane.</p>
          <div className="flex gap-6">
            <a href="#" className="text-[#3a3a5a] hover:text-white text-xs transition-colors">Pogoji uporabe</a>
            <a href="#" className="text-[#3a3a5a] hover:text-white text-xs transition-colors">Zasebnost</a>
            <a href="#" className="text-[#3a3a5a] hover:text-white text-xs transition-colors">Kontakt</a>
          </div>
        </div>
      </footer>

    </div>
  )
}