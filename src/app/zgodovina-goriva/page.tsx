'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { HomeButton, BackButton } from '@/lib/nav'
import { type GarageBaseCurrency, currencySymbol, formatMoney, getCurrencyFromSettings } from '@/lib/currency'
import { useLanguage } from '@/lib/i18n'
import {
  fuelCostValue,
  fuelLitersValue,
  isImportedHistoryRow,
  numberValue,
  sortRowsByMileageAndDate,
} from '@/lib/vehicle-costs'

const PAGE_SIZE = 50

const importBuckets = (rows: any[]) => rows.reduce((buckets: Record<string, number>, row: any) => {
  const key = row?.created_at ? String(row.created_at).slice(0, 16) : ''
  if (key) buckets[key] = (buckets[key] || 0) + 1
  return buckets
}, {})

const importInfoFromLabel = (label?: string | null) => {
  if (!label?.includes('import |')) return null
  const [source, stamp] = label.split(' import | ')
  return { source, stamp }
}

const isImportedFuelRow = (row: any, buckets?: Record<string, number>) => {
  return Boolean(importInfoFromLabel(row?.source_owner_label) || isImportedHistoryRow(row, buckets))
}

const fuelSummaryFor = (rows: any[]) => ({
  liters: rows.reduce((sum, row) => sum + fuelLitersValue(row), 0),
  amount: rows.reduce((sum, row) => sum + fuelCostValue(row), 0),
  count: rows.length,
})

