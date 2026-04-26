'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { BottomNav } from '@/lib/nav'

export default function Nastavitve() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [nacin, setNacin] = useState<'lite' | 'full'>('full')
  const [jezik, setJezik] = useState('sl')
  const [pisava, setPisava] = useState('normalna')
  const [prikazGaraze, setPrikazGaraze] = useState('srednje')
  const [avtocomplete, setAvtocomplete] = useState(true)
  const [tema, setTema] = useState('temna')
  const [gridNastavitve, setGridNastavitve] = useState({
    tablica: true, km: true, opomnik: true, letnik: false, gorivo: false,
    opomnikRdeci: true, opomnikRumeni: true, opomnikZeleni: false
  })
  const [listaNastavitve, setListaNastavitve] = useState({
    letnik: true, gorivo: true, km: true, opomnik: true, tablica: true,
    opomnikRdeci: true, opomnikRumeni: true, opomnikZeleni: false
  })
  const [message, setMessage] = useState('')

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/'; return }
      setUser(user)
      const shranjeneNastavitve = localStorage.getItem('garagebase_nastavitve')
      if (shranjeneNastavitve) {
        const n = JSON.parse(shranjeneNastavitve)
        setNacin(n.nacin || 'full')
        setJezik(n.jezik || 'sl')
        setPisava(n.pisava || 'normalna')
        setPrikazGaraze(n.prikazGaraze || 'srednje')
        setAvtocomplete(n.avtocomplete !== false)
        setTema(n.tema || 'temna')
        if (n.gridNastavitve) setGridNastavitve(prev => ({ ...prev, ...n.gridNastavitve }))
        if (n.listaNastavitve) setListaNastavitve(prev => ({ ...prev, ...n.listaNastavitve }))
        if (n.tema === 'svetla') {
          document.documentElement.classList.add('light-mode')
        } else {
          document.documentElement.classList.remove('light-mode')
        }
      }
      setLoading(false)
    }
    init()
  }, [])

  const shrani = () => {
    const nastavitve = { nacin, jezik, pisava, prikazGaraze, avtocomplete, tema, gridNastavitve, listaNastavitve }
    localStorage.setItem('garagebase_nastavitve', JSON.stringify(nastavitve))
    // Apliciramo velikost pisave takoj
    const velikosti: any = { mala: '13px', normalna: '16px', velika: '19px' }
    document.documentElement.style.fontSize = velikosti[pisava]
    setMessage('✅ Nastavitve shranjene!')
    setTimeout(() => setMessage(''), 2000)
  }

  const preklopiTemo = () => {
    const novaTema = tema === 'temna' ? 'svetla' : 'temna'
    setTema(novaTema)
    if (novaTema === 'svetla') {
      document.documentElement.classList.add('light-mode')
    } else {
      document.documentElement.classList.remove('light-mode')
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const OpomnikFilter = ({ nastavitve, setNastavitve }: { nastavitve: any, setNastavitve: any }) => (
    <div className="mt-3 pt-3 border-t border-[#1e1e32]">
      <p className="text-[#5a5a80] text-xs mb-2">Prikaži opomnike:</p>
      <div className="flex gap-2">
        {[
          { key: 'opomnikRdeci', naziv: '🔴 Nujni', opis: '<7 dni' },
          { key: 'opomnikRumeni', naziv: '🟡 Kmalu', opis: '<30 dni' },
          { key: 'opomnikZeleni', naziv: '🟢 Vsi', opis: '>30 dni' },
        ].map((item) => (
          <button key={item.key}
            onClick={() => setNastavitve((prev: any) => ({ ...prev, [item.key]: !prev[item.key] }))}
            className={`flex-1 py-2 px-1 rounded-xl border text-center transition-all ${
              nastavitve[item.key]
                ? 'bg-[#6c63ff22] border-[#6c63ff66]'
                : 'bg-[#13131f] border-[#1e1e32]'
            }`}>
            <p className="text-xs">{item.naziv}</p>
            <p className="text-[#5a5a80] text-[9px]">{item.opis}</p>
          </button>
        ))}
      </div>
    </div>
  )

  if (loading) return (
    <div className="min-h-screen bg-[#080810] flex items-center justify-center">
      <p className="text-[#5a5a80]">Nalaganje...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#080810] px-4 py-6 pb-24">

      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-white">
          Garage<span className="text-[#6c63ff]">Base</span>
        </h1>
      </div>

      {/* Profil */}
      <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5 mb-4">
        <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-3">Profil</p>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#6c63ff22] border border-[#6c63ff44] flex items-center justify-center">
            <span className="text-2xl">👤</span>
          </div>
          <div>
            <p className="text-white font-semibold">{user?.email}</p>
            <p className="text-[#5a5a80] text-xs mt-0.5">Free paket</p>
          </div>
        </div>
      </div>

      {/* Tema */}
      <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5 mb-4">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-white font-semibold text-sm">
              {tema === 'temna' ? '🌙 Temni način' : '☀️ Svetli način'}
            </p>
            <p className="text-[#5a5a80] text-xs mt-0.5">Preklopi med temnim in svetlim</p>
          </div>
          <button onClick={preklopiTemo}
            className={`w-12 h-6 rounded-full transition-all relative ${
              tema === 'svetla' ? 'bg-[#6c63ff]' : 'bg-[#2a2a40]'
            }`}>
            <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${
              tema === 'svetla' ? 'left-6' : 'left-0.5'
            }`} />
          </button>
        </div>
      </div>

      {/* Način uporabe */}
      <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5 mb-4">
        <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-1">Način uporabe</p>
        <p className="text-[#3a3a5a] text-xs mb-3">Lite = enostavno, Full = vse možnosti</p>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => setNacin('lite')}
            className={`p-4 rounded-xl border transition-all text-left ${
              nacin === 'lite' ? 'bg-[#3ecfcf22] border-[#3ecfcf66]' : 'bg-[#13131f] border-[#1e1e32]'
            }`}>
            <p className="text-lg mb-1">🟢</p>
            <p className={`font-bold text-sm ${nacin === 'lite' ? 'text-[#3ecfcf]' : 'text-white'}`}>Lite</p>
            <p className="text-[#5a5a80] text-xs mt-1">Samo osnove, brez kompleksnih nastavitev</p>
          </button>
          <button onClick={() => setNacin('full')}
            className={`p-4 rounded-xl border transition-all text-left ${
              nacin === 'full' ? 'bg-[#6c63ff22] border-[#6c63ff66]' : 'bg-[#13131f] border-[#1e1e32]'
            }`}>
            <p className="text-lg mb-1">🔵</p>
            <p className={`font-bold text-sm ${nacin === 'full' ? 'text-[#a09aff]' : 'text-white'}`}>Full</p>
            <p className="text-[#5a5a80] text-xs mt-1">Vse funkcije in napredne nastavitve</p>
          </button>
        </div>
      </div>

      {/* Jezik */}
      <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5 mb-4">
        <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-3">Jezik</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { vrednost: 'sl', naziv: '🇸🇮 Slovenščina' },
            { vrednost: 'en', naziv: '🇬🇧 English' },
          ].map((j) => (
            <button key={j.vrednost} onClick={() => setJezik(j.vrednost)}
              className={`py-3 rounded-xl border text-sm font-semibold transition-all ${
                jezik === j.vrednost
                  ? 'bg-[#6c63ff22] border-[#6c63ff66] text-[#a09aff]'
                  : 'bg-[#13131f] border-[#1e1e32] text-[#5a5a80]'
              }`}>
              {j.naziv}
            </button>
          ))}
        </div>
      </div>

      {/* Pisava */}
      <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5 mb-4">
        <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-3">Velikost pisave</p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { vrednost: 'mala', naziv: 'Mala' },
            { vrednost: 'normalna', naziv: 'Normalna' },
            { vrednost: 'velika', naziv: 'Velika' },
          ].map((p) => (
            <button key={p.vrednost} onClick={() => setPisava(p.vrednost)}
              className={`py-3 rounded-xl border text-sm font-semibold transition-all ${
                pisava === p.vrednost
                  ? 'bg-[#6c63ff22] border-[#6c63ff66] text-[#a09aff]'
                  : 'bg-[#13131f] border-[#1e1e32] text-[#5a5a80]'
              }`}>
              {p.naziv}
            </button>
          ))}
        </div>
      </div>

      {/* Prikaz garaže */}
      <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5 mb-4">
        <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-1">Prikaz garaže</p>
        <p className="text-[#3a3a5a] text-xs mb-3">Višina kartic avtov na začetnem zaslonu</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { vrednost: 'malo', naziv: 'Malo', opis: 'Več avtov' },
            { vrednost: 'srednje', naziv: 'Srednje', opis: 'Privzeto' },
            { vrednost: 'veliko', naziv: 'Veliko', opis: 'Večje slike' },
            { vrednost: 'grid', naziv: '⊞ Grid', opis: '3x kompaktno' },
          ].map((p) => (
            <button key={p.vrednost} onClick={() => setPrikazGaraze(p.vrednost)}
              className={`py-3 px-2 rounded-xl border transition-all text-center ${
                prikazGaraze === p.vrednost ? 'bg-[#6c63ff22] border-[#6c63ff66]' : 'bg-[#13131f] border-[#1e1e32]'
              }`}>
              <p className={`text-sm font-semibold ${prikazGaraze === p.vrednost ? 'text-[#a09aff]' : 'text-white'}`}>{p.naziv}</p>
              <p className="text-[#5a5a80] text-xs mt-0.5">{p.opis}</p>
            </button>
          ))}
        </div>

        {/* Grid nastavitve */}
        {prikazGaraze === 'grid' && (
          <div className="mt-4 pt-4 border-t border-[#1e1e32]">
            <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-3">Prikaži v grid kockici</p>
            <div className="flex flex-col gap-3">
              {[
                { key: 'tablica', naziv: 'Registrska tablica' },
                { key: 'km', naziv: 'Kilometri' },
                { key: 'opomnik', naziv: 'Opomniki na kartici' },
                { key: 'letnik', naziv: 'Letnik' },
                { key: 'gorivo', naziv: 'Tip goriva' },
              ].map((item) => (
                <div key={item.key} className="flex justify-between items-center">
                  <p className="text-white text-sm">{item.naziv}</p>
                  <button
                    onClick={() => setGridNastavitve((prev: any) => ({ ...prev, [item.key]: !prev[item.key] }))}
                    className={`w-10 h-5 rounded-full transition-all relative ${
                      gridNastavitve[item.key as keyof typeof gridNastavitve] ? 'bg-[#6c63ff]' : 'bg-[#2a2a40]'
                    }`}>
                    <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${
                      gridNastavitve[item.key as keyof typeof gridNastavitve] ? 'left-5' : 'left-0.5'
                    }`} />
                  </button>
                </div>
              ))}
            </div>
            {gridNastavitve.opomnik && (
              <OpomnikFilter nastavitve={gridNastavitve} setNastavitve={setGridNastavitve} />
            )}
          </div>
        )}

        {/* Lista nastavitve */}
        {prikazGaraze !== 'grid' && (
          <div className="mt-4 pt-4 border-t border-[#1e1e32]">
            <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-3">Prikaži na kartici</p>
            <div className="flex flex-col gap-3">
              {[
                { key: 'letnik', naziv: 'Letnik' },
                { key: 'gorivo', naziv: 'Gorivo' },
                { key: 'km', naziv: 'Kilometri' },
                { key: 'tablica', naziv: 'Registrska tablica' },
                { key: 'opomnik', naziv: 'Opomniki na kartici' },
              ].map((item) => (
                <div key={item.key} className="flex justify-between items-center">
                  <p className="text-white text-sm">{item.naziv}</p>
                  <button
                    onClick={() => setListaNastavitve((prev: any) => ({ ...prev, [item.key]: !prev[item.key] }))}
                    className={`w-10 h-5 rounded-full transition-all relative ${
                      listaNastavitve[item.key as keyof typeof listaNastavitve] ? 'bg-[#6c63ff]' : 'bg-[#2a2a40]'
                    }`}>
                    <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${
                      listaNastavitve[item.key as keyof typeof listaNastavitve] ? 'left-5' : 'left-0.5'
                    }`} />
                  </button>
                </div>
              ))}
            </div>
            {listaNastavitve.opomnik && (
              <OpomnikFilter nastavitve={listaNastavitve} setNastavitve={setListaNastavitve} />
            )}
          </div>
        )}
      </div>

      {/* Autocomplete */}
      <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5 mb-4">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-white font-semibold text-sm">Predlagane besede</p>
            <p className="text-[#5a5a80] text-xs mt-0.5">Autocomplete pri vnosu postaje in servisa</p>
          </div>
          <button onClick={() => setAvtocomplete(!avtocomplete)}
            className={`w-12 h-6 rounded-full transition-all relative ${
              avtocomplete ? 'bg-[#6c63ff]' : 'bg-[#2a2a40]'
            }`}>
            <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${
              avtocomplete ? 'left-6' : 'left-0.5'
            }`} />
          </button>
        </div>
      </div>

      {/* O aplikaciji */}
      <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5 mb-4">
        <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-3">O aplikaciji</p>
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <span className="text-[#5a5a80] text-sm">Verzija</span>
            <span className="text-white text-sm">1.0.0 Beta</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#5a5a80] text-sm">Spletna stran</span>
            <span className="text-[#6c63ff] text-sm">getgaragebase.com</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#5a5a80] text-sm">Podpora</span>
            <span className="text-[#6c63ff] text-sm">garagebase.app@gmail.com</span>
          </div>
        </div>
      </div>

      {message && (
        <div className="p-3 rounded-xl text-sm border bg-[#16a34a22] border-[#16a34a44] text-[#4ade80] mb-4">
          {message}
        </div>
      )}

      <button onClick={shrani}
        className="w-full bg-[#6c63ff] hover:bg-[#5a52e0] text-white font-semibold py-3 rounded-xl transition-colors mb-3">
        Shrani nastavitve
      </button>

      <button onClick={handleLogout}
        className="w-full bg-[#13131f] border border-[#1e1e32] text-[#ef4444] font-semibold py-3 rounded-xl hover:bg-[#ef444411] transition-colors">
        Odjava
      </button>

      <BottomNav aktivna="nastavitve" />
    </div>
  )
}