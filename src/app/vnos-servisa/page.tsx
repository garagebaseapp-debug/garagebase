'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { HomeButton, BackButton } from '@/lib/nav'

export default function VnosServisa() {
  const [datum, setDatum] = useState(new Date().toISOString().split('T')[0])
  const [km, setKm] = useState('')
  const [opis, setOpis] = useState('')
  const [servis, setServis] = useState('')
  const [cena, setCena] = useState('')
  const [carId, setCarId] = useState('')
  const [avti, setAvti] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/'; return }
      const params = new URLSearchParams(window.location.search)
      const carParam = params.get('car')
      const { data } = await supabase.from('cars').select('id, znamka, model').eq('user_id', user.id)
      if (data && data.length > 0) { setAvti(data); setCarId(carParam || data[0].id) }
    }
    init()
  }, [])

  const shrani = async () => {
    if (!km || !opis) { setMessage('Km in opis sta obvezna!'); return }
    setLoading(true)
    const { error } = await supabase.from('service_logs').insert({
      car_id: carId, datum, km: parseInt(km), opis,
      servis: servis || null, cena: cena ? parseFloat(cena) : null,
    })
    if (error) setMessage('Napaka: ' + error.message)
    else { setMessage('✅ Servis uspešno shranjen!'); setTimeout(() => window.location.href = `/zgodovina-servisa?car=${carId}`, 1000) }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#080810] px-4 py-6 max-w-md mx-auto pb-24">
      <div className="flex items-center gap-3 mb-8">
        <BackButton />
        <h1 className="text-xl font-bold text-white">🔧 Vnos servisa</h1>
      </div>

      <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-6 flex flex-col gap-4">
        {avti.length > 1 && (
          <div>
            <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Avto</label>
            <select value={carId} onChange={e => setCarId(e.target.value)}
              className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#f59e0b] transition-colors">
              {avti.map(a => <option key={a.id} value={a.id}>{a.znamka} {a.model}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Datum</label>
          <input type="date" value={datum} onChange={e => setDatum(e.target.value)}
            className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#f59e0b] transition-colors" />
        </div>
        <div>
          <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Kilometri *</label>
          <input type="number" value={km} onChange={e => setKm(e.target.value)} placeholder="npr. 54200"
            className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#f59e0b] transition-colors" />
        </div>
        <div>
          <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Opis dela *</label>
          <textarea value={opis} onChange={e => setOpis(e.target.value)} placeholder="npr. Menjava olja + filter" rows={3}
            className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#f59e0b] transition-colors resize-none" />
        </div>
        <div>
          <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Ime servisa (po želji)</label>
          <input type="text" value={servis} onChange={e => setServis(e.target.value)} placeholder="npr. Volvo Center Ljubljana"
            className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#f59e0b] transition-colors" />
        </div>
        <div>
          <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Cena (€)</label>
          <input type="number" step="0.01" value={cena} onChange={e => setCena(e.target.value)} placeholder="npr. 320"
            className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#f59e0b] transition-colors" />
        </div>
        {message && (
          <div className={`p-3 rounded-xl text-sm border ${
            message.includes('✅') ? 'bg-[#16a34a22] border-[#16a34a44] text-[#4ade80]' : 'bg-[#ef444422] border-[#ef444444] text-[#fca5a5]'
          }`}>{message}</div>
        )}
        <button onClick={shrani} disabled={loading}
          className="w-full bg-[#f59e0b] hover:bg-[#d97706] text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50 mt-2">
          {loading ? 'Shranjevanje...' : 'Shrani servis →'}
        </button>
      </div>
      <HomeButton />
    </div>
  )
}