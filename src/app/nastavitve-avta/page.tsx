'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { HomeButton, BackButton } from '@/lib/nav'

export default function NastavitveAvta() {
  const [avto, setAvto] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [uploadingSlika, setUploadingSlika] = useState(false)
  const [tipVozila, setTipVozila] = useState('avto')
  const [tipVozilaCustom, setTipVozilaCustom] = useState('')
  const [oblika, setOblika] = useState('')
  const [znamka, setZnamka] = useState('')
  const [model, setModel] = useState('')
  const [letnik, setLetnik] = useState('')
  const [gorivo, setGorivo] = useState('')
  const [barva, setBarva] = useState('')
  const [tablica, setTabla] = useState('')
  const [vin, setVin] = useState('')
  const [kubikaza, setKubikaza] = useState('')
  const [kw, setKw] = useState('')
  const [menjalnik, setMenjalnik] = useState('')
  const [pogon, setPogon] = useState('')
  const [kmNovo, setKmNovo] = useState('')
  const [kmOpomba, setKmOpomba] = useState('')

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

  const standardniTipi = ['avto', 'motor', 'kombi', 'tovornjak', 'plovilo']

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/'; return }
      const params = new URLSearchParams(window.location.search)
      const carId = params.get('car')
      if (!carId) { window.location.href = '/garaza'; return }
      const { data } = await supabase.from('cars').select('*').eq('id', carId).single()
      if (data) {
        setAvto(data)
        // Če tip ni standardni, je custom
        if (data.tip_vozila && !standardniTipi.includes(data.tip_vozila)) {
          setTipVozila('drugo')
          setTipVozilaCustom(data.tip_vozila)
        } else {
          setTipVozila(data.tip_vozila || 'avto')
        }
        setOblika(data.oblika || '')
        setZnamka(data.znamka || '')
        setModel(data.model || '')
        setLetnik(data.letnik?.toString() || '')
        setGorivo(data.gorivo || '')
        setBarva(data.barva || '')
        setTabla(data.tablica || '')
        setVin(data.vin || '')
        setKubikaza(data.kubikaza?.toString() || '')
        setKw(data.kw?.toString() || '')
        setMenjalnik(data.menjalnik || '')
        setPogon(data.pogon || '')
        setKmNovo(data.km_trenutni?.toString() || '')
      }
      setLoading(false)
    }
    init()
  }, [])

  const naloziSliko = async (e: any) => {
    const file = e.target.files[0]
    if (!file) return
    setUploadingSlika(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const fileExt = file.name.split('.').pop()
    const fileName = `${user.id}/${avto.id}.${fileExt}`
    await supabase.storage.from('car-images').remove([fileName])
    const { error: uploadError } = await supabase.storage.from('car-images').upload(fileName, file, { upsert: true })
    if (uploadError) { setMessage('Napaka pri nalaganju slike'); setUploadingSlika(false); return }
    const { data: urlData } = supabase.storage.from('car-images').getPublicUrl(fileName)
    await supabase.from('cars').update({ slika_url: urlData.publicUrl }).eq('id', avto.id)
    setAvto({ ...avto, slika_url: urlData.publicUrl })
    setMessage('✅ Slika uspešno naložena!')
    setUploadingSlika(false)
  }

  const shrani = async () => {
    if (tipVozila === 'drugo' && !tipVozilaCustom) { setMessage('Vnesi tip vozila!'); return }
    setSaving(true)
    setMessage('')
    const stariKm = avto.km_trenutni || 0
    const noviKm = parseInt(kmNovo) || stariKm
    if (noviKm !== stariKm) {
      await supabase.from('expenses').insert({
        car_id: avto.id,
        datum: new Date().toISOString().split('T')[0],
        kategorija: 'km_sprememba',
        opis: `Km: ${stariKm.toLocaleString()} → ${noviKm.toLocaleString()} km. Razlog: ${kmOpomba || 'Ni naveden'}`,
        znesek: 0,
      })
    }
    const finalniTip = tipVozila === 'drugo' ? tipVozilaCustom : tipVozila
    const { error } = await supabase.from('cars').update({
      tip_vozila: finalniTip,
      oblika: oblika || null,
      znamka, model,
      letnik: letnik ? parseInt(letnik) : null,
      gorivo, barva: barva || null,
      tablica: tablica || null,
      vin: vin || null,
      kubikaza: kubikaza ? parseInt(kubikaza) : null,
      kw: kw ? parseInt(kw) : null,
      menjalnik: menjalnik || null,
      pogon: pogon || null,
      km_trenutni: noviKm,
    }).eq('id', avto.id)
    if (error) setMessage('Napaka: ' + error.message)
    else { setMessage('✅ Nastavitve shranjene!'); setAvto({ ...avto, km_trenutni: noviKm }) }
    setSaving(false)
  }

  if (loading) return (
    <div className="min-h-screen bg-[#080810] flex items-center justify-center">
      <p className="text-[#5a5a80]">Nalaganje...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#080810] px-4 py-6 pb-24">
      <div className="flex items-center gap-3 mb-6">
        <BackButton href={`/dashboard?car=${avto?.id}`} />
        <div>
          <h1 className="text-xl font-bold text-white">⚙️ Nastavitve vozila</h1>
          <p className="text-[#5a5a80] text-xs">{avto?.znamka} {avto?.model}</p>
        </div>
      </div>

      {/* Slika */}
      <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl overflow-hidden mb-4">
        {avto?.slika_url ? (
          <div className="relative">
            <img src={avto.slika_url} alt="Avto" className="w-full h-44 object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <label className="absolute bottom-3 right-3 bg-[#6c63ff] text-white text-xs font-semibold px-3 py-1.5 rounded-xl cursor-pointer hover:bg-[#5a52e0] transition-colors">
              {uploadingSlika ? 'Nalaganje...' : '📷 Zamenjaj'}
              <input type="file" accept="image/*" onChange={naloziSliko} className="hidden" />
            </label>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center h-36 cursor-pointer hover:bg-[#13131f] transition-colors">
            <span className="text-3xl mb-2">📷</span>
            <span className="text-[#5a5a80] text-sm font-semibold">{uploadingSlika ? 'Nalaganje...' : 'Dodaj sliko'}</span>
            <input type="file" accept="image/*" onChange={naloziSliko} className="hidden" />
          </label>
        )}
      </div>

      {/* Tip vozila */}
      <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5 mb-4">
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
      <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5 flex flex-col gap-4 mb-4">
        <h2 className="text-white font-semibold">Osnovni podatki</h2>
        <div>
          <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Znamka</label>
          <input value={znamka} onChange={e => setZnamka(e.target.value)}
            className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
        </div>
        <div>
          <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Model</label>
          <input value={model} onChange={e => setModel(e.target.value)}
            className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Letnik</label>
            <input value={letnik} onChange={e => setLetnik(e.target.value)} type="number"
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
          <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Barva</label>
          <input value={barva} onChange={e => setBarva(e.target.value)} placeholder="npr. Siva metalik"
            className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
        </div>
        <div>
          <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Registrska tablica</label>
          <input value={tablica} onChange={e => setTabla(e.target.value)}
            className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
        </div>
        <div>
          <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">VIN številka</label>
          <input value={vin} onChange={e => setVin(e.target.value)} placeholder="17-mestna VIN koda" maxLength={17}
            className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors font-mono tracking-widest" />
        </div>
      </div>

      {/* Napredne nastavitve */}
      <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5 flex flex-col gap-4 mb-4">
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

      {/* KM varovalka */}
      <div className="bg-[#0f0f1a] border border-[#f59e0b33] rounded-2xl p-5 flex flex-col gap-4 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">⚠️</span>
          <h2 className="text-white font-semibold">Kilometri</h2>
        </div>
        <p className="text-[#5a5a80] text-xs">Vsaka sprememba km se zabeleži z datumom in razlogom.</p>
        <div>
          <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">
            Trenutni km <span className="text-[#5a5a80] normal-case">(trenutno: {avto?.km_trenutni?.toLocaleString()})</span>
          </label>
          <input value={kmNovo} onChange={e => setKmNovo(e.target.value)} type="number"
            className="w-full bg-[#13131f] border border-[#f59e0b44] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#f59e0b] transition-colors" />
        </div>
        {kmNovo && parseInt(kmNovo) !== avto?.km_trenutni && (
          <div>
            <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Razlog spremembe <span className="text-[#f59e0b]">*</span></label>
            <input value={kmOpomba} onChange={e => setKmOpomba(e.target.value)} placeholder="npr. Napaka pri vnosu..."
              className="w-full bg-[#13131f] border border-[#f59e0b44] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#f59e0b] transition-colors" />
          </div>
        )}
      </div>

      {message && (
        <div className={`p-3 rounded-xl text-sm border mb-4 ${
          message.includes('✅') ? 'bg-[#16a34a22] border-[#16a34a44] text-[#4ade80]' : 'bg-[#ef444422] border-[#ef444444] text-[#fca5a5]'
        }`}>{message}</div>
      )}

      <button onClick={shrani} disabled={saving}
        className="w-full bg-[#6c63ff] hover:bg-[#5a52e0] text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50">
        {saving ? 'Shranjevanje...' : 'Shrani spremembe →'}
      </button>

      <HomeButton />
    </div>
  )
}