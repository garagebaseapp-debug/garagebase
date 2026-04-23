'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function DodajAvto() {
  const [znamka, setZnamka] = useState('')
  const [model, setModel] = useState('')
  const [letnik, setLetnik] = useState('')
  const [gorivo, setGorivo] = useState('Bencin')
  const [barva, setBarva] = useState('')
  const [tablica, setTabla] = useState('')
  const [km, setKm] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const shrani = async () => {
    if (!znamka || !model) {
      setMessage('Znamka in model sta obvezna!')
      return
    }

    setLoading(true)
    setMessage('')

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      setMessage('Nisi prijavljen — preusmerjam...')
      setTimeout(() => window.location.href = '/', 1500)
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('cars')
      .insert({
        user_id: user.id,
        znamka,
        model,
        letnik: letnik ? parseInt(letnik) : null,
        gorivo,
        barva: barva || null,
        tablica: tablica || null,
        km_trenutni: km ? parseInt(km) : null,
      })
      .select()

    if (error) {
      setMessage('Napaka: ' + error.message)
    } else {
      setMessage('✅ Avto uspešno shranjen!')
      setTimeout(() => window.location.href = '/dashboard', 1000)
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#080810] px-4 py-6 max-w-md mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => window.location.href = '/dashboard'}
          className="text-[#5a5a80] hover:text-white text-lg">←</button>
        <h1 className="text-xl font-bold text-white">Dodaj avto</h1>
      </div>

      <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-6 flex flex-col gap-4">

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
            </select>
          </div>
        </div>

        <div>
          <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Trenutni km</label>
          <input value={km} onChange={e => setKm(e.target.value)} placeholder="npr. 54200" type="number"
            className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
        </div>

        <div>
          <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Registrska tablica (po želji)</label>
          <input value={tablica} onChange={e => setTabla(e.target.value)} placeholder="npr. LJ X9-MK1"
            className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
        </div>

        <div>
          <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Barva (po želji)</label>
          <input value={barva} onChange={e => setBarva(e.target.value)} placeholder="npr. Siva metalik"
            className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
        </div>

        {message && (
          <div className={`p-3 rounded-xl text-sm border ${
            message.includes('✅') 
              ? 'bg-[#16a34a22] border-[#16a34a44] text-[#4ade80]' 
              : 'bg-[#6c63ff22] border-[#6c63ff44] text-[#a09aff]'
          }`}>
            {message}
          </div>
        )}

        <button
          onClick={shrani}
          disabled={loading}
          className="w-full bg-[#6c63ff] hover:bg-[#5a52e0] text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50 mt-2"
        >
          {loading ? 'Shranjevanje...' : 'Shrani avto →'}
        </button>

      </div>
    </div>
  )
}