const saveFuelCostSummary = (carId: string, rows: any[]) => {
  const buckets = importBuckets(rows)
  const importedRows = rows.filter((row: any) => isImportedFuelRow(row, buckets))
  const garageBaseRows = rows.filter((row: any) => !isImportedFuelRow(row, buckets))
  const garageBase = fuelSummaryFor(garageBaseRows)
  const imported = fuelSummaryFor(importedRows)
  const total = fuelSummaryFor(rows)
  localStorage.setItem(`garagebase_cost_totals_${carId}`, JSON.stringify({
    fuelCost: total.amount,
    fuelLiters: total.liters,
    fuelRows: total.count,
    garageBaseFuelCost: garageBase.amount,
    importedFuelCost: imported.amount,
    savedAt: Date.now(),
  }))
}

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
  const [carId, setCarId] = useState('')
  const [totalCount, setTotalCount] = useState(0)
  const [summary, setSummary] = useState({
    garageBase: { liters: 0, amount: 0, count: 0 },
    imported: { liters: 0, amount: 0, count: 0 },
    total: { liters: 0, amount: 0, count: 0 },
  })
  const [loadingMore, setLoadingMore] = useState(false)
  const [sourceFilter, setSourceFilter] = useState({ garageBase: true, imported: true })

  useEffect(() => {
    const init = async () => {
      setValuta(getCurrencyFromSettings())
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/'; return }
      const params = new URLSearchParams(window.location.search)
      const selectedCarId = params.get('car')
      if (!selectedCarId) { window.location.href = '/garaza'; return }
      setCarId(selectedCarId)
      const { data: avtoData } = await supabase.from('cars').select('*').eq('id', selectedCarId).maybeSingle()
      if (!avtoData) { window.location.href = '/garaza'; return }
      setAvto(avtoData)
      const [gorivoRes, summaryRes, maxKmRes] = await Promise.all([
        supabase.from('fuel_logs').select('*', { count: 'exact' }).eq('car_id', selectedCarId).order('km', { ascending: false }).order('datum', { ascending: false }).range(0, PAGE_SIZE - 1),
        supabase.from('fuel_logs').select('litri,cena_skupaj,cena_na_liter,created_at,import_batch_id,source_owner_label,postaja,opis').eq('car_id', selectedCarId),
        supabase.from('fuel_logs').select('km').eq('car_id', selectedCarId).order('km', { ascending: false }).limit(1),
      ])
      const gorivo = gorivoRes.data || []
      const fuelRows = sortRowsByMileageAndDate(gorivo || [])
      const maxFuelKm = numberValue(maxKmRes.data?.[0]?.km)
      if (avtoData?.id && maxFuelKm > (avtoData.km_trenutni || 0)) {
        await supabase.from('cars').update({ km_trenutni: maxFuelKm }).eq('id', avtoData.id)
        setAvto({ ...avtoData, km_trenutni: maxFuelKm })
      }
      setTotalCount(gorivoRes.count || fuelRows.length)
      const summaryRows = (summaryRes.data && summaryRes.data.length > 0 ? summaryRes.data : fuelRows) || []
      const buckets = importBuckets(summaryRows)
      const importedRows = summaryRows.filter((row: any) => isImportedFuelRow(row, buckets))
      const garageBaseRows = summaryRows.filter((row: any) => !isImportedFuelRow(row, buckets))
      setSummary({
        garageBase: fuelSummaryFor(garageBaseRows),
        imported: fuelSummaryFor(importedRows),
        total: fuelSummaryFor(summaryRows),
      })
      setVnosi(fuelRows)
      localStorage.setItem(`garagebase_fuel_history_cache_${selectedCarId}`, JSON.stringify({ rows: fuelRows, savedAt: Date.now() }))
      saveFuelCostSummary(selectedCarId, summaryRows)
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

  const izracunajPorabo = (rows: any[], index: number) => {
    const trenutni = rows[index]
    const prejsnji = rows[index + 1]
    if (!prejsnji) return null
    const kmRazlika = numberValue(trenutni.km) - numberValue(prejsnji.km)
    if (kmRazlika <= 0) return null
    const litri = fuelLitersValue(trenutni)
    return litri > 0 ? (litri / kmRazlika) * 100 : null
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

  const jeNepopolnUvoz = (vnos: any) => !vnos.import_batch_id && !vnos.source_owner_label && fuelLitersValue(vnos) === 0 && fuelCostValue(vnos) === 0
  const displayedImportBuckets = importBuckets(vnosi)
  const jeUvozen = (vnos: any) => Boolean(isImportedFuelRow(vnos, displayedImportBuckets) || jeNepopolnUvoz(vnos))
  const jeDelnoTankanje = (vnos: any) => vnos?.polni_rezervar === false || vnos?.polni_rezervar === null || String(vnos?.polni_rezervar).toLowerCase() === 'false'
  const editable = (vnos: any) => Boolean(preostaliCas(vnos.created_at))
  const filteredVnosi = vnosi.filter((vnos) => {
    const imported = jeUvozen(vnos)
    return imported ? sourceFilter.imported : sourceFilter.garageBase
  })

  const toggleSourceFilter = (source: 'garageBase' | 'imported') => {
    setSourceFilter(prev => {
      const next = { ...prev, [source]: !prev[source] }
      return next.garageBase || next.imported ? next : prev
    })
  }

  const refreshVnosi = async () => {
    const [gorivoRes, summaryRes] = await Promise.all([
      supabase.from('fuel_logs').select('*', { count: 'exact' }).eq('car_id', avto.id).order('km', { ascending: false }).order('datum', { ascending: false }).range(0, Math.max(vnosi.length, PAGE_SIZE) - 1),
      supabase.from('fuel_logs').select('litri,cena_skupaj,cena_na_liter,created_at,import_batch_id,source_owner_label,postaja,opis').eq('car_id', avto.id),
    ])
    const gorivo = sortRowsByMileageAndDate(gorivoRes.data || [])
    const summaryRows = (summaryRes.data && summaryRes.data.length > 0 ? summaryRes.data : gorivo) || []
    const buckets = importBuckets(summaryRows)
    const importedRows = summaryRows.filter((row: any) => isImportedFuelRow(row, buckets))
    const garageBaseRows = summaryRows.filter((row: any) => !isImportedFuelRow(row, buckets))
    setVnosi(gorivo)
    localStorage.setItem(`garagebase_fuel_history_cache_${avto.id}`, JSON.stringify({ rows: gorivo, savedAt: Date.now() }))
    saveFuelCostSummary(avto.id, summaryRows)
    setTotalCount(gorivoRes.count || gorivo.length || 0)
    setSummary({
      garageBase: fuelSummaryFor(garageBaseRows),
      imported: fuelSummaryFor(importedRows),
      total: fuelSummaryFor(summaryRows),
    })
  }

  const loadMore = async () => {
    if (!carId || loadingMore || vnosi.length >= totalCount) return
    setLoadingMore(true)
    const from = vnosi.length
    const to = from + PAGE_SIZE - 1
    const { data } = await supabase.from('fuel_logs').select('*').eq('car_id', carId).order('km', { ascending: false }).order('datum', { ascending: false }).range(from, to)
    setVnosi(prev => sortRowsByMileageAndDate([...prev, ...(data || [])]))
    setLoadingMore(false)
  }

  const izracunajPrikazPorabe = (rows: any[], index: number) => {
    if (jeDelnoTankanje(rows[index])) return null
    if (!rows.some(jeDelnoTankanje)) return izracunajPorabo(rows, index)

    const olderFullIndex = rows.findIndex((row, i) => i > index && !jeDelnoTankanje(row))
    if (olderFullIndex < 0) return null
    const kmRazlika = numberValue(rows[index].km) - numberValue(rows[olderFullIndex].km)
    if (kmRazlika <= 0) return null
    const litriSegmenta = rows.slice(index, olderFullIndex).reduce((sum, row) => sum + fuelLitersValue(row), 0)
    return litriSegmenta > 0 ? (litriSegmenta / kmRazlika) * 100 : null
  }

  const znakValute = currencySymbol(valuta)

  const tipGorivaIkona = (tip: string) => {
    if (tip === '95') return { label: '95', bg: 'bg-[#16a34a]', text: 'text-white' }
    if (tip === '100') return { label: '100', bg: 'bg-[#2563eb]', text: 'text-white' }
    if (tip === 'diesel') return { label: 'D', bg: 'bg-[#333333]', text: 'text-[#aaaaaa]' }
    return null
  }

  const SummaryCard = ({ title, data, tone }: { title: string; data: { liters: number; amount: number; count: number }; tone: 'app' | 'import' | 'total' }) => {
    const styles = tone === 'total'
      ? 'border-[#3ecfcf55] bg-[#3ecfcf10]'
      : tone === 'import'
        ? 'border-[#22c55e55] bg-[#22c55e10]'
        : 'border-[#6c63ff55] bg-[#6c63ff10]'
    const titleColor = tone === 'total' ? 'text-[#3ecfcf]' : tone === 'import' ? 'text-[#86efac]' : 'text-[#a09aff]'
    return (
      <div className={`rounded-2xl border p-3 ${styles}`}>
        <p className={`mb-3 text-xs font-black uppercase tracking-wide ${titleColor}`}>{title}</p>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <p className="text-[#5a5a80] text-[10px] uppercase tracking-wider">{tx('Litrov', 'Liters')}</p>
            <p className="text-white font-bold text-base">{data.liters.toFixed(0)}<span className="text-[#5a5a80] text-xs font-normal"> L</span></p>
          </div>
          <div>
            <p className="text-[#5a5a80] text-[10px] uppercase tracking-wider">{tx('Skupaj', 'Total')}</p>
            <p className="text-white font-bold text-base">{data.amount.toFixed(0)}<span className="text-[#5a5a80] text-xs font-normal"> {znakValute}</span></p>
          </div>
          <div>
            <p className="text-[#5a5a80] text-[10px] uppercase tracking-wider">{tx('Tankanij', 'Fill-ups')}</p>
            <p className="text-white font-bold text-base">{data.count}</p>
          </div>
        </div>
      </div>
    )
  }

  const shraniUredi = async (id: string) => {
    setSaving(true)
    const litri = numberValue(editData.litri)
    const cenaNaLiter = numberValue(editData.cena_na_liter)
    await supabase.from('fuel_logs').update({
      datum: editData.datum,
      litri,
      cena_na_liter: cenaNaLiter > 0 ? cenaNaLiter : null,
      cena_skupaj: litri > 0 && cenaNaLiter > 0
        ? litri * cenaNaLiter
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
        <div className="grid grid-cols-1 gap-3 mb-6 xl:grid-cols-3">
          <SummaryCard title={tx('GarageBase vnosi', 'GarageBase entries')} data={summary.garageBase} tone="app" />
          <SummaryCard title={tx('Uvozena zgodovina', 'Imported history')} data={summary.imported} tone="import" />
          <SummaryCard title={tx('Skupne vrednosti', 'Combined totals')} data={summary.total} tone="total" />
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
          <button
            type="button"
            onClick={() => toggleSourceFilter('garageBase')}
            className={`rounded-2xl border px-4 py-3 text-left transition-all ${sourceFilter.garageBase ? 'border-[#6c63ff] bg-[#6c63ff18] shadow-[0_0_0_2px_rgba(108,99,255,0.16)]' : 'border-[#6c63ff33] bg-white opacity-65'}`}
            aria-pressed={sourceFilter.garageBase}
          >
            <p className="text-sm font-black text-[#6c63ff]">{sourceFilter.garageBase ? '[x] ' : '[ ] '}{tx('GarageBase vnosi', 'GarageBase entries')}</p>
            <p className="text-xs text-[#5a5a80]">{summary.garageBase.count} {tx('tankanj', 'fill-ups')} · {formatMoney(summary.garageBase.amount, valuta)}</p>
          </button>
          <button
            type="button"
            onClick={() => toggleSourceFilter('imported')}
            className={`rounded-2xl border px-4 py-3 text-left transition-all ${sourceFilter.imported ? 'border-[#22c55e] bg-[#22c55e14] shadow-[0_0_0_2px_rgba(34,197,94,0.16)]' : 'border-[#22c55e33] bg-white opacity-65'}`}
            aria-pressed={sourceFilter.imported}
          >
            <p className="text-sm font-black text-[#15803d]">{sourceFilter.imported ? '[x] ' : '[ ] '}{tx('Uvozena zgodovina', 'Imported history')}</p>
            <p className="text-xs text-[#166534]">{summary.imported.count} {tx('tankanj', 'fill-ups')} · {formatMoney(summary.imported.amount, valuta)}</p>
          </button>
        </div>
      )}

      {vnosi.length === 0 ? (
        <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-6 text-center">
          <p className="text-4xl mb-3">⛽</p>
          <p className="text-white font-semibold mb-1">Še ni tankanij</p>
        </div>
      ) : filteredVnosi.length === 0 ? (
        <div className="bg-white border border-[#dce3ff] rounded-2xl p-6 text-center">
          <p className="text-[#5a5a80] font-semibold mb-1">{tx('Ni tankanj za izbran filter.', 'No fill-ups for the selected filter.')}</p>
          {vnosi.length < totalCount && (
            <button onClick={loadMore} disabled={loadingMore}
              className="mt-4 rounded-2xl border border-[#6c63ff55] bg-[#6c63ff18] px-4 py-3 text-sm font-bold text-[#6c63ff] disabled:opacity-50">
              {loadingMore ? tx('Nalaganje...', 'Loading...') : tx(`Nalozi se ${Math.min(PAGE_SIZE, totalCount - vnosi.length)} zapisov`, `Load ${Math.min(PAGE_SIZE, totalCount - vnosi.length)} more records`)}
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredVnosi.map((vnos, index) => {
            const poraba = izracunajPrikazPorabe(filteredVnosi, index)
            const tipIkona = tipGorivaIkona(vnos.tip_goriva)
            const cenaSkupaj = fuelCostValue(vnos)
            const litri = fuelLitersValue(vnos)
            const cenaNaLiter = numberValue(vnos.cena_na_liter)
            const isPartialFillUp = jeDelnoTankanje(vnos)
            const preostalo = preostaliCas(vnos.created_at)
            const jeUredi = uredi === vnos.id
            const info = importInfo(vnos.source_owner_label) || (jeNepopolnUvoz(vnos) ? { key: `incomplete-${vnos.id}`, source: tx('Nepopoln uvoz', 'Incomplete import'), dateText: '' } : null)
            const isImported = jeUvozen(vnos)
            const isIncompleteImport = jeNepopolnUvoz(vnos)
            const previousInfo = index > 0 ? importInfo(filteredVnosi[index - 1]?.source_owner_label) : null
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
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-white font-semibold">{new Date(vnos.datum).toLocaleDateString('sl-SI')}</p>
                        {isPartialFillUp && (
                          <span className="rounded-full border border-[#94a3b866] bg-[#94a3b81a] px-2 py-0.5 text-[10px] font-black uppercase text-[#64748b]">
                            ◐ {tx('Delno', 'Partial')}
                          </span>
                        )}
                      </div>
                      <p className="text-[#5a5a80] text-xs mt-0.5">{vnos.km?.toLocaleString()} km{vnos.postaja && ` · ${vnos.postaja}`}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {cenaSkupaj > 0 && <span className="text-[#3ecfcf] font-bold">{formatMoney(cenaSkupaj, valuta)}</span>}
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
                      <p className="text-white font-semibold text-sm">{litri > 0 ? litri : '-'} L</p>
                    </div>
                    {cenaNaLiter > 0 && (
                      <div className="bg-[#13131f] rounded-xl p-2.5">
                        <p className="text-[#5a5a80] text-xs mb-1">{tx('Cena/L', 'Price/L')}</p>
                        <p className="text-white font-semibold text-sm">{cenaNaLiter} {znakValute}</p>
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
          {vnosi.length < totalCount && (
            <button onClick={loadMore} disabled={loadingMore}
              className="mt-2 rounded-2xl border border-[#6c63ff55] bg-[#6c63ff18] px-4 py-3 text-sm font-bold text-[#a09aff] disabled:opacity-50">
              {loadingMore ? tx('Nalaganje...', 'Loading...') : tx(`Nalozi se ${Math.min(PAGE_SIZE, totalCount - vnosi.length)} zapisov`, `Load ${Math.min(PAGE_SIZE, totalCount - vnosi.length)} more records`)}
            </button>
          )}
        </div>
      )}
      <HomeButton />
    </div>
  )
}
