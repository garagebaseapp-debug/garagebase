'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function VnosGoriva() {
  const [datum, setDatum] = useState(new Date().toISOString().split('T')[0])
  const [km, setKm] = useState('')
  const [litri, setLitri] = useState('')
  const [cenaNaLiter, setCenaNaLiter] = useState('')
  const [postaja, setPostaja] = useState('')
  const [carId, setCarId] = useState('')
  const [avti, setAvti] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  // Izračun skupne cene
  const cenaSkupaj = litri && cenaNaLiter
    ? (parseFloat(litri) * parseFloat(cenaNaLiter)).toFixed(2)
    : ''

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/'; return }

      const { data } = await supabase
        .from('cars')
        .select('id, znamka, model')
        .eq('user_id', user.id)

      if (data && data.length > 0) {
        setAvti(data)
        setCarId(data[0].id)
      }
    }
    init()
  }, [])

  const shrani = async () => {
    if (!km || !litri) {
      setMessage('Km in litri sta obvezna!')
      return
    }

    setLoading(true)
    setMessage('')

    const { error } = await supabase
      .from('fuel_logs')
      .insert({
        car_id: carId,
        datum,
        km: parseInt(km),
        litri: parseFloat(litri),
        cena_na_liter: cenaNaLiter ? parseFloat(cenaNaLiter) : null,
        cena_skupaj: cenaSkupaj ? parseFloat(cenaSkupaj) : null,
        postaja: postaja || null,
      })

    if (error) {
      setMessage('Napaka: ' + error.message)
    } else {
      setMessage('✅ Tankanje uspešno shranjeno!')
      setTimeout(() => window.location.href = '/dashboard', 1000)
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#080810] px-4 py-6 max-w-md mx-auto pb-24">

      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => window.location.href = '/dashboard'}
          className="text-[#5a5a80] hover:text-white text-lg">←</button>
        <h1 className="text-xl font-bold text-white">⛽ Vnos goriva</h1>
      </div>

      <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-6 flex flex-col gap-4">

        {/* Izbira avta */}
        {avti.length > 1 && (
          <div>
            <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Avto</label>
            <select value={carId} onChange={e => setCarId(e.target.value)}
              className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors">
              {avti.map(a => (
                <option key={a.id} value={a.id}>{a.znamka} {a.model}</option>
              ))}
            </select>
          </div>
        )}

        {/* Datum */}
        <div>
          <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Datum</label>
          <input type="date" value={datum} onChange={e => setDatum(e.target.value)}
            className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
        </div>

        {/* KM */}
        <div>
          <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Kilometri ob tankanju *</label>
          <input type="number" value={km} onChange={e => setKm(e.target.value)} placeholder="npr. 54200"
            className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
        </div>

        {/* Litri + Cena na liter */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Litri *</label>
            <input type="number" step="0.01" value={litri} onChange={e => setLitri(e.target.value)} placeholder="npr. 52.4"
              className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
          </div>
          <div>
            <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Cena/L (€)</label>
            <input type="number" step="0.001" value={cenaNaLiter} onChange={e => setCenaNaLiter(e.target.value)} placeholder="npr. 1.489"
              className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
          </div>
        </div>

        {/* Skupna cena — avtomatski izračun */}
        {cenaSkupaj && (
          <div className="bg-[#6c63ff22] border border-[#6c63ff44] rounded-xl px-4 py-3">
            <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-1">Skupna cena</p>
            <p className="text-white font-bold text-xl">{cenaSkupaj} €</p>
          </div>
        )}

        {/* Postaja */}
        <div>
          <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Postaja (po želji)</label>
          <input type="text" value={postaja} onChange={e => setPostaja(e.target.value)} placeholder="npr. OMV Ljubljana"
            className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
        </div>

        {/* Message */}
        {message && (
          <div className={`p-3 rounded-xl text-sm border ${
            message.includes('✅')
              ? 'bg-[#16a34a22] border-[#16a34a44] text-[#4ade80]'
              : 'bg-[#ef444422] border-[#ef444444] text-[#fca5a5]'
          }`}>
            {message}
          </div>
        )}

        {/* Gumb */}
        <button onClick={shrani} disabled={loading}
          className="w-full bg-[#6c63ff] hover:bg-[#5a52e0] text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50 mt-2">
          {loading ? 'Shranjevanje...' : 'Shrani tankanje →'}
        </button>

      </div>
    </div>
  )
}