'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { HomeButton, BackButton } from '@/lib/nav'

export default function Opomniki() {
  const [avto, setAvto] = useState<any>(null)
  const [opomniki, setOpomniki] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [tip, setTip] = useState('registracija')
  const [tipCustom, setTipCustom] = useState('')
  const [datum, setDatum] = useState('')
  const [kmOpomnik, setKmOpomnik] = useState('')
  const [opozoriloDni, setOpozoriloDni] = useState('30')
  const [opozoriloDniCustom, setOpozoriloDniCustom] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [koledarPrioritete, setKoledarPrioritete] = useState<{ [key: string]: string }>({})

  const tipi = [
    { vrednost: 'registracija', ikona: '📋', naziv: 'Registracija' },
    { vrednost: 'vinjeta', ikona: '🛣️', naziv: 'Vinjeta' },
    { vrednost: 'tehnicni', ikona: '🔍', naziv: 'Tehnični pregled' },
    { vrednost: 'servis', ikona: '🔧', naziv: 'Servis' },
    { vrednost: 'zavarovanje', ikona: '🛡️', naziv: 'Zavarovanje' },
    { vrednost: 'gume', ikona: '⚫', naziv: 'Gume' },
    { vrednost: 'custom', ikona: '✏️', naziv: 'Drugo...' },
  ]

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/'; return }
      const params = new URLSearchParams(window.location.search)
      const carId = params.get('car')
      if (!carId) { window.location.href = '/garaza'; return }
      const { data: avtoData } = await supabase.from('cars').select('*').eq('id', carId).single()
      setAvto(avtoData)
      const { data: opData } = await supabase.from('reminders').select('*').eq('car_id', carId).order('datum', { ascending: true })
      setOpomniki(opData || [])
      setLoading(false)
    }
    init()
  }, [])

  const dniDo = (datum: string) => {
    if (!datum) return null
    return Math.ceil((new Date(datum).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
  }

  // Izračun preostalih km do opomnika
  const kmDo = (kmOpomnik: number) => {
    if (!avto?.km_trenutni) return null
    return kmOpomnik - avto.km_trenutni
  }

  // Barva glede na dni
  const barvaZaDni = (dni: number | null) => {
    if (dni === null) return { text: 'text-[#5a5a80]', bg: 'bg-[#13131f]', border: 'border-[#1e1e32]' }
    if (dni <= 7) return { text: 'text-[#ef4444]', bg: 'bg-[#ef444411]', border: 'border-[#ef444433]' }
    if (dni <= 30) return { text: 'text-[#f59e0b]', bg: 'bg-[#f59e0b11]', border: 'border-[#f59e0b33]' }
    return { text: 'text-[#3ecfcf]', bg: 'bg-[#3ecfcf11]', border: 'border-[#3ecfcf33]' }
  }

  // Barva glede na km
  const barvaZaKm = (preostaloKm: number | null) => {
    if (preostaloKm === null) return { text: 'text-[#5a5a80]', bg: 'bg-[#13131f]', border: 'border-[#1e1e32]' }
    if (preostaloKm <= 0) return { text: 'text-[#ef4444]', bg: 'bg-[#ef444411]', border: 'border-[#ef444433]' }
    if (preostaloKm <= 500) return { text: 'text-[#ef4444]', bg: 'bg-[#ef444411]', border: 'border-[#ef444433]' }
    if (preostaloKm <= 1500) return { text: 'text-[#f59e0b]', bg: 'bg-[#f59e0b11]', border: 'border-[#f59e0b33]' }
    return { text: 'text-[#3ecfcf]', bg: 'bg-[#3ecfcf11]', border: 'border-[#3ecfcf33]' }
  }

  // Skupna barva — vzame slabšo od datuma ali km
  const skupnaBarva = (dni: number | null, preostaloKm: number | null) => {
    const bdni = barvaZaDni(dni)
    const bkm = barvaZaKm(preostaloKm)
    // Rdeča ima prioriteto
    if (bdni.text === 'text-[#ef4444]' || bkm.text === 'text-[#ef4444]') {
      return { text: 'text-[#ef4444]', bg: 'bg-[#ef444411]', border: 'border-[#ef444433]' }
    }
    if (bdni.text === 'text-[#f59e0b]' || bkm.text === 'text-[#f59e0b]') {
      return { text: 'text-[#f59e0b]', bg: 'bg-[#f59e0b11]', border: 'border-[#f59e0b33]' }
    }
    return { text: 'text-[#3ecfcf]', bg: 'bg-[#3ecfcf11]', border: 'border-[#3ecfcf33]' }
  }

  const tipIkona: any = { registracija: '📋', vinjeta: '🛣️', tehnicni: '🔍', servis: '🔧', zavarovanje: '🛡️', gume: '⚫' }
  const tipNaziv: any = { registracija: 'Registracija', vinjeta: 'Vinjeta', tehnicni: 'Tehnični pregled', servis: 'Servis', zavarovanje: 'Zavarovanje', gume: 'Gume' }

  const shrani = async () => {
    if (!datum && !kmOpomnik) { setMessage('Vnesi datum ali km!'); return }
    if (tip === 'custom' && !tipCustom) { setMessage('Vnesi naziv opomnika!'); return }
    if (opozoriloDni === 'custom' && !opozoriloDniCustom) { setMessage('Vnesi število dni!'); return }

    setSaving(true)
    const finalniTip = tip === 'custom' ? tipCustom : tip
    const finalniDni = opozoriloDni === 'custom' ? parseInt(opozoriloDniCustom) : parseInt(opozoriloDni)

    const { error } = await supabase.from('reminders').insert({
      car_id: avto.id,
      tip: finalniTip,
      datum: datum || null,
      km_opomnik: kmOpomnik ? parseInt(kmOpomnik) : null,
      opozorilo_dni_prej: finalniDni,
    })

    if (error) { setMessage('Napaka: ' + error.message) }
    else {
      const { data } = await supabase.from('reminders').select('*').eq('car_id', avto.id).order('datum', { ascending: true })
      setOpomniki(data || [])
      setShowForm(false)
      setDatum(''); setKmOpomnik(''); setTipCustom(''); setOpozoriloDniCustom('')
      setTip('registracija'); setOpozoriloDni('30')
      setMessage('')
    }
    setSaving(false)
  }

  const izbrisiOpomnik = async (id: string) => {
    await supabase.from('reminders').delete().eq('id', id)
    setOpomniki(opomniki.filter(o => o.id !== id))
  }

  const escapeIcs = (value: string) => String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')

  const formatIcsDate = (value: string) => value.replace(/-/g, '')

  const prenesiKoledar = (op: any) => {
    if (!op.datum) {
      setMessage('Za koledar mora imeti opomnik datum.')
      return
    }

    const naziv = tipNaziv[op.tip] || op.tip
    const avtoNaziv = `${avto?.znamka || ''} ${avto?.model || ''}`.trim()
    const prioriteta = koledarPrioritete[op.id] || '5'
    const start = formatIcsDate(op.datum)
    const uid = `garagebase-${op.id}@getgaragebase.com`
    const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    const opis = [
      `Vozilo: ${avtoNaziv}`,
      op.km_opomnik ? `Km opomnik: ${op.km_opomnik.toLocaleString()} km` : '',
      `Opozori ${op.opozorilo_dni_prej || 30} dni prej`,
      'Ustvarjeno v GarageBase'
    ].filter(Boolean).join('\\n')

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//GarageBase//Opomniki//SL',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${start}`,
      `SUMMARY:${escapeIcs(`${naziv} - ${avtoNaziv}`)}`,
      `DESCRIPTION:${escapeIcs(opis)}`,
      `PRIORITY:${prioriteta}`,
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n')

    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `garagebase-${naziv}-${avtoNaziv}`.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.ics'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  if (loading) return (
    <div className="min-h-screen bg-[#080810] flex items-center justify-center">
      <p className="text-[#5a5a80]">Nalaganje...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#080810] px-4 py-6 pb-24">

      <div className="flex items-center gap-3 mb-6">
        <BackButton />
        <div>
          <h1 className="text-xl font-bold text-white">🔔 Opomniki</h1>
          {avto && <p className="text-[#5a5a80] text-xs">{avto.znamka} {avto.model} · {avto.km_trenutni?.toLocaleString()} km</p>}
        </div>
      </div>

      {/* Seznam opomnikov */}
      {opomniki.length > 0 && (
        <div className="flex flex-col gap-3 mb-4">
          {opomniki.map((op) => {
            const dni = dniDo(op.datum)
            const preostaloKm = op.km_opomnik ? kmDo(op.km_opomnik) : null
            const b = skupnaBarva(dni, preostaloKm)

            return (
              <div key={op.id} className={`${b.bg} border ${b.border} rounded-2xl p-4`}>
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{tipIkona[op.tip] || '🔔'}</span>
                    <div>
                      <p className="text-white font-semibold">{tipNaziv[op.tip] || op.tip}</p>
                      <p className="text-[#3a3a5a] text-xs mt-0.5">opozori {op.opozorilo_dni_prej} dni prej</p>
                    </div>
                  </div>
                  <button onClick={() => izbrisiOpomnik(op.id)}
                    className="w-8 h-8 rounded-lg bg-[#ef444422] border border-[#ef444433] flex items-center justify-center text-[#ef4444] hover:bg-[#ef444444] transition-colors text-xs flex-shrink-0">
                    ✕
                  </button>
                </div>

                {/* Datumski prikaz */}
                {op.datum && (
                  <div className={`mt-3 flex justify-between items-center p-3 rounded-xl ${barvaZaDni(dni).bg} border ${barvaZaDni(dni).border}`}>
                    <div>
                      <p className="text-[#5a5a80] text-xs uppercase tracking-wider">📅 Datum poteka</p>
                      <p className="text-white text-sm font-semibold mt-0.5">{new Date(op.datum).toLocaleDateString('sl-SI')}</p>
                    </div>
                    {dni !== null && (
                      <div className="text-right">
                        {dni >= 0 ? (
                          <>
                            <p className={`${barvaZaDni(dni).text} font-bold text-2xl leading-none`}>{dni}</p>
                            <p className="text-[#5a5a80] text-xs">dni</p>
                          </>
                        ) : (
                          <>
                            <p className="text-[#ef4444] font-bold text-2xl leading-none">+{Math.abs(dni)}</p>
                            <p className="text-[#ef4444] text-xs">dni zamude</p>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Km prikaz */}
                {op.km_opomnik && preostaloKm !== null && (
                  <div className={`mt-2 flex justify-between items-center p-3 rounded-xl ${barvaZaKm(preostaloKm).bg} border ${barvaZaKm(preostaloKm).border}`}>
                    <div>
                      <p className="text-[#5a5a80] text-xs uppercase tracking-wider">🛣️ Km opomnik</p>
                      <p className="text-white text-sm font-semibold mt-0.5">pri {op.km_opomnik.toLocaleString()} km</p>
                    </div>
                    <div className="text-right">
                      {preostaloKm >= 0 ? (
                        <>
                          <p className={`${barvaZaKm(preostaloKm).text} font-bold text-2xl leading-none`}>{preostaloKm.toLocaleString()}</p>
                          <p className="text-[#5a5a80] text-xs">km še</p>
                        </>
                      ) : (
                        <>
                          <p className="text-[#ef4444] font-bold text-2xl leading-none">+{Math.abs(preostaloKm).toLocaleString()}</p>
                          <p className="text-[#ef4444] text-xs">km prekoračeno</p>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {op.datum && (
                  <div className="mt-3 grid grid-cols-[1fr_auto] gap-2 items-center">
                    <select
                      value={koledarPrioritete[op.id] || '5'}
                      onChange={(e) => setKoledarPrioritete(prev => ({ ...prev, [op.id]: e.target.value }))}
                      className="bg-[#13131f] border border-[#1e1e32] text-[#5a5a80] text-xs rounded-xl px-3 py-2 outline-none focus:border-[#6c63ff]">
                      <option value="9">Nizka prioriteta</option>
                      <option value="5">Srednja prioriteta</option>
                      <option value="1">Visoka prioriteta</option>
                    </select>
                    <button onClick={() => prenesiKoledar(op)}
                      className="bg-[#6c63ff22] border border-[#6c63ff66] text-[#a09aff] text-xs font-semibold px-3 py-2 rounded-xl hover:bg-[#6c63ff33] transition-colors">
                      Koledar
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Forma */}
      {showForm && (
        <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5 mb-4 flex flex-col gap-4">
          <h2 className="text-white font-semibold">Dodaj opomnik</h2>

          <div>
            <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-3 block">Tip</label>
            <div className="grid grid-cols-4 gap-2">
              {tipi.map((t) => (
                <button key={t.vrednost} type="button"
                  onClick={() => setTip(t.vrednost)}
                  className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition-all ${
                    tip === t.vrednost
                      ? 'bg-[#6c63ff22] border-[#6c63ff66] text-[#a09aff]'
                      : 'bg-[#13131f] border-[#1e1e32] text-[#5a5a80] hover:border-[#6c63ff33]'
                  }`}>
                  <span className="text-lg">{t.ikona}</span>
                  <span className="text-[8px] uppercase tracking-wider text-center leading-tight">{t.naziv}</span>
                </button>
              ))}
            </div>
          </div>

          {tip === 'custom' && (
            <div>
              <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Naziv opomnika *</label>
              <input type="text" value={tipCustom} onChange={e => setTipCustom(e.target.value)}
                placeholder="npr. Menjava žarnic..."
                className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
            </div>
          )}

          <div>
            <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Datum poteka</label>
            <input type="date" value={datum} onChange={e => setDatum(e.target.value)}
              className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
          </div>

          <div>
            <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">
              Km opomnik <span className="text-[#3a3a5a] normal-case">(trenutni: {avto?.km_trenutni?.toLocaleString()} km)</span>
            </label>
            <input type="number" value={kmOpomnik} onChange={e => setKmOpomnik(e.target.value)}
              placeholder={`npr. ${(avto?.km_trenutni || 0) + 15000}`}
              className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
          </div>

          <div>
            <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Opozori X dni prej</label>
            <div className="grid grid-cols-5 gap-2">
              {['7', '14', '30', '60', 'custom'].map((d) => (
                <button key={d} type="button"
                  onClick={() => setOpozoriloDni(d)}
                  className={`py-2 rounded-xl text-sm font-semibold border transition-all ${
                    opozoriloDni === d
                      ? 'bg-[#6c63ff22] border-[#6c63ff66] text-[#a09aff]'
                      : 'bg-[#13131f] border-[#1e1e32] text-[#5a5a80] hover:border-[#6c63ff33]'
                  }`}>
                  {d === 'custom' ? '✏️' : d}
                </button>
              ))}
            </div>
            {opozoriloDni === 'custom' && (
              <input type="number" value={opozoriloDniCustom} onChange={e => setOpozoriloDniCustom(e.target.value)}
                placeholder="npr. 45"
                className="w-full mt-2 bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
            )}
          </div>

          {message && <div className="p-3 rounded-xl text-sm border bg-[#ef444422] border-[#ef444444] text-[#fca5a5]">{message}</div>}

          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => { setShowForm(false); setMessage('') }}
              className="bg-[#13131f] border border-[#1e1e32] text-[#5a5a80] py-3 rounded-xl text-sm">
              Prekliči
            </button>
            <button onClick={shrani} disabled={saving}
              className="bg-[#6c63ff] hover:bg-[#5a52e0] text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50 text-sm">
              {saving ? 'Shranjujem...' : 'Shrani'}
            </button>
          </div>
        </div>
      )}

      {!showForm && (
        <button onClick={() => setShowForm(true)}
          className="w-full bg-[#6c63ff] hover:bg-[#5a52e0] text-white font-semibold py-3 rounded-xl transition-colors">
          + Dodaj opomnik
        </button>
      )}

      {opomniki.length === 0 && !showForm && (
        <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-6 text-center mt-4">
          <p className="text-4xl mb-3">🔔</p>
          <p className="text-white font-semibold mb-1">Še ni opomnikov</p>
          <p className="text-[#5a5a80] text-sm">Dodaj registracijo, vinjeto ali drug opomnik</p>
        </div>
      )}

      <HomeButton />
    </div>
  )
}