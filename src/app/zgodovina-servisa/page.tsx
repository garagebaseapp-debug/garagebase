'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { HomeButton, BackButton } from '@/lib/nav'
import { type GarageBaseCurrency, currencySymbol, formatMoney, getCurrencyFromSettings } from '@/lib/currency'
import { useLanguage } from '@/lib/i18n'

export default function ZgodovinaServisa() {
  const { language } = useLanguage()
  const tx = (sl: string, en: string) => language === 'en' ? en : sl
  const [vnosi, setVnosi] = useState<any[]>([])
  const [avto, setAvto] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [uredi, setUredi] = useState<string | null>(null)
  const [editData, setEditData] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [cas, setCas] = useState(Date.now())
  const [valuta, setValuta] = useState<GarageBaseCurrency>('EUR')
  const [selectedImported, setSelectedImported] = useState<string[]>([])

  useEffect(() => {
    const init = async () => {
      setValuta(getCurrencyFromSettings())
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/'; return }
      const params = new URLSearchParams(window.location.search)
      const carId = params.get('car')
      if (!carId) { window.location.href = '/garaza'; return }
      const { data: avtoData } = await supabase.from('cars').select('*').eq('id', carId).single()
      setAvto(avtoData)
      const { data: servisi } = await supabase.from('service_logs').select('*').eq('car_id', carId).order('datum', { ascending: false })
      setVnosi(servisi || [])
      setLoading(false)
    }
    init()
    const timer = setInterval(() => setCas(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const casZaklepa = (vnos: any) => {
    if (vnos.locked_at) return new Date(vnos.locked_at).getTime()
    return new Date(vnos.created_at).getTime() + 24 * 60 * 60 * 1000
  }

  const jeZaklenjen = (vnos: any) => cas >= casZaklepa(vnos)
  const jeUvozen = (vnos: any) => Boolean(vnos.import_batch_id || vnos.source_owner_label || vnos.opis?.includes('[Prejsnji lastnik]'))
  const editable = (vnos: any) => jeUvozen(vnos) || !jeZaklenjen(vnos)

  const refreshVnosi = async () => {
    const { data: servisi } = await supabase.from('service_logs').select('*').eq('car_id', avto.id).order('datum', { ascending: false })
    setVnosi(servisi || [])
  }

  const preostaliCas = (vnos: any) => {
    const konec = casZaklepa(vnos)
    const preostalo = konec - cas
    if (preostalo <= 0) return null
    const ure = Math.floor(preostalo / (1000 * 60 * 60))
    const minute = Math.floor((preostalo % (1000 * 60 * 60)) / (1000 * 60))
    const sekunde = Math.floor((preostalo % (1000 * 60)) / 1000)
    return `${ure}:${String(minute).padStart(2, '0')}:${String(sekunde).padStart(2, '0')}`
  }

  const skupajEurov = vnosi.reduce((sum, v) => sum + (v.cena || 0), 0)
  const znakValute = currencySymbol(valuta)
  const trustBadge = (vnos: any) => {
    if (vnos.verification_level === 'strong') return { label: 'Strong', cls: 'bg-[#16a34a22] border-[#16a34a55] text-[#4ade80]' }
    if (vnos.verification_level === 'photo') return { label: 'Photo', cls: 'bg-[#3ecfcf22] border-[#3ecfcf55] text-[#3ecfcf]' }
    return { label: 'Basic', cls: 'bg-[#6c63ff22] border-[#6c63ff55] text-[#a09aff]' }
  }

  const shraniUredi = async (id: string) => {
    const existing = vnosi.find(v => v.id === id)
    if (existing && !editable(existing)) return
    setSaving(true)
    await supabase.from('service_logs').update({
      datum: editData.datum,
      opis: editData.opis,
      servis: editData.servis || null,
      cena: editData.cena ? parseFloat(editData.cena) : null,
      edited_at: new Date().toISOString(),
    }).eq('id', id)
    await refreshVnosi()
    setUredi(null)
    setSaving(false)
  }

  const izbrisiVnos = async (id: string) => {
    const vnos = vnosi.find(v => v.id === id)
    if (!vnos || !editable(vnos)) return
    const ok = window.confirm(tx('Izbrisem ta zapis? Tega ni mogoce razveljaviti.', 'Delete this record? This cannot be undone.'))
    if (!ok) return
    setSaving(true)
    await supabase.from('service_logs').delete().eq('id', id).eq('car_id', avto.id)
    setSelectedImported(prev => prev.filter(item => item !== id))
    await refreshVnosi()
    setUredi(null)
    setSaving(false)
  }

  const toggleImported = (id: string) => {
    setSelectedImported(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id])
  }

  const oznaciVseUvozene = () => {
    const importedIds = vnosi.filter(jeUvozen).map(vnos => vnos.id)
    const allSelected = importedIds.length > 0 && importedIds.every(id => selectedImported.includes(id))
    setSelectedImported(allSelected ? [] : importedIds)
  }

  const izbrisiIzbrane = async () => {
    const importedIds = vnosi.filter(jeUvozen).map(vnos => vnos.id)
    const ids = selectedImported.filter(id => importedIds.includes(id))
    if (ids.length === 0) return
    const ok = window.confirm(tx(
      `Izbrisem ${ids.length} izbranih uvozenih zapisov? Rocno vneseni zapisi ne bodo izbrisani.`,
      `Delete ${ids.length} selected imported records? Manual records will not be deleted.`
    ))
    if (!ok) return
    setSaving(true)
    await supabase.from('service_logs').delete().in('id', ids).eq('car_id', avto.id)
    setSelectedImported([])
    await refreshVnosi()
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
        <BackButton />
        <div>
          <h1 className="text-xl font-bold text-white">🔧 Servisna knjiga</h1>
          {avto && <p className="text-[#5a5a80] text-xs">{avto.znamka} {avto.model}</p>}
        </div>
      </div>

      {vnosi.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-4">
            <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-1">Skupaj servisov</p>
            <p className="text-white font-bold text-xl">{vnosi.length}</p>
          </div>
          <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-4">
            <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-1">Skupaj strošek</p>
        <p className="text-white font-bold text-xl">{formatMoney(skupajEurov, valuta)}</p>
          </div>
        </div>
      )}

      <button onClick={() => window.location.href = `/vnos-servisa?car=${avto?.id}`}
        className="w-full bg-[#f59e0b] hover:bg-[#d97706] text-white font-semibold py-3 rounded-xl transition-colors mb-6">
        + Dodaj servis
      </button>

      {vnosi.some(jeUvozen) && (
        <div className="mb-4 rounded-2xl border border-[#22c55e44] bg-[#22c55e10] p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-bold text-[#86efac]">
              {tx('Uvozeni zapisi', 'Imported records')} · {selectedImported.length} {tx('izbranih', 'selected')}
            </p>
            <div className="flex gap-2">
              <button onClick={oznaciVseUvozene}
                className="rounded-xl border border-[#22c55e66] px-3 py-2 text-xs font-bold text-[#86efac]">
                {tx('Oznaci vse uvozene', 'Select all imported')}
              </button>
              <button onClick={izbrisiIzbrane} disabled={selectedImported.length === 0 || saving}
                className="rounded-xl border border-[#ef444466] bg-[#ef444418] px-3 py-2 text-xs font-bold text-[#fca5a5] disabled:opacity-50">
                {tx('Izbrisi izbrane', 'Delete selected')}
              </button>
            </div>
          </div>
        </div>
      )}

      {vnosi.length === 0 ? (
        <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-6 text-center">
          <p className="text-4xl mb-3">🔧</p>
          <p className="text-white font-semibold mb-1">Še ni servisov</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {vnosi.map((vnos, index) => {
            const imaSlike = vnos.foto_url && vnos.foto_url.length > 0
            const jePrejsnjiLastnik = !!vnos.source_owner_label || vnos.opis?.includes('[Prejsnji lastnik]')
            const prejJePrejsnjiLastnik = index > 0 && (!!vnosi[index - 1].source_owner_label || vnosi[index - 1].opis?.includes('[Prejsnji lastnik]'))
            const jeNaknaden = vnos.opis?.includes('[Naknadno vnešeno:')
            const opisBrezOznake = vnos.opis?.replace(/\s*\[Naknadno vnešeno:.*?\]/, '') || ''
            const preostalo = preostaliCas(vnos)
            const isLocked = jeZaklenjen(vnos)
            const isImported = jeUvozen(vnos)
            const jeUredi = uredi === vnos.id
            const badge = trustBadge(vnos)

            return (
              <div key={vnos.id}>
              {jePrejsnjiLastnik && !prejJePrejsnjiLastnik && (
                <div className="my-2 rounded-xl border border-[#6c63ff55] bg-[#6c63ff18] px-3 py-2 text-center text-[#a09aff] text-xs font-bold">
                  Zgodovina prejsnjega lastnika
                </div>
              )}
              <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-4">

                <div className="flex justify-between items-start mb-2">
                  <div>
                    {isImported && (
                      <input
                        type="checkbox"
                        checked={selectedImported.includes(vnos.id)}
                        onChange={() => toggleImported(vnos.id)}
                        className="mb-2 h-5 w-5 accent-[#22c55e]"
                        aria-label={tx('Oznaci uvozen zapis', 'Select imported record')}
                      />
                    )}
                    <div className="flex items-center gap-2">
                      <p className="text-white font-semibold">
                        {new Date(vnos.datum).toLocaleDateString('sl-SI')}
                      </p>
                      <span className={`text-xs border px-1.5 py-0.5 rounded-md font-bold ${badge.cls}`}>{badge.label}</span>
                      {jeNaknaden && (
                        <span className="text-[#f59e0b] text-xs bg-[#f59e0b22] px-1.5 py-0.5 rounded-md">⚠️ naknadno</span>
                      )}
                    </div>
                    <p className="text-[#5a5a80] text-xs mt-0.5">
                      {vnos.km?.toLocaleString()} km{vnos.servis && ` · ${vnos.servis}`}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-2">
                      {imaSlike && <span className="text-[#5a5a80] text-sm">📎</span>}
                    {vnos.cena && <span className="text-[#f59e0b] font-bold">{formatMoney(vnos.cena, valuta)}</span>}
                    </div>
                    {/* Gumb uredi z odštevalnikom */}
                    {editable(vnos) && !jeUredi && (
                      <button onClick={() => {
                        setUredi(vnos.id)
                        setEditData({
                          datum: vnos.datum,
                          opis: opisBrezOznake,
                          servis: vnos.servis || '',
                          cena: vnos.cena?.toString() || '',
                        })
                      }}
                        className="flex items-center gap-1 bg-[#f59e0b22] border border-[#f59e0b44] text-[#f59e0b] text-[10px] font-semibold px-2 py-1 rounded-lg">
                        ✏️ Uredi · {preostalo}
                      </button>
                    )}
                    {isLocked && !isImported && (
                      <span className="text-[#4ade80] text-[10px] font-semibold border border-[#16a34a44] bg-[#16a34a18] px-2 py-1 rounded-lg">Zaklenjeno</span>
                    )}
                  </div>
                </div>

                {/* Forma za urejanje */}
                {jeUredi && (
                  <div className="flex flex-col gap-3 mt-3 pt-3 border-t border-[#1e1e32]">
                    <p className="text-[#f59e0b] text-xs font-semibold">✏️ Urejanje · še {preostalo}</p>
                    <div>
                      <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-1 block">Datum</label>
                      <input type="date" value={editData.datum}
                        onChange={e => setEditData({ ...editData, datum: e.target.value })}
                        className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-[#f59e0b]" />
                    </div>
                    <div>
                      <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-1 block">Opis dela</label>
                      <textarea value={editData.opis}
                        onChange={e => setEditData({ ...editData, opis: e.target.value })}
                        rows={3}
                        className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-[#f59e0b] resize-none" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-1 block">Servis</label>
                        <input type="text" value={editData.servis}
                          onChange={e => setEditData({ ...editData, servis: e.target.value })}
                          className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-[#f59e0b]" />
                      </div>
                      <div>
                      <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-1 block">Cena ({znakValute})</label>
                        <input type="number" value={editData.cena}
                          onChange={e => setEditData({ ...editData, cena: e.target.value })}
                          className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-[#f59e0b]" />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <button onClick={() => izbrisiVnos(vnos.id)} disabled={saving}
                        className="py-2 rounded-xl border border-[#ef444466] bg-[#ef444418] text-[#fca5a5] text-sm disabled:opacity-50">
                        {tx('Izbrisi', 'Delete')}
                      </button>
                      <button onClick={() => setUredi(null)}
                        className="py-2 rounded-xl border border-[#1e1e32] text-[#5a5a80] text-sm">
                        Prekliči
                      </button>
                      <button onClick={() => shraniUredi(vnos.id)} disabled={saving}
                        className="py-2 rounded-xl bg-[#f59e0b] text-black font-semibold text-sm disabled:opacity-50">
                        {saving ? 'Shranjujem...' : 'Shrani'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Normalni prikaz */}
                {!jeUredi && (
                  <div onClick={() => window.location.href = `/servis-detajl?id=${vnos.id}&car=${avto?.id}`}
                    className="cursor-pointer">
                    <div className="bg-[#13131f] rounded-xl p-3 mt-2">
                      <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-1">Opravljeno delo</p>
                      <p className="text-white text-sm">{opisBrezOznake}</p>
                    </div>
                    <p className="text-[#3a3a5a] text-xs mt-2 text-right">Tapni za detajle →</p>
                  </div>
                )}
              </div>
              </div>
            )
          })}
        </div>
      )}

      <HomeButton />
    </div>
  )
}
