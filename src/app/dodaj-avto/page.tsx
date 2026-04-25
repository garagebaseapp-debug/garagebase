'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BottomNav, BackButton } from '@/lib/nav'

export default function DodajAvto() {
  const [tipVozila, setTipVozila] = useState('avto')
  const [tipVozilaCustom, setTipVozilaCustom] = useState('')
  const [oblika, setOblika] = useState('')
  const [znamka, setZnamka] = useState('')
  const [model, setModel] = useState('')
  const [letnik, setLetnik] = useState('')
  const [gorivo, setGorivo] = useState('Bencin')
  const [barva, setBarva] = useState('')
  const [tablica, setTabla] = useState('')
  const [km, setKm] = useState('')
  const [kubikaza, setKubikaza] = useState('')
  const [kw, setKw] = useState('')
  const [menjalnik, setMenjalnik] = useState('')
  const [pogon, setPogon] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const tipiVozil = [
    { vrednost: 'avto', ikona: '🚗', naziv: 'Avto' },
    { vrednost: 'motor', ikona: '🏍️', naziv: 'Motor' },
    { vrednost: 'kombi', ikona: '🚐', naziv: 'Kombi' },
    { vrednost: 'tovornjak', ikona: '🚛', naziv: 'Tovornjak' },
    { vrednost: 'plovilo', ikona: '⛵', naziv: 'Plovilo' },
    { vrednost: 'drugo', ikona: '⚙️', naziv: 'Drugo' },
  ]

  const oblikeAvta: { [key: string]: string[] } = {
    avto: ['Sedan', 'Karavan', 'SUV', 'Kabriolet', 'Kupe', 'Hatchback', 'Crossover', 'Pickup'],
    kombi: ['Van', 'Minivan', 'Minibus', 'Bus'],
    tovornjak: ['Poltovornjak', 'Tovornjak', 'Vlačilec', 'Prikolica'],
    motor: ['Naked', 'Sport', 'Touring', 'Enduro', 'Scooter', 'Chopper'],
    plovilo: ['Čoln', 'Jahta', 'Jadrnica', 'Gumenjak'],
    drugo: ['Traktor', 'Quad', 'ATV', 'Skuter', 'Drugo'],
  }

  const shrani = async () => {
    if (!znamka || !model) { setMessage('Znamka in model sta obvezna!'); return }
    if (tipVozila === 'drugo' && !tipVozilaCustom) { setMessage('Vnesi tip vozila!'); return }
    setLoading(true)
    setMessage('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/'; return }
    const finalniTip = tipVozila === 'drugo' ? tipVozilaCustom : tipVozila
    const { error } = await supabase.from('cars').insert({
      user_id: user.id,
      tip_vozila: finalniTip,
      oblika: oblika || null,
      znamka, model,
      letnik: letnik ? parseInt(letnik) : null,
      gorivo,
      barva: barva || null,
      tablica: tablica || null,
      km_trenutni: km ? parseInt(km) : null,
      kubikaza: kubikaza ? parseInt(kubikaza) : null,
      kw: kw ? parseInt(kw) : null,
      menjalnik: menjalnik || null,
      pogon: pogon || null,
    })
    if (error) setMessage('Napaka: ' + error.message)
    else { setMessage('✅ Vozilo uspešno shranjeno!'); setTimeout(() => window.location.href = '/garaza', 1000) }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#080810] px-4 py-6 pb-24">
      <div className="flex items-center gap-3 mb-8">
        <BackButton href="/garaza" />
        <h1 className="text-xl font-bold text-white">Dodaj vozilo</h1>
      </div>

      <div className="flex flex-col gap-4">

        {/* Tip vozila */}
        <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5">
          <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-3 block">Tip vozila</label>
          <div className="grid grid-cols-3 gap-2">
            {tipiVozil.map((tip) => (
              <button key={tip.vrednost} type="button"
                onClick={() => { setTipVozila(tip.vrednost); setOblika(''); setTipVozilaCustom('') }}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
                  tipVozila === tip.vrednost
                    ? 'bg-[#6c63ff22] border-[#6c63ff66] text-[#a09aff]'
                    : 'bg-[#13131f] border-[#1e1e32] text-[#5a5a80] hover:border-[#6c63ff33]'
                }`}>
                <span className="text-2xl">{tip.ikona}</span>
                <span className="text-xs font-semibold">{tip.naziv}</span>
              </button>
            ))}
          </div>

          {/* Custom tip */}
          {tipVozila === 'drugo' && (
            <div className="mt-3">
              <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Natančen tip vozila *</label>
              <input value={tipVozilaCustom} onChange={e => setTipVozilaCustom(e.target.value)}
                placeholder="npr. Štirikoles, Traktor, Quad..."
                className="w-full bg-[#13131f] border border-[#6c63ff44] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
            </div>
          )}
        </div>

        {/* Osnovno */}
        <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5 flex flex-col gap-4">
          <h2 className="text-white font-semibold">Osnovni podatki</h2>

          <div>
            <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Znamka *</label>
            <input value={znamka} onChange={e => setZnamka(e.target.value)} placeholder="npr. Volvo"
              className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
          </div>

          <div>
            <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Model *</label>
            <input value={model} onChange={e => setModel(e.target.value)} placeholder="npr. XC90"
              className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Letnik</label>
              <input value={letnik} onChange={e => setLetnik(e.target.value)} placeholder="2021" type="number"
                className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
            </div>
            <div>
              <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Gorivo</label>
              <select value={gorivo} onChange={e => setGorivo(e.target.value)}
                className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors">
                <option>Bencin</option>
                <option>Diesel</option>
                <option>Električni</option>
                <option>Hibrid</option>
                <option>Plin</option>
                <option>Vodik</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Trenutni km</label>
            <input value={km} onChange={e => setKm(e.target.value)} placeholder="npr. 54200" type="number"
              className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
          </div>

          <div>
            <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Registrska tablica</label>
            <input value={tablica} onChange={e => setTabla(e.target.value)} placeholder="npr. LJ X9-MK1"
              className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
          </div>

          <div>
            <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Barva</label>
            <input value={barva} onChange={e => setBarva(e.target.value)} placeholder="npr. Siva metalik"
              className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
          </div>
        </div>

        {/* Napredne nastavitve */}
        <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5 flex flex-col gap-4">
          <h2 className="text-white font-semibold">Napredni podatki <span className="text-[#5a5a80] text-xs font-normal">(po želji)</span></h2>

          {oblikeAvta[tipVozila] && (
            <div>
              <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Oblika</label>
              <div className="flex flex-wrap gap-2">
                {oblikeAvta[tipVozila].map((o) => (
                  <button key={o} type="button" onClick={() => setOblika(oblika === o ? '' : o)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                      oblika === o
                        ? 'bg-[#6c63ff22] border-[#6c63ff66] text-[#a09aff]'
                        : 'bg-[#13131f] border-[#1e1e32] text-[#5a5a80] hover:border-[#6c63ff33]'
                    }`}>
                    {o}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Kubikаža (ccm)</label>
              <input value={kubikaza} onChange={e => setKubikaza(e.target.value)} placeholder="npr. 1968" type="number"
                className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
            </div>
            <div>
              <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Moč (kW)</label>
              <input value={kw} onChange={e => setKw(e.target.value)} placeholder="npr. 140" type="number"
                className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
            </div>
          </div>

          <div>
            <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Menjalnik</label>
            <div className="grid grid-cols-3 gap-2">
              {['Ročni', 'Avtomatski', 'Polavtomatski'].map((m) => (
                <button key={m} type="button" onClick={() => setMenjalnik(menjalnik === m ? '' : m)}
                  className={`py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                    menjalnik === m
                      ? 'bg-[#6c63ff22] border-[#6c63ff66] text-[#a09aff]'
                      : 'bg-[#13131f] border-[#1e1e32] text-[#5a5a80] hover:border-[#6c63ff33]'
                  }`}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Pogon</label>
            <div className="grid grid-cols-3 gap-2">
              {['Sprednji', 'Zadnji', '4x4'].map((p) => (
                <button key={p} type="button" onClick={() => setPogon(pogon === p ? '' : p)}
                  className={`py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                    pogon === p
                      ? 'bg-[#6c63ff22] border-[#6c63ff66] text-[#a09aff]'
                      : 'bg-[#13131f] border-[#1e1e32] text-[#5a5a80] hover:border-[#6c63ff33]'
                  }`}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        {message && (
          <div className={`p-3 rounded-xl text-sm border ${
            message.includes('✅') ? 'bg-[#16a34a22] border-[#16a34a44] text-[#4ade80]' : 'bg-[#ef444422] border-[#ef444444] text-[#fca5a5]'
          }`}>{message}</div>
        )}

        <button onClick={shrani} disabled={loading}
          className="w-full bg-[#6c63ff] hover:bg-[#5a52e0] text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50">
          {loading ? 'Shranjevanje...' : 'Shrani vozilo →'}
        </button>
      </div>

      <BottomNav />
    </div>
  )
}