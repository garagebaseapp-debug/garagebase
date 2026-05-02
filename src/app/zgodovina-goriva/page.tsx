'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { HomeButton, BackButton } from '@/lib/nav'
import { type GarageBaseCurrency, currencySymbol, formatMoney, getCurrencyFromSettings } from '@/lib/currency'

export default function ZgodovinaGoriva() {
  const [vnosi, setVnosi] = useState<any[]>([])
  const [avto, setAvto] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [uredi, setUredi] = useState<string | null>(null)
  const [editData, setEditData] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [cas, setCas] = useState(Date.now())
  const [valuta, setValuta] = useState<GarageBaseCurrency>('EUR')

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
      const { data: gorivo } = await supabase.from('fuel_logs').select('*').eq('car_id', carId).order('km', { ascending: true })
      setVnosi(gorivo || [])
      setLoading(false)
    }
    init()
    // Posodobi timer vsako sekundo
    const timer = setInterval(() => setCas(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Izračun preostalega časa za urejanje
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

  const izracunajPorabo = (index: number) => {
    const trenutni = vnosi[index]
    const prejsnjiKm = index === 0 ? (avto?.km_trenutni || 0) : vnosi[index - 1].km
    const kmRazlika = trenutni.km - prejsnjiKm
    if (kmRazlika <= 0) return null
    return (trenutni.litri / kmRazlika) * 100
  }

  const skupajLitrov = vnosi.reduce((sum, v) => sum + (v.litri || 0), 0)
  const skupajEurov = vnosi.reduce((sum, v) => sum + (v.cena_skupaj || 0), 0)
  const znakValute = currencySymbol(valuta)

  const tipGorivaIkona = (tip: string) => {
    if (tip === '95') return { label: '95', bg: 'bg-[#16a34a]', text: 'text-white' }
    if (tip === '100') return { label: '100', bg: 'bg-[#2563eb]', text: 'text-white' }
    if (tip === 'diesel') return { label: 'D', bg: 'bg-[#333333]', text: 'text-[#aaaaaa]' }
    return null
  }

  const shraniUredi = async (id: string) => {
    setSaving(true)
    await supabase.from('fuel_logs').update({
      datum: editData.datum,
      litri: parseFloat(editData.litri),
      cena_na_liter: editData.cena_na_liter ? parseFloat(editData.cena_na_liter) : null,
      cena_skupaj: editData.litri && editData.cena_na_liter
        ? parseFloat(editData.litri) * parseFloat(editData.cena_na_liter)
        : null,
      postaja: editData.postaja || null,
    }).eq('id', id)
    const { data: gorivo } = await supabase.from('fuel_logs').select('*').eq('car_id', avto.id).order('km', { ascending: true })
    setVnosi(gorivo || [])
    setUredi(null)
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
          <h1 className="text-xl font-bold text-white">⛽ Gorivo</h1>
          {avto && <p className="text-[#5a5a80] text-xs">{avto.znamka} {avto.model}</p>}
        </div>
      </div>

      {vnosi.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-3">
            <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-1">Litrov</p>
            <p className="text-white font-bold text-lg">{skupajLitrov.toFixed(0)}<span className="text-[#5a5a80] text-xs font-normal"> L</span></p>
          </div>
          <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-3">
            <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-1">Skupaj</p>
          <p className="text-white font-bold text-lg">{skupajEurov.toFixed(0)}<span className="text-[#5a5a80] text-xs font-normal"> {znakValute}</span></p>
          </div>
          <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-3">
            <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-1">Tankanij</p>
            <p className="text-white font-bold text-lg">{vnosi.length}</p>
          </div>
        </div>
      )}

      <button onClick={() => window.location.href = `/vnos-goriva?car=${avto?.id}`}
        className="w-full bg-[#6c63ff] hover:bg-[#5a52e0] text-white font-semibold py-3 rounded-xl transition-colors mb-6">
        + Dodaj tankanje
      </button>

      {vnosi.length === 0 ? (
        <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-6 text-center">
          <p className="text-4xl mb-3">⛽</p>
          <p className="text-white font-semibold mb-1">Še ni tankanij</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {[...vnosi].reverse().map((vnos, reversedIndex) => {
            const index = vnosi.length - 1 - reversedIndex
            const poraba = izracunajPorabo(index)
            const tipIkona = tipGorivaIkona(vnos.tip_goriva)
            const preostalo = preostaliCas(vnos.created_at)
            const jeUredi = uredi === vnos.id

            return (
              <div key={vnos.id} className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    {tipIkona && (
                      <div className={`w-8 h-8 rounded-lg ${tipIkona.bg} flex items-center justify-center flex-shrink-0`}>
                        <span className={`${tipIkona.text} font-bold text-xs`}>{tipIkona.label}</span>
                      </div>
                    )}
                    <div>
                      <p className="text-white font-semibold">{new Date(vnos.datum).toLocaleDateString('sl-SI')}</p>
                      <p className="text-[#5a5a80] text-xs mt-0.5">{vnos.km?.toLocaleString()} km{vnos.postaja && ` · ${vnos.postaja}`}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {vnos.cena_skupaj && <span className="text-[#3ecfcf] font-bold">{formatMoney(vnos.cena_skupaj, valuta)}</span>}
                    {/* Gumb uredi z odštevalnikom */}
                    {preostalo && !jeUredi && (
                      <button onClick={() => {
                        setUredi(vnos.id)
                        setEditData({
                          datum: vnos.datum,
                          litri: vnos.litri?.toString(),
                          cena_na_liter: vnos.cena_na_liter?.toString(),
                          postaja: vnos.postaja || '',
                        })
                      }}
                        className="flex items-center gap-1 bg-[#f59e0b22] border border-[#f59e0b44] text-[#f59e0b] text-[10px] font-semibold px-2 py-1 rounded-lg">
                        ✏️ Uredi · {preostalo}
                      </button>
                    )}
                  </div>
                </div>

                {/* Forma za urejanje */}
                {jeUredi && (
                  <div className="flex flex-col gap-3 mt-3 pt-3 border-t border-[#1e1e32]">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[#f59e0b] text-xs font-semibold">✏️ Urejanje · še {preostalo}</p>
                    </div>
                    <div>
                      <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-1 block">Datum</label>
                      <input type="date" value={editData.datum}
                        onChange={e => setEditData({ ...editData, datum: e.target.value })}
                        className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-[#f59e0b]" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-1 block">Litri</label>
                        <input type="number" value={editData.litri}
                          onChange={e => setEditData({ ...editData, litri: e.target.value })}
                          className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-[#f59e0b]" />
                      </div>
                      <div>
                        <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-1 block">Cena/L</label>
                        <input type="number" value={editData.cena_na_liter}
                          onChange={e => setEditData({ ...editData, cena_na_liter: e.target.value })}
                          className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-[#f59e0b]" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-1 block">Postaja</label>
                      <input type="text" value={editData.postaja}
                        onChange={e => setEditData({ ...editData, postaja: e.target.value })}
                        className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-[#f59e0b]" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
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

                {!jeUredi && (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-[#13131f] rounded-xl p-2.5">
                      <p className="text-[#5a5a80] text-xs mb-1">Litri</p>
                      <p className="text-white font-semibold text-sm">{vnos.litri} L</p>
                    </div>
                    {vnos.cena_na_liter && (
                      <div className="bg-[#13131f] rounded-xl p-2.5">
                        <p className="text-[#5a5a80] text-xs mb-1">Cena/L</p>
                        <p className="text-white font-semibold text-sm">{vnos.cena_na_liter} {znakValute}</p>
                      </div>
                    )}
                    <div className={`rounded-xl p-2.5 ${poraba ? 'bg-[#6c63ff22] border border-[#6c63ff33]' : 'bg-[#13131f]'}`}>
                      <p className="text-[#5a5a80] text-xs mb-1">Poraba</p>
                      <p className={`font-semibold text-sm ${poraba ? 'text-[#a09aff]' : 'text-[#5a5a80]'}`}>
                        {poraba ? `${poraba.toFixed(1)} L/100` : '—'}
                      </p>
                    </div>
                  </div>
                )}
                {!jeUredi && vnos.receipt_url && (
                  <button
                    type="button"
                    onClick={() => window.open(vnos.receipt_url, '_blank')}
                    className="mt-2 w-full rounded-xl border border-[#3ecfcf55] bg-[#3ecfcf18] px-3 py-2 text-sm font-semibold text-[#3ecfcf]"
                  >
                    Odpri racun
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
      <HomeButton />
    </div>
  )
}
