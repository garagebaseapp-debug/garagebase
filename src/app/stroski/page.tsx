'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { HomeButton, BackButton } from '@/lib/nav'

export default function Stroski() {
  const [avto, setAvto] = useState<any>(null)
  const [gorivo, setGorivo] = useState<any[]>([])
  const [servisi, setServisi] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'vse' | 'gorivo' | 'servis' | 'ostalo'>('vse')
  const [grafTip, setGrafTip] = useState<'stolpci' | 'crta' | 'kolac'>('stolpci')
  const [uredi, setUredi] = useState<string | null>(null)
  const [editData, setEditData] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [cas, setCas] = useState(Date.now())

  useEffect(() => {
    const init = async () => {
      const params = new URLSearchParams(window.location.search)
      const carId = params.get('car')
      if (!carId) { window.location.href = '/stroski-garaza'; return }

      const cachedGarage = localStorage.getItem('garagebase_garaza_cache')
      if (cachedGarage) {
        try {
          const parsed = JSON.parse(cachedGarage)
          const cachedCar = parsed.avti?.find((a: any) => a.id === carId)
          if (cachedCar) {
            setAvto(cachedCar)
            setLoading(false)
          }
        } catch {}
      }

      const cached = localStorage.getItem(`garagebase_stroski_cache_${carId}`)
      if (cached) {
        try {
          const parsed = JSON.parse(cached)
          if (Array.isArray(parsed.gorivo)) setGorivo(parsed.gorivo)
          if (Array.isArray(parsed.servisi)) setServisi(parsed.servisi)
          if (Array.isArray(parsed.expenses)) setExpenses(parsed.expenses)
        } catch {}
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/'; return }
      const started = performance.now()
      const [avtoRes, gorivoRes, servisRes, expensesRes] = await Promise.all([
        supabase.from('cars').select('*').eq('id', carId).single(),
        supabase.from('fuel_logs').select('*').eq('car_id', carId).order('datum', { ascending: true }),
        supabase.from('service_logs').select('*').eq('car_id', carId).order('datum', { ascending: true }),
        supabase.from('expenses').select('*').eq('car_id', carId).order('datum', { ascending: true }),
      ])
      setAvto(avtoRes.data)
      const gorivoData = gorivoRes.data || []
      const servisData = servisRes.data || []
      const expensesData = (expensesRes.data || []).filter((e: any) => e.kategorija !== 'km_sprememba')
      setGorivo(gorivoData)
      setServisi(servisData)
      setExpenses(expensesData)
      localStorage.setItem(`garagebase_stroski_cache_${carId}`, JSON.stringify({ gorivo: gorivoData, servisi: servisData, expenses: expensesData, savedAt: Date.now() }))
      console.info(`[GarageBase speed] stroski detail ${Math.round(performance.now() - started)}ms`)
      setLoading(false)
    }
    init()
    const timer = setInterval(() => setCas(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  const preostaliCas = (createdAt: string) => {
    const ustvarjen = new Date(createdAt).getTime()
    const konec = ustvarjen + 24 * 60 * 60 * 1000
    const preostalo = konec - cas
    if (preostalo <= 0) return null
    const ure = Math.floor(preostalo / (1000 * 60 * 60))
    const minute = Math.floor((preostalo % (1000 * 60 * 60)) / (1000 * 60))
    const sekunde = Math.floor((preostalo % (1000 * 60)) / 1000)
    return `${ure}:${String(minute).padStart(2, '0')}:${String(sekunde).padStart(2, '0')}`
  }

  const skupajGorivo = gorivo.reduce((sum, v) => sum + (v.cena_skupaj || 0), 0)
  const skupajServis = servisi.reduce((sum, v) => sum + (v.cena || 0), 0)
  const skupajExpenses = expenses.reduce((sum, v) => sum + (v.znesek || 0), 0)
  const skupajVse = skupajGorivo + skupajServis + skupajExpenses
  const kmPrevozeni = avto?.km_trenutni || 0
  const strosekNaKm = kmPrevozeni > 0 ? (skupajVse / kmPrevozeni).toFixed(3) : null

  const kategorijaIkona: { [key: string]: string } = {
    registracija: '📋', vinjeta: '🛣️', zavarovanje: '🛡️', gume: '⚫',
    tehnicni: '🔍', izredno: '🔨', lizing: '🏦'
  }

  const grafMeseci = () => {
    const meseci: { kljuc: string, label: string, gorivo: number, servis: number, ostalo: number }[] = []
    const danes = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(danes.getFullYear(), danes.getMonth() - i, 1)
      const kljuc = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      meseci.push({ kljuc, label: d.toLocaleDateString('sl-SI', { month: 'short' }), gorivo: 0, servis: 0, ostalo: 0 })
    }
    gorivo.forEach(v => { if (!v.datum || !v.cena_skupaj) return; const m = meseci.find(m => m.kljuc === v.datum.substring(0, 7)); if (m) m.gorivo += v.cena_skupaj })
    servisi.forEach(v => { if (!v.datum || !v.cena) return; const m = meseci.find(m => m.kljuc === v.datum.substring(0, 7)); if (m) m.servis += v.cena })
    expenses.forEach(v => { if (!v.datum || !v.znesek) return; const m = meseci.find(m => m.kljuc === v.datum.substring(0, 7)); if (m) m.ostalo += v.znesek })
    return meseci
  }

  const meseci = grafMeseci()
  const maxVrednost = Math.max(...meseci.map(m => m.gorivo + m.servis + m.ostalo), 1)

  const GrafStolpci = () => (
    <div className="flex items-end justify-between gap-1.5 h-36 px-1">
      {meseci.map((m, i) => {
        const skupaj = m.gorivo + m.servis + m.ostalo
        const visina = skupaj > 0 ? (skupaj / maxVrednost) * 100 : 0
        const gorivoH = skupaj > 0 ? (m.gorivo / skupaj) * visina : 0
        const servisH = skupaj > 0 ? (m.servis / skupaj) * visina : 0
        const ostaloH = skupaj > 0 ? (m.ostalo / skupaj) * visina : 0
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full flex flex-col justify-end rounded-lg overflow-hidden" style={{ height: '110px' }}>
              {skupaj === 0 ? <div className="w-full bg-[#1e1e32] rounded-lg" style={{ height: '4px' }} /> : (
                <div className="w-full flex flex-col justify-end" style={{ height: '100%' }}>
                  <div style={{ height: `${ostaloH}%` }} className="bg-[#6c63ff] w-full" />
                  <div style={{ height: `${servisH}%` }} className="bg-[#f59e0b] w-full" />
                  <div style={{ height: `${gorivoH}%` }} className="bg-[#3ecfcf] w-full rounded-t-sm" />
                </div>
              )}
            </div>
            <p className="text-[#5a5a80] text-[9px] uppercase">{m.label}</p>
            {skupaj > 0 && <p className="text-white text-[8px] font-bold">{skupaj.toFixed(0)}€</p>}
          </div>
        )
      })}
    </div>
  )

  const GrafCrta = () => {
    const w = 300, h = 110, pad = 10
    const tocke = meseci.map((m, i) => {
      const skupaj = m.gorivo + m.servis + m.ostalo
      const x = pad + (i / (meseci.length - 1)) * (w - pad * 2)
      const y = h - pad - (skupaj / maxVrednost) * (h - pad * 2)
      return { x, y, skupaj, label: m.label }
    })
    const path = tocke.map((t, i) => `${i === 0 ? 'M' : 'L'} ${t.x} ${t.y}`).join(' ')
    const fill = `${path} L ${tocke[tocke.length - 1].x} ${h} L ${tocke[0].x} ${h} Z`
    return (
      <div className="w-full">
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: '110px' }}>
          <defs><linearGradient id="gradCrta" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6c63ff" stopOpacity="0.4" /><stop offset="100%" stopColor="#6c63ff" stopOpacity="0" /></linearGradient></defs>
          <path d={fill} fill="url(#gradCrta)" />
          <path d={path} fill="none" stroke="#6c63ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {tocke.map((t, i) => (<g key={i}><circle cx={t.x} cy={t.y} r="3" fill="#6c63ff" />{t.skupaj > 0 && <text x={t.x} y={t.y - 8} textAnchor="middle" fill="white" fontSize="7" fontWeight="bold">{t.skupaj.toFixed(0)}€</text>}</g>))}
        </svg>
        <div className="flex justify-between px-2 mt-1">{meseci.map((m, i) => <p key={i} className="text-[#5a5a80] text-[9px] uppercase">{m.label}</p>)}</div>
      </div>
    )
  }

  const GrafKolac = () => {
    if (skupajVse === 0) return <div className="flex items-center justify-center h-36"><p className="text-[#5a5a80] text-sm">Ni podatkov</p></div>
    const r = 45, cx = 60, cy = 60
    const segments = [{ vrednost: skupajGorivo, barva: '#3ecfcf', naziv: 'Gorivo' }, { vrednost: skupajServis, barva: '#f59e0b', naziv: 'Servis' }, { vrednost: skupajExpenses, barva: '#6c63ff', naziv: 'Ostalo' }].filter(s => s.vrednost > 0)
    let kot = -90
    const poti = segments.map(s => {
      const delež = s.vrednost / skupajVse
      const kotKonec = kot + delež * 360
      const x1 = cx + r * Math.cos((kot * Math.PI) / 180), y1 = cy + r * Math.sin((kot * Math.PI) / 180)
      const x2 = cx + r * Math.cos((kotKonec * Math.PI) / 180), y2 = cy + r * Math.sin((kotKonec * Math.PI) / 180)
      const pot = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${delež > 0.5 ? 1 : 0} 1 ${x2} ${y2} Z`
      kot = kotKonec
      return { ...s, pot, delež }
    })
    return (
      <div className="flex items-center gap-4">
        <svg viewBox="0 0 120 120" style={{ width: '120px', height: '120px', flexShrink: 0 }}>
          {poti.map((p, i) => <path key={i} d={p.pot} fill={p.barva} stroke="#080810" strokeWidth="2" />)}
          <circle cx={cx} cy={cy} r="22" fill="#0f0f1a" />
          <text x={cx} y={cy - 4} textAnchor="middle" fill="white" fontSize="8" fontWeight="bold">{skupajVse.toFixed(0)}</text>
          <text x={cx} y={cy + 7} textAnchor="middle" fill="#5a5a80" fontSize="6">EUR</text>
        </svg>
        <div className="flex flex-col gap-2 flex-1">
          {poti.map((p, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.barva }} /><p className="text-[#5a5a80] text-xs">{p.naziv}</p></div>
              <div className="text-right"><p className="text-white text-xs font-bold">{p.vrednost.toFixed(0)} €</p><p className="text-[#5a5a80] text-[9px]">{(p.delež * 100).toFixed(0)}%</p></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const shraniUrediGorivo = async (id: string) => {
    setSaving(true)
    await supabase.from('fuel_logs').update({
      datum: editData.datum,
      litri: parseFloat(editData.litri),
      cena_na_liter: editData.cena_na_liter ? parseFloat(editData.cena_na_liter) : null,
      cena_skupaj: editData.litri && editData.cena_na_liter ? parseFloat(editData.litri) * parseFloat(editData.cena_na_liter) : null,
      postaja: editData.postaja || null,
    }).eq('id', id)
    const { data } = await supabase.from('fuel_logs').select('*').eq('car_id', avto.id).order('datum', { ascending: true })
    setGorivo(data || [])
    setUredi(null)
    setSaving(false)
  }

  const shraniUrediServis = async (id: string) => {
    setSaving(true)
    await supabase.from('service_logs').update({
      datum: editData.datum,
      opis: editData.opis,
      servis: editData.servis || null,
      cena: editData.cena ? parseFloat(editData.cena) : null,
    }).eq('id', id)
    const { data } = await supabase.from('service_logs').select('*').eq('car_id', avto.id).order('datum', { ascending: true })
    setServisi(data || [])
    setUredi(null)
    setSaving(false)
  }

  const shraniUrediExpense = async (id: string) => {
    setSaving(true)
    await supabase.from('expenses').update({
      datum: editData.datum,
      opis: editData.opis || null,
      znesek: editData.znesek ? parseFloat(editData.znesek) : null,
    }).eq('id', id)
    const { data } = await supabase.from('expenses').select('*').eq('car_id', avto.id).order('datum', { ascending: true })
    setExpenses((data || []).filter((e: any) => e.kategorija !== 'km_sprememba'))
    setUredi(null)
    setSaving(false)
  }

  const vsiVnosi = [
    ...gorivo.map(v => ({ ...v, _tip: 'gorivo' })),
    ...servisi.map(v => ({ ...v, _tip: 'servis' })),
    ...expenses.map(v => ({ ...v, _tip: 'ostalo' })),
  ].sort((a, b) => new Date(b.datum).getTime() - new Date(a.datum).getTime())

  const filtrirani = vsiVnosi.filter(v => filter === 'vse' || v._tip === filter)

  return (
    <div className="min-h-screen bg-[#080810] px-4 py-6 pb-24">

      <div className="flex items-center gap-3 mb-6">
        <BackButton href="/stroski-garaza" />
        <div>
          <h1 className="text-xl font-bold text-white">📊 Stroški</h1>
          {avto && <p className="text-[#5a5a80] text-xs">{avto.znamka} {avto.model}</p>}
        </div>
      </div>

      <div className="bg-[#0f0f1a] border border-[#6c63ff44] rounded-2xl p-6 mb-4">
        <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2">Skupni stroški</p>
        <p className="text-white font-bold text-4xl mb-1">{skupajVse.toFixed(2)} €</p>
        {strosekNaKm && <p className="text-[#5a5a80] text-sm">{strosekNaKm} €/km · {kmPrevozeni.toLocaleString()} km skupaj</p>}
      </div>

      <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-4 mb-4">
        <div className="flex justify-between items-center mb-4">
          <p className="text-[#5a5a80] text-xs uppercase tracking-wider">{grafTip === 'kolac' ? 'Razmerje stroškov' : 'Zadnjih 6 mesecev'}</p>
          <div className="flex gap-1 bg-[#13131f] rounded-xl p-1">
            <button onClick={() => setGrafTip('stolpci')} className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${grafTip === 'stolpci' ? 'bg-[#6c63ff] text-white' : 'text-[#5a5a80] hover:text-white'}`}>▌▌▌</button>
            <button onClick={() => setGrafTip('crta')} className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${grafTip === 'crta' ? 'bg-[#6c63ff] text-white' : 'text-[#5a5a80] hover:text-white'}`}>╱╱</button>
            <button onClick={() => setGrafTip('kolac')} className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${grafTip === 'kolac' ? 'bg-[#6c63ff] text-white' : 'text-[#5a5a80] hover:text-white'}`}>◉</button>
          </div>
        </div>
        {grafTip === 'stolpci' && <GrafStolpci />}
        {grafTip === 'crta' && <GrafCrta />}
        {grafTip === 'kolac' && <GrafKolac />}
        {grafTip !== 'kolac' && (
          <div className="flex gap-4 mt-3 pt-3 border-t border-[#1e1e32]">
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#3ecfcf]" /><p className="text-[#5a5a80] text-[10px]">Gorivo</p></div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" /><p className="text-[#5a5a80] text-[10px]">Servis</p></div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#6c63ff]" /><p className="text-[#5a5a80] text-[10px]">Ostalo</p></div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <button onClick={() => setFilter(filter === 'gorivo' ? 'vse' : 'gorivo')} className={`rounded-2xl p-3 border transition-all text-left ${filter === 'gorivo' ? 'bg-[#3ecfcf22] border-[#3ecfcf66]' : 'bg-[#0f0f1a] border-[#1e1e32]'}`}>
          <p className="text-2xl mb-2">⛽</p>
          <p className={`text-xs uppercase tracking-wider mb-1 ${filter === 'gorivo' ? 'text-[#3ecfcf]' : 'text-[#5a5a80]'}`}>Gorivo</p>
          <p className={`font-bold text-lg ${filter === 'gorivo' ? 'text-[#3ecfcf]' : 'text-white'}`}>{skupajGorivo.toFixed(0)} €</p>
          <p className="text-[#5a5a80] text-xs">{gorivo.length}x</p>
        </button>
        <button onClick={() => setFilter(filter === 'servis' ? 'vse' : 'servis')} className={`rounded-2xl p-3 border transition-all text-left ${filter === 'servis' ? 'bg-[#f59e0b22] border-[#f59e0b66]' : 'bg-[#0f0f1a] border-[#1e1e32]'}`}>
          <p className="text-2xl mb-2">🔧</p>
          <p className={`text-xs uppercase tracking-wider mb-1 ${filter === 'servis' ? 'text-[#f59e0b]' : 'text-[#5a5a80]'}`}>Servisi</p>
          <p className={`font-bold text-lg ${filter === 'servis' ? 'text-[#f59e0b]' : 'text-white'}`}>{skupajServis.toFixed(0)} €</p>
          <p className="text-[#5a5a80] text-xs">{servisi.length}x</p>
        </button>
        <button onClick={() => setFilter(filter === 'ostalo' ? 'vse' : 'ostalo')} className={`rounded-2xl p-3 border transition-all text-left ${filter === 'ostalo' ? 'bg-[#6c63ff22] border-[#6c63ff66]' : 'bg-[#0f0f1a] border-[#1e1e32]'}`}>
          <p className="text-2xl mb-2">💰</p>
          <p className={`text-xs uppercase tracking-wider mb-1 ${filter === 'ostalo' ? 'text-[#a09aff]' : 'text-[#5a5a80]'}`}>Ostalo</p>
          <p className={`font-bold text-lg ${filter === 'ostalo' ? 'text-[#a09aff]' : 'text-white'}`}>{skupajExpenses.toFixed(0)} €</p>
          <p className="text-[#5a5a80] text-xs">{expenses.length}x</p>
        </button>
      </div>

      <button onClick={() => window.location.href = `/vnos-stroska?car=${avto?.id}`}
        className="w-full bg-[#3ecfcf] hover:bg-[#2eb8b8] text-black font-semibold py-3 rounded-xl transition-colors mb-4">
        + Dodaj strošek
      </button>

      {filter !== 'vse' && (
        <div className="flex items-center justify-between mb-3">
          <p className="text-[#5a5a80] text-xs uppercase tracking-wider">Filtrirano: {filter === 'gorivo' ? '⛽ Gorivo' : filter === 'servis' ? '🔧 Servisi' : '💰 Ostalo'}</p>
          <button onClick={() => setFilter('vse')} className="text-[#6c63ff] text-xs">Počisti filter ✕</button>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {filtrirani.length === 0 ? (
          <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-6 text-center">
            <p className="text-white font-semibold mb-1">Ni vnosov</p>
          </div>
        ) : (
          filtrirani.map((v) => {
            const preostalo = preostaliCas(v.created_at)
            const jeUredi = uredi === v.id

            if (v._tip === 'gorivo') return (
              <div key={`g-${v.id}`} className="bg-[#0f0f1a] border border-[#1e1e32] rounded-xl p-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">⛽</span>
                    <div>
                      <p className="text-white text-sm font-semibold">{new Date(v.datum).toLocaleDateString('sl-SI')}</p>
                      <p className="text-[#5a5a80] text-xs">{v.litri} L · {v.km?.toLocaleString()} km{v.postaja ? ` · ${v.postaja}` : ''}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <p className="text-[#3ecfcf] font-semibold">{v.cena_skupaj?.toFixed(2) || '—'} €</p>
                    {preostalo && !jeUredi && (
                      <button onClick={() => { setUredi(v.id); setEditData({ datum: v.datum, litri: v.litri?.toString(), cena_na_liter: v.cena_na_liter?.toString(), postaja: v.postaja || '' }) }}
                        className="flex items-center gap-1 bg-[#f59e0b22] border border-[#f59e0b44] text-[#f59e0b] text-[10px] font-semibold px-2 py-1 rounded-lg">
                        ✏️ Uredi · {preostalo}
                      </button>
                    )}
                  </div>
                </div>
                {jeUredi && (
                  <div className="flex flex-col gap-3 mt-3 pt-3 border-t border-[#1e1e32]">
                    <p className="text-[#f59e0b] text-xs font-semibold">✏️ Urejanje · še {preostalo}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[#5a5a80] text-xs mb-1 block">Litri</label>
                        <input type="number" value={editData.litri} onChange={e => setEditData({ ...editData, litri: e.target.value })}
                          className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-[#f59e0b]" />
                      </div>
                      <div>
                        <label className="text-[#5a5a80] text-xs mb-1 block">Cena/L</label>
                        <input type="number" value={editData.cena_na_liter} onChange={e => setEditData({ ...editData, cena_na_liter: e.target.value })}
                          className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-[#f59e0b]" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[#5a5a80] text-xs mb-1 block">Postaja</label>
                      <input type="text" value={editData.postaja} onChange={e => setEditData({ ...editData, postaja: e.target.value })}
                        className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-[#f59e0b]" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => setUredi(null)} className="py-2 rounded-xl border border-[#1e1e32] text-[#5a5a80] text-sm">Prekliči</button>
                      <button onClick={() => shraniUrediGorivo(v.id)} disabled={saving} className="py-2 rounded-xl bg-[#f59e0b] text-black font-semibold text-sm disabled:opacity-50">{saving ? 'Shranjujem...' : 'Shrani'}</button>
                    </div>
                  </div>
                )}
              </div>
            )

            if (v._tip === 'servis') return (
              <div key={`s-${v.id}`} className="bg-[#0f0f1a] border border-[#1e1e32] rounded-xl p-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">🔧</span>
                    <div>
                      <p className="text-white text-sm font-semibold">{new Date(v.datum).toLocaleDateString('sl-SI')}</p>
                      <p className="text-[#5a5a80] text-xs">{v.opis?.replace(/\s*\[Naknadno.*?\]/, '').substring(0, 35)}{v.servis ? ` · ${v.servis}` : ''}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <p className="text-[#f59e0b] font-semibold">{v.cena?.toFixed(2) || '—'} €</p>
                    {preostalo && !jeUredi && (
                      <button onClick={() => { setUredi(v.id); setEditData({ datum: v.datum, opis: v.opis?.replace(/\s*\[Naknadno.*?\]/, '') || '', servis: v.servis || '', cena: v.cena?.toString() || '' }) }}
                        className="flex items-center gap-1 bg-[#f59e0b22] border border-[#f59e0b44] text-[#f59e0b] text-[10px] font-semibold px-2 py-1 rounded-lg">
                        ✏️ Uredi · {preostalo}
                      </button>
                    )}
                  </div>
                </div>
                {jeUredi && (
                  <div className="flex flex-col gap-3 mt-3 pt-3 border-t border-[#1e1e32]">
                    <p className="text-[#f59e0b] text-xs font-semibold">✏️ Urejanje · še {preostalo}</p>
                    <div>
                      <label className="text-[#5a5a80] text-xs mb-1 block">Opis</label>
                      <textarea value={editData.opis} onChange={e => setEditData({ ...editData, opis: e.target.value })} rows={2}
                        className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-[#f59e0b] resize-none" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[#5a5a80] text-xs mb-1 block">Servis</label>
                        <input type="text" value={editData.servis} onChange={e => setEditData({ ...editData, servis: e.target.value })}
                          className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-[#f59e0b]" />
                      </div>
                      <div>
                        <label className="text-[#5a5a80] text-xs mb-1 block">Cena (€)</label>
                        <input type="number" value={editData.cena} onChange={e => setEditData({ ...editData, cena: e.target.value })}
                          className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-[#f59e0b]" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => setUredi(null)} className="py-2 rounded-xl border border-[#1e1e32] text-[#5a5a80] text-sm">Prekliči</button>
                      <button onClick={() => shraniUrediServis(v.id)} disabled={saving} className="py-2 rounded-xl bg-[#f59e0b] text-black font-semibold text-sm disabled:opacity-50">{saving ? 'Shranjujem...' : 'Shrani'}</button>
                    </div>
                  </div>
                )}
              </div>
            )

            return (
              <div key={`e-${v.id}`} className="bg-[#0f0f1a] border border-[#1e1e32] rounded-xl p-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{kategorijaIkona[v.kategorija] || '💰'}</span>
                    <div>
                      <p className="text-white text-sm font-semibold capitalize">{v.kategorija}</p>
                      <p className="text-[#5a5a80] text-xs">{new Date(v.datum).toLocaleDateString('sl-SI')}</p>
                      {v.opis && <p className="text-[#5a5a80] text-xs mt-0.5">{v.opis}</p>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <p className="text-[#a09aff] font-semibold">{v.znesek?.toFixed(2)} €</p>
                    {preostalo && !jeUredi && (
                      <button onClick={() => { setUredi(v.id); setEditData({ datum: v.datum, opis: v.opis || '', znesek: v.znesek?.toString() || '' }) }}
                        className="flex items-center gap-1 bg-[#f59e0b22] border border-[#f59e0b44] text-[#f59e0b] text-[10px] font-semibold px-2 py-1 rounded-lg">
                        ✏️ Uredi · {preostalo}
                      </button>
                    )}
                  </div>
                </div>
                {jeUredi && (
                  <div className="flex flex-col gap-3 mt-3 pt-3 border-t border-[#1e1e32]">
                    <p className="text-[#f59e0b] text-xs font-semibold">✏️ Urejanje · še {preostalo}</p>
                    <div>
                      <label className="text-[#5a5a80] text-xs mb-1 block">Opis</label>
                      <input type="text" value={editData.opis} onChange={e => setEditData({ ...editData, opis: e.target.value })}
                        className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-[#f59e0b]" />
                    </div>
                    <div>
                      <label className="text-[#5a5a80] text-xs mb-1 block">Znesek (€)</label>
                      <input type="number" value={editData.znesek} onChange={e => setEditData({ ...editData, znesek: e.target.value })}
                        className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-[#f59e0b]" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => setUredi(null)} className="py-2 rounded-xl border border-[#1e1e32] text-[#5a5a80] text-sm">Prekliči</button>
                      <button onClick={() => shraniUrediExpense(v.id)} disabled={saving} className="py-2 rounded-xl bg-[#f59e0b] text-black font-semibold text-sm disabled:opacity-50">{saving ? 'Shranjujem...' : 'Shrani'}</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      <HomeButton />
    </div>
  )
}