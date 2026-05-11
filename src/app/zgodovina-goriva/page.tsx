'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { HomeButton, BackButton } from '@/lib/nav'
import { type GarageBaseCurrency, currencySymbol, formatMoney, getCurrencyFromSettings } from '@/lib/currency'
import { useLanguage } from '@/lib/i18n'

export default function ZgodovinaGoriva() {
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
  const [bulkEditMode, setBulkEditMode] = useState(false)

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
      const fuelRows = gorivo || []
      const maxFuelKm = fuelRows.reduce((max: number, row: any) => row.km && row.km > max ? row.km : max, 0)
      if (avtoData?.id && maxFuelKm > (avtoData.km_trenutni || 0)) {
        await supabase.from('cars').update({ km_trenutni: maxFuelKm }).eq('id', avtoData.id)
        setAvto({ ...avtoData, km_trenutni: maxFuelKm })
      }
      setVnosi(fuelRows)
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
    if (index === 0) return null
    const prejsnjiKm = vnosi[index - 1].km
    const kmRazlika = trenutni.km - prejsnjiKm
    if (kmRazlika <= 0) return null
    return (trenutni.litri / kmRazlika) * 100
  }

  const importInfo = (label?: string | null) => {
    if (!label?.includes('import |')) return null
    const [source, stamp] = label.split(' import | ')
    const date = stamp ? new Date(stamp) : null
    return {
      key: `${source}-${stamp}`,
      source,
      dateText: date && !Number.isNaN(date.getTime()) ? date.toLocaleString(language === 'en' ? 'en-US' : 'sl-SI') : '',
    }
  }

  const jeNepopolnUvoz = (vnos: any) => !vnos.import_batch_id && !vnos.source_owner_label && Number(vnos.litri || 0) === 0 && Number(vnos.cena_skupaj || 0) === 0
  const jeUvozen = (vnos: any) => Boolean(vnos.import_batch_id || importInfo(vnos.source_owner_label) || jeNepopolnUvoz(vnos))
  const editable = (vnos: any) => jeUvozen(vnos) || Boolean(preostaliCas(vnos.created_at))

  const refreshVnosi = async () => {
    const { data: gorivo } = await supabase.from('fuel_logs').select('*').eq('car_id', avto.id).order('km', { ascending: true })
    setVnosi(gorivo || [])
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
    const { error } = await supabase.from('fuel_logs').delete().eq('id', id).eq('car_id', avto.id)
    if (error) {
      window.alert(tx(`Izbris ni uspel: ${error.message}`, `Delete failed: ${error.message}`))
      setSaving(false)
      return
    }
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
    const { error } = await supabase.from('fuel_logs').delete().eq('car_id', avto.id).in('id', ids)
    if (error) {
      window.alert(tx(`Izbris ni uspel: ${error.message}`, `Delete failed: ${error.message}`))
      setSaving(false)
      return
    }
    setSelectedImported([])
    await refreshVnosi()
    setSaving(false)
  }

  const toggleBulkEditMode = () => {
    setBulkEditMode(prev => {
      if (prev) setSelectedImported([])
      return !prev
    })
  }

  const pocistiUrejanje = () => {
    setEditData({ ...editData, litri: '', cena_na_liter: '', postaja: '' })
  }

  if (loading) return (
    <div className="min-h-screen bg-[#080810] flex items-center justify-center">
      <p className="text-[#5a5a80]">{tx('Nalaganje...', 'Loading...')}</p>
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
            <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-1">{tx('Litrov', 'Liters')}</p>
            <p className="text-white font-bold text-lg">{skupajLitrov.toFixed(0)}<span className="text-[#5a5a80] text-xs font-normal"> L</span></p>
          </div>
          <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-3">
            <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-1">{tx('Skupaj', 'Total')}</p>
          <p className="text-white font-bold text-lg">{skupajEurov.toFixed(0)}<span className="text-[#5a5a80] text-xs font-normal"> {znakValute}</span></p>
          </div>
          <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-3">
            <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-1">{tx('Tankanij', 'Fill-ups')}</p>
            <p className="text-white font-bold text-lg">{vnosi.length}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mb-6">
        <button onClick={() => window.location.href = `/vnos-goriva?car=${avto?.id}`}
          className="w-full bg-[#6c63ff] hover:bg-[#5a52e0] text-white font-semibold py-3 rounded-xl transition-colors">
          + {tx('Dodaj tankanje', 'Add fill-up')}
        </button>
        <button onClick={() => window.location.href = `/uvoz-podatkov?car=${avto?.id}`}
          className="w-full bg-[#22c55e22] border border-[#22c55e66] text-[#4ade80] font-semibold py-3 rounded-xl transition-colors">
          {tx('Uvozi CSV', 'Import CSV')}
        </button>
      </div>

      {vnosi.some(jeUvozen) && (
        <div className="mb-4 rounded-2xl border border-[#22c55e44] bg-[#22c55e10] p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-bold text-[#86efac]">
              {tx('Uvozeni zapisi', 'Imported records')}{bulkEditMode ? ` · ${selectedImported.length} ${tx('izbranih', 'selected')}` : ''}
            </p>
            <div className="flex flex-wrap gap-2">
              <button onClick={toggleBulkEditMode}
                className="rounded-xl border border-[#f59e0b66] bg-[#f59e0b18] px-4 py-2.5 text-sm font-black text-[#fbbf24]">
                {bulkEditMode ? tx('Koncaj', 'Done') : tx('Uredi', 'Edit')}
              </button>
              {bulkEditMode && (
                <>
                  <button onClick={oznaciVseUvozene}
                    className="rounded-xl border border-[#22c55e66] px-3 py-2.5 text-sm font-bold text-[#86efac]">
                    {tx('Oznaci vse', 'Select all')}
                  </button>
                  <button onClick={izbrisiIzbrane} disabled={selectedImported.length === 0 || saving}
                    className="rounded-xl border border-[#ef444466] bg-[#ef444418] px-3 py-2.5 text-sm font-bold text-[#fca5a5] disabled:opacity-50">
                    {tx('Zbrisi oznaceno', 'Delete selected')}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {vnosi.length > 0 && (
        <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="rounded-2xl border border-[#22c55e55] bg-[#22c55e10] px-4 py-3">
            <p className="text-sm font-black text-[#15803d]">{tx('Uvozena zgodovina', 'Imported history')}</p>
            <p className="text-xs text-[#166534]">{tx('CSV/prenos ali stari nepopolni uvozi.', 'CSV/transfer or old incomplete imports.')}</p>
          </div>
          <div className="rounded-2xl border border-[#6c63ff55] bg-[#6c63ff10] px-4 py-3">
            <p className="text-sm font-black text-[#6c63ff]">{tx('GarageBase vnosi', 'GarageBase entries')}</p>
            <p className="text-xs text-[#5a5a80]">{tx('Zapisi, ki jih uporabnik vnese v aplikaciji.', 'Records entered by the user in the app.')}</p>
          </div>
        </div>
      )}

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
            const info = importInfo(vnos.source_owner_label) || (jeNepopolnUvoz(vnos) ? { key: `incomplete-${vnos.id}`, source: tx('Nepopoln uvoz', 'Incomplete import'), dateText: '' } : null)
            const isImported = jeUvozen(vnos)
            const isIncompleteImport = jeNepopolnUvoz(vnos)
            const previousInfo = reversedIndex > 0 ? importInfo([...vnosi].reverse()[reversedIndex - 1]?.source_owner_label) : null
            const showImportNote = isImported && (isIncompleteImport || (info && info.key !== previousInfo?.key))

            return (
              <div key={vnos.id} className={`rounded-2xl p-4 ${isImported ? 'bg-[#f0fdf4] border border-[#22c55e66]' : 'bg-white border border-[#dce3ff]'}`}>
                {showImportNote && (
                  <div className="mb-3 rounded-xl border border-[#22c55e55] bg-[#dcfce7] px-3 py-2">
                    <p className="text-[#4ade80] text-xs font-bold">{tx('Uvožena zgodovina', 'Imported history')}</p>
                    <p className="text-[#166534] text-xs mt-0.5">
                      {tx('Vir', 'Source')}: {info?.source}{info?.dateText ? ` · ${tx('uvoženo', 'imported')}: ${info?.dateText}` : ''}
                    </p>
                  </div>
                )}
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    {bulkEditMode && isImported && (
                      <input
                        type="checkbox"
                        checked={selectedImported.includes(vnos.id)}
                        onChange={() => toggleImported(vnos.id)}
                        className="h-6 w-6 accent-[#22c55e]"
                        aria-label={tx('Oznaci uvozen zapis', 'Select imported record')}
                      />
                    )}
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
                    {editable(vnos) && !jeUredi && (
                      <button onClick={() => {
                        setUredi(vnos.id)
                        setEditData({
                          datum: vnos.datum,
                          litri: vnos.litri?.toString(),
                          cena_na_liter: vnos.cena_na_liter?.toString(),
                          postaja: vnos.postaja || '',
                        })
                      }}
                        className="flex items-center gap-1 bg-[#f59e0b22] border border-[#f59e0b44] text-[#f59e0b] text-sm font-bold px-3 py-2 rounded-xl">
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
                      <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-1 block">{tx('Datum', 'Date')}</label>
                      <input type="date" value={editData.datum}
                        onChange={e => setEditData({ ...editData, datum: e.target.value })}
                        className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-[#f59e0b]" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-1 block">{tx('Litri', 'Liters')}</label>
                        <input type="number" value={editData.litri}
                          onChange={e => setEditData({ ...editData, litri: e.target.value })}
                          className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-[#f59e0b]" />
                      </div>
                      <div>
                        <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-1 block">{tx('Cena/L', 'Price/L')}</label>
                        <input type="number" value={editData.cena_na_liter}
                          onChange={e => setEditData({ ...editData, cena_na_liter: e.target.value })}
                          className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-[#f59e0b]" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-1 block">{tx('Postaja', 'Station')}</label>
                      <input type="text" value={editData.postaja}
                        onChange={e => setEditData({ ...editData, postaja: e.target.value })}
                        className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-[#f59e0b]" />
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

                {!jeUredi && (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-[#13131f] rounded-xl p-2.5">
                      <p className="text-[#5a5a80] text-xs mb-1">{tx('Litri', 'Liters')}</p>
                      <p className="text-white font-semibold text-sm">{vnos.litri} L</p>
                    </div>
                    {vnos.cena_na_liter && (
                      <div className="bg-[#13131f] rounded-xl p-2.5">
                        <p className="text-[#5a5a80] text-xs mb-1">{tx('Cena/L', 'Price/L')}</p>
                        <p className="text-white font-semibold text-sm">{vnos.cena_na_liter} {znakValute}</p>
                      </div>
                    )}
                    <div className={`rounded-xl p-2.5 ${poraba ? 'bg-[#6c63ff22] border border-[#6c63ff33]' : 'bg-[#13131f]'}`}>
                      <p className="text-[#5a5a80] text-xs mb-1">{tx('Poraba', 'Consumption')}</p>
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
                    {tx('Odpri racun', 'Open receipt')}
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
