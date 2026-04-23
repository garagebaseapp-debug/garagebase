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
  const [datum, setDatum] = useState('')
  const [kmOpomnik, setKmOpomnik] = useState('')
  const [opozoriloDni, setOpozoriloDni] = useState('30')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

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

  const barva = (dni: number | null) => {
    if (dni === null) return { text: 'text-[#5a5a80]', bg: 'bg-[#13131f]', border: 'border-[#1e1e32]' }
    if (dni <= 7) return { text: 'text-[#ef4444]', bg: 'bg-[#ef444411]', border: 'border-[#ef444433]' }
    if (dni <= 30) return { text: 'text-[#f59e0b]', bg: 'bg-[#f59e0b11]', border: 'border-[#f59e0b33]' }
    return { text: 'text-[#3ecfcf]', bg: 'bg-[#3ecfcf11]', border: 'border-[#3ecfcf33]' }
  }

  const tipIkona: any = { registracija: '📋', vinjeta: '🛣️', tehnicni: '🔍', servis: '🔧', zavarovanje: '🛡️' }
  const tipNaziv: any = { registracija: 'Registracija', vinjeta: 'Vinjeta', tehnicni: 'Tehnični pregled', servis: 'Servis', zavarovanje: 'Zavarovanje' }

  const shrani = async () => {
    if (!datum && !kmOpomnik) { setMessage('Vnesi datum ali km!'); return }
    setSaving(true)
    const { error } = await supabase.from('reminders').insert({
      car_id: avto.id, tip, datum: datum || null,
      km_opomnik: kmOpomnik ? parseInt(kmOpomnik) : null,
      opozorilo_dni_prej: parseInt(opozoriloDni),
    })
    if (error) { setMessage('Napaka: ' + error.message) }
    else {
      const { data } = await supabase.from('reminders').select('*').eq('car_id', avto.id).order('datum', { ascending: true })
      setOpomniki(data || [])
      setShowForm(false); setDatum(''); setKmOpomnik(''); setMessage('')
    }
    setSaving(false)
  }

  if (loading) return <div className="min-h-screen bg-[#080810] flex items-center justify-center"><p className="text-[#5a5a80]">Nalaganje...</p></div>

  return (
    <div className="min-h-screen bg-[#080810] px-4 py-6 pb-24">
      <div className="flex items-center gap-3 mb-6">
        <BackButton />
        <div>
          <h1 className="text-xl font-bold text-white">🔔 Opomniki</h1>
          {avto && <p className="text-[#5a5a80] text-xs">{avto.znamka} {avto.model}</p>}
        </div>
      </div>

      {opomniki.length === 0 && !showForm ? (
        <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-6 text-center mb-4">
          <p className="text-4xl mb-3">🔔</p>
          <p className="text-white font-semibold mb-1">Še ni opomnikov</p>
          <p className="text-[#5a5a80] text-sm">Dodaj registracijo, vinjeto ali tehnični pregled</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 mb-4">
          {opomniki.map((op) => {
            const dni = dniDo(op.datum)
            const b = barva(dni)
            return (
              <div key={op.id} className={`${b.bg} border ${b.border} rounded-2xl p-4 flex justify-between items-center`}>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{tipIkona[op.tip] || '🔔'}</span>
                  <div>
                    <p className="text-white font-semibold">{tipNaziv[op.tip] || op.tip}</p>
                    {op.datum && <p className="text-[#5a5a80] text-xs mt-1">{new Date(op.datum).toLocaleDateString('sl-SI')}</p>}
                    {op.km_opomnik && <p className="text-[#5a5a80] text-xs">pri {op.km_opomnik.toLocaleString()} km</p>}
                  </div>
                </div>
                {dni !== null && (
                  <div className="text-right">
                    <p className={`${b.text} font-bold text-2xl`}>{dni}</p>
                    <p className="text-[#5a5a80] text-xs">dni</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showForm && (
        <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5 mb-4 flex flex-col gap-4">
          <h2 className="text-white font-semibold">Dodaj opomnik</h2>
          <div>
            <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Tip</label>
            <select value={tip} onChange={e => setTip(e.target.value)}
              className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors">
              <option value="registracija">📋 Registracija</option>
              <option value="vinjeta">🛣️ Vinjeta</option>
              <option value="tehnicni">🔍 Tehnični pregled</option>
              <option value="servis">🔧 Servis</option>
              <option value="zavarovanje">🛡️ Zavarovanje</option>
            </select>
          </div>
          <div>
            <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Datum poteka</label>
            <input type="date" value={datum} onChange={e => setDatum(e.target.value)}
              className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
          </div>
          <div>
            <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Ali pri km</label>
            <input type="number" value={kmOpomnik} onChange={e => setKmOpomnik(e.target.value)} placeholder="npr. 60000"
              className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
          </div>
          <div>
            <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Opozori X dni prej</label>
            <select value={opozoriloDni} onChange={e => setOpozoriloDni(e.target.value)}
              className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors">
              <option value="7">7 dni prej</option>
              <option value="14">14 dni prej</option>
              <option value="30">30 dni prej</option>
              <option value="60">60 dni prej</option>
            </select>
          </div>
          {message && <div className="p-3 rounded-xl text-sm border bg-[#ef444422] border-[#ef444444] text-[#fca5a5]">{message}</div>}
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setShowForm(false)} className="bg-[#13131f] border border-[#1e1e32] text-[#5a5a80] py-3 rounded-xl text-sm">Prekliči</button>
            <button onClick={shrani} disabled={saving} className="bg-[#6c63ff] hover:bg-[#5a52e0] text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50 text-sm">
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

      <HomeButton />
    </div>
  )
}