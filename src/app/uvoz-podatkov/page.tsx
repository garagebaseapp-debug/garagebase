'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BackButton, HomeButton } from '@/lib/nav'
import { trackEvent } from '@/lib/analytics'

type ImportRow = {
  type: string
  date: string
  km: number | null
  description: string
  amount: number | null
  liters: number | null
  pricePerLiter: number | null
  station: string
  category: string
}

const sampleCsv = `type;date;km;description;amount;liters;price_per_liter;station;category
fuel;2026-04-29;178900;OMV tankanje;84.00;50;1.68;OMV Ljubljana;
service;2026-04-20;178000;Menjava olja;220;;;;Volvo servis;
expense;2026-04-10;;Vinieta;117;;;;vinjeta`

const splitCsvLine = (line: string) => {
  const separator = line.includes(';') ? ';' : ','
  return line.split(separator).map(part => part.trim().replace(/^"|"$/g, ''))
}

const toNumber = (value?: string) => {
  if (!value) return null
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

export default function UvozPodatkov() {
  const [cars, setCars] = useState<any[]>([])
  const [carId, setCarId] = useState('')
  const [csv, setCsv] = useState(sampleCsv)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/'; return }
      const { data } = await supabase.from('cars').select('id,znamka,model,km_trenutni').eq('user_id', user.id).order('created_at', { ascending: true })
      setCars(data || [])
      if (data?.[0]?.id) setCarId(data[0].id)
      trackEvent('external_import_open')
    }
    init()
  }, [])

  const rows = useMemo<ImportRow[]>(() => {
    const lines = csv.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
    if (lines.length < 2) return []
    const headers = splitCsvLine(lines[0]).map(h => h.toLowerCase())
    return lines.slice(1).map(line => {
      const values = splitCsvLine(line)
      const get = (name: string) => values[headers.indexOf(name)] || ''
      return {
        type: get('type').toLowerCase(),
        date: get('date'),
        km: toNumber(get('km')),
        description: get('description'),
        amount: toNumber(get('amount')),
        liters: toNumber(get('liters')),
        pricePerLiter: toNumber(get('price_per_liter')),
        station: get('station'),
        category: get('category'),
      }
    }).filter(row => ['fuel', 'service', 'expense'].includes(row.type) && row.date)
  }, [csv])

  const importData = async () => {
    if (!carId || rows.length === 0) return
    setLoading(true)
    setMessage('')

    const fuelRows = rows.filter(row => row.type === 'fuel').map(row => ({
      car_id: carId,
      datum: row.date,
      km: row.km,
      litri: row.liters,
      cena_na_liter: row.pricePerLiter,
      cena_skupaj: row.amount,
      postaja: row.station || row.description || 'Uvoz iz druge aplikacije',
      tip_goriva: null,
      verification_level: 'basic',
    }))
    const serviceRows = rows.filter(row => row.type === 'service').map(row => ({
      car_id: carId,
      datum: row.date,
      km: row.km,
      opis: row.description || 'Uvoz iz druge aplikacije',
      servis: row.station || null,
      cena: row.amount,
      verification_level: 'basic',
    }))
    const expenseRows = rows.filter(row => row.type === 'expense').map(row => ({
      car_id: carId,
      datum: row.date,
      kategorija: row.category || 'uvoz',
      opis: row.description || 'Uvoz iz druge aplikacije',
      znesek: row.amount || 0,
      verification_level: 'basic',
    }))

    try {
      if (fuelRows.length) await supabase.from('fuel_logs').insert(fuelRows)
      if (serviceRows.length) await supabase.from('service_logs').insert(serviceRows)
      if (expenseRows.length) await supabase.from('expenses').insert(expenseRows)
      const maxKm = rows.reduce((max, row) => row.km && row.km > max ? row.km : max, 0)
      if (maxKm > 0) await supabase.from('cars').update({ km_trenutni: maxKm }).eq('id', carId)
      trackEvent('external_import_saved', { rows: rows.length, fuel: fuelRows.length, service: serviceRows.length, expense: expenseRows.length })
      setMessage(`Uvozeno: ${fuelRows.length} tankanj, ${serviceRows.length} servisov, ${expenseRows.length} stroskov.`)
    } catch (error: any) {
      setMessage(error.message.includes('verification_level')
        ? 'Najprej v Supabase zazeni SUPABASE_MIGRACIJA_ZAUPANJE_PRENOS.sql, potem poskusi znova.'
        : 'Uvoz ni uspel: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#080810] px-4 py-6 pb-24">
      <div className="flex items-center gap-3 mb-6">
        <BackButton />
        <div>
          <h1 className="text-xl font-bold text-white">Uvoz iz drugih app</h1>
          <p className="text-[#7b7ba6] text-xs">CSV uvoz za gorivo, servise in stroske</p>
        </div>
      </div>

      <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5 space-y-4">
        <div>
          <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Vozilo</label>
          <select value={carId} onChange={e => setCarId(e.target.value)}
            className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff]">
            {cars.map(car => <option key={car.id} value={car.id}>{car.znamka} {car.model}</option>)}
          </select>
        </div>

        <div>
          <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">CSV podatki</label>
          <textarea value={csv} onChange={e => setCsv(e.target.value)} rows={10}
            className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-xs font-mono outline-none focus:border-[#6c63ff]" />
          <p className="text-[#7b7ba6] text-xs mt-2">Podprti tipi: fuel, service, expense. Uvozeni zapisi so oznaceni kot Basic, ker prihajajo iz zunanje aplikacije.</p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-[#13131f] border border-[#1e1e32] p-3 text-center">
            <p className="text-[#6c63ff] font-bold">{rows.filter(r => r.type === 'fuel').length}</p>
            <p className="text-[#7b7ba6] text-xs">Gorivo</p>
          </div>
          <div className="rounded-xl bg-[#13131f] border border-[#1e1e32] p-3 text-center">
            <p className="text-[#f59e0b] font-bold">{rows.filter(r => r.type === 'service').length}</p>
            <p className="text-[#7b7ba6] text-xs">Servisi</p>
          </div>
          <div className="rounded-xl bg-[#13131f] border border-[#1e1e32] p-3 text-center">
            <p className="text-[#3ecfcf] font-bold">{rows.filter(r => r.type === 'expense').length}</p>
            <p className="text-[#7b7ba6] text-xs">Stroski</p>
          </div>
        </div>

        <button onClick={importData} disabled={loading || !carId || rows.length === 0}
          className="w-full bg-[#6c63ff] text-white font-semibold py-3 rounded-xl disabled:opacity-50">
          {loading ? 'Uvažam...' : `Uvozi ${rows.length} zapisov`}
        </button>

        {message && <p className="rounded-xl border border-[#6c63ff44] bg-[#6c63ff18] p-3 text-sm text-[#a09aff]">{message}</p>}
      </div>

      <HomeButton />
    </div>
  )
}
