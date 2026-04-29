'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BackButton, HomeButton } from '@/lib/nav'
import { trackEvent } from '@/lib/analytics'

type ImportType = 'fuel' | 'service' | 'expense'
type Mapping = {
  date: string
  km: string
  description: string
  amount: string
  liters: string
  pricePerLiter: string
  station: string
  category: string
  fuelType: string
}

const emptyMapping: Mapping = {
  date: '',
  km: '',
  description: '',
  amount: '',
  liters: '',
  pricePerLiter: '',
  station: '',
  category: '',
  fuelType: '',
}

const sampleCsv = `Date,Vehicle,Odometer,Description,Total,Liters,Price/L,Station,Category
2026-04-29,Volvo XC90,178900,OMV fill-up,84.00,50,1.68,OMV Ljubljana,Fuel
2026-04-20,Volvo XC90,178000,Oil service,220,,,,Service
2026-04-10,Volvo XC90,,Vignette,117,,,,Vignette`

const splitCsvLine = (line: string, separator: string) => {
  const result: string[] = []
  let current = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      quoted = !quoted
      continue
    }
    if (char === separator && !quoted) {
      result.push(current.trim())
      current = ''
      continue
    }
    current += char
  }
  result.push(current.trim())
  return result
}

const detectSeparator = (line: string) => {
  const semicolon = (line.match(/;/g) || []).length
  const comma = (line.match(/,/g) || []).length
  return semicolon > comma ? ';' : ','
}

const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9čšžćđ]/gi, '')

const toNumber = (value?: string) => {
  if (!value) return null
  const cleaned = value.replace(/\s/g, '').replace('€', '').replace(',', '.')
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

const parseDate = (value?: string) => {
  if (!value) return ''
  const trimmed = value.trim()
  const iso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`
  const eu = trimmed.match(/^(\d{1,2})[.\/-]\s*(\d{1,2})[.\/-]\s*(\d{4})/)
  if (eu) return `${eu[3]}-${eu[2].padStart(2, '0')}-${eu[1].padStart(2, '0')}`
  return trimmed
}

const findHeader = (headers: string[], options: string[]) => {
  const normalized = headers.map(norm)
  return headers[normalized.findIndex((header) => options.some((option) => header.includes(norm(option))))] || ''
}

const autoMapping = (headers: string[]): Mapping => ({
  date: findHeader(headers, ['date', 'datum', 'time']),
  km: findHeader(headers, ['odometer', 'mileage', 'kilometer', 'kilometri', 'km']),
  description: findHeader(headers, ['description', 'opis', 'note', 'notes', 'service', 'title']),
  amount: findHeader(headers, ['total', 'amount', 'cost', 'price', 'znesek', 'cena', 'value']),
  liters: findHeader(headers, ['liters', 'litres', 'liter', 'litri', 'l']),
  pricePerLiter: findHeader(headers, ['price/l', 'priceperliter', 'cena/l', 'cena na liter']),
  station: findHeader(headers, ['station', 'place', 'location', 'postaja', 'servis', 'workshop']),
  category: findHeader(headers, ['category', 'type', 'kategorija', 'vrsta']),
  fuelType: findHeader(headers, ['fuel type', 'fuel', 'gorivo']),
})

export default function UvozPodatkov() {
  const [cars, setCars] = useState<any[]>([])
  const [carId, setCarId] = useState('')
  const [csv, setCsv] = useState(sampleCsv)
  const [importType, setImportType] = useState<ImportType>('fuel')
  const [mapping, setMapping] = useState<Mapping>(emptyMapping)
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

  const parsed = useMemo(() => {
    const lines = csv.split(/\r?\n/).filter(line => line.trim())
    if (lines.length === 0) return { headers: [] as string[], records: [] as Record<string, string>[] }
    const separator = detectSeparator(lines[0])
    const headers = splitCsvLine(lines[0], separator)
    const records = lines.slice(1).map(line => {
      const values = splitCsvLine(line, separator)
      return headers.reduce((row, header, index) => ({ ...row, [header]: values[index] || '' }), {} as Record<string, string>)
    })
    return { headers, records }
  }, [csv])

  useEffect(() => {
    if (parsed.headers.length > 0) setMapping(autoMapping(parsed.headers))
  }, [parsed.headers.join('|')])

  const previewRows = useMemo(() => {
    return parsed.records.map((row) => ({
      date: parseDate(row[mapping.date]),
      km: toNumber(row[mapping.km]),
      description: row[mapping.description] || row[mapping.category] || 'Uvoz iz druge aplikacije',
      amount: toNumber(row[mapping.amount]),
      liters: toNumber(row[mapping.liters]),
      pricePerLiter: toNumber(row[mapping.pricePerLiter]),
      station: row[mapping.station] || '',
      category: row[mapping.category] || (importType === 'fuel' ? 'gorivo' : importType === 'service' ? 'servis' : 'uvoz'),
      fuelType: row[mapping.fuelType] || null,
    })).filter(row => row.date)
  }, [parsed.records, mapping, importType])

  const handleFile = async (file?: File) => {
    if (!file) return
    setCsv(await file.text())
    setMessage('')
  }

  const importData = async () => {
    if (!carId || previewRows.length === 0) return
    setLoading(true)
    setMessage('')

    try {
      const duplicateKey = (row: any) => [row.datum, row.km || '', row.cena_skupaj || row.cena || row.znesek || '', row.postaja || row.servis || row.opis || ''].join('|').toLowerCase()
      let skipped = 0

      if (importType === 'fuel') {
        const { data: existing } = await supabase.from('fuel_logs').select('datum,km,cena_skupaj,postaja').eq('car_id', carId)
        const existingKeys = new Set((existing || []).map(duplicateKey))
        const rows = previewRows.map(row => ({
          car_id: carId,
          datum: row.date,
          km: row.km,
          litri: row.liters,
          cena_na_liter: row.pricePerLiter,
          cena_skupaj: row.amount,
          postaja: row.station || row.description,
          tip_goriva: row.fuelType,
          verification_level: 'basic',
        })).filter(row => {
          const duplicate = existingKeys.has(duplicateKey(row))
          if (duplicate) skipped++
          return !duplicate
        })
        if (rows.length) await supabase.from('fuel_logs').insert(rows)
      }

      if (importType === 'service') {
        const { data: existing } = await supabase.from('service_logs').select('datum,km,cena,servis,opis').eq('car_id', carId)
        const existingKeys = new Set((existing || []).map(duplicateKey))
        const rows = previewRows.map(row => ({
          car_id: carId,
          datum: row.date,
          km: row.km,
          opis: row.description,
          servis: row.station || null,
          cena: row.amount,
          verification_level: 'basic',
        })).filter(row => {
          const duplicate = existingKeys.has(duplicateKey(row))
          if (duplicate) skipped++
          return !duplicate
        })
        if (rows.length) await supabase.from('service_logs').insert(rows)
      }

      if (importType === 'expense') {
        const { data: existing } = await supabase.from('expenses').select('datum,znesek,kategorija,opis').eq('car_id', carId)
        const existingKeys = new Set((existing || []).map(duplicateKey))
        const rows = previewRows.map(row => ({
          car_id: carId,
          datum: row.date,
          kategorija: row.category || 'uvoz',
          opis: row.description,
          znesek: row.amount || 0,
          verification_level: 'basic',
        })).filter(row => {
          const duplicate = existingKeys.has(duplicateKey(row))
          if (duplicate) skipped++
          return !duplicate
        })
        if (rows.length) await supabase.from('expenses').insert(rows)
      }

      const maxKm = previewRows.reduce((max, row) => row.km && row.km > max ? row.km : max, 0)
      if (maxKm > 0) await supabase.from('cars').update({ km_trenutni: maxKm }).eq('id', carId)
      trackEvent('external_import_saved', { rows: previewRows.length, skipped, importType })
      setMessage(`Uvozeno ${previewRows.length - skipped} zapisov. Preskoceno podvojenih: ${skipped}.`)
    } catch (error: any) {
      setMessage(error.message?.includes('verification_level')
        ? 'Najprej v Supabase zazeni SUPABASE_MIGRACIJA_ZAUPANJE_PRENOS.sql, potem poskusi znova.'
        : 'Uvoz ni uspel: ' + (error.message || 'neznana napaka'))
    } finally {
      setLoading(false)
    }
  }

  const SelectMap = ({ field, label }: { field: keyof Mapping, label: string }) => (
    <label className="block">
      <span className="text-[#5a5a80] text-xs uppercase tracking-wider mb-1 block">{label}</span>
      <select value={mapping[field]} onChange={e => setMapping({ ...mapping, [field]: e.target.value })}
        className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-[#6c63ff]">
        <option value="">-- brez --</option>
        {parsed.headers.map(header => <option key={header} value={header}>{header}</option>)}
      </select>
    </label>
  )

  return (
    <div className="min-h-screen bg-[#080810] px-4 py-6 pb-24">
      <div className="flex items-center gap-3 mb-6">
        <BackButton />
        <div>
          <h1 className="text-xl font-bold text-white">Uvoz iz drugih app</h1>
          <p className="text-[#7b7ba6] text-xs">Nalozi CSV iz Drivvo ali druge aplikacije in povezi stolpce.</p>
        </div>
      </div>

      <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5 space-y-5">
        <div>
          <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Vozilo</label>
          <select value={carId} onChange={e => setCarId(e.target.value)}
            className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff]">
            {cars.map(car => <option key={car.id} value={car.id}>{car.znamka} {car.model}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {(['fuel', 'service', 'expense'] as ImportType[]).map(type => (
            <button key={type} onClick={() => setImportType(type)}
              className={`rounded-xl border px-3 py-3 text-sm font-bold ${importType === type ? 'bg-[#6c63ff] border-[#6c63ff] text-white' : 'bg-[#13131f] border-[#1e1e32] text-[#7b7ba6]'}`}>
              {type === 'fuel' ? 'Gorivo' : type === 'service' ? 'Servis' : 'Stroski'}
            </button>
          ))}
        </div>

        <label className="block rounded-xl border border-dashed border-[#6c63ff66] bg-[#6c63ff11] p-4 text-center cursor-pointer">
          <input type="file" accept=".csv,text/csv" onChange={e => handleFile(e.target.files?.[0])} className="hidden" />
          <span className="text-[#a09aff] font-bold">Nalozi CSV datoteko</span>
          <p className="mt-1 text-[#7b7ba6] text-xs">Ce ne gre, lahko vsebino CSV tudi prilepis spodaj.</p>
        </label>

        <div>
          <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">CSV podatki</label>
          <textarea value={csv} onChange={e => setCsv(e.target.value)} rows={8}
            className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-xs font-mono outline-none focus:border-[#6c63ff]" />
        </div>

        <div className="rounded-2xl border border-[#1e1e32] bg-[#13131f] p-4">
          <p className="text-white font-bold mb-3">Povezi stolpce</p>
          <div className="grid grid-cols-2 gap-3">
            <SelectMap field="date" label="Datum" />
            <SelectMap field="km" label="Kilometri" />
            <SelectMap field="description" label="Opis" />
            <SelectMap field="amount" label="Znesek" />
            {importType === 'fuel' && <SelectMap field="liters" label="Litri" />}
            {importType === 'fuel' && <SelectMap field="pricePerLiter" label="Cena/L" />}
            <SelectMap field="station" label={importType === 'service' ? 'Servis' : 'Postaja / lokacija'} />
            <SelectMap field="category" label="Kategorija" />
            {importType === 'fuel' && <SelectMap field="fuelType" label="Tip goriva" />}
          </div>
        </div>

        <div className="rounded-2xl border border-[#1e1e32] bg-[#13131f] p-4">
          <div className="flex justify-between items-center mb-3">
            <p className="text-white font-bold">Predogled</p>
            <p className="text-[#3ecfcf] font-black">{previewRows.length} vrstic</p>
          </div>
          <div className="max-h-56 overflow-auto flex flex-col gap-2">
            {previewRows.slice(0, 8).map((row, index) => (
              <div key={index} className="rounded-xl bg-[#0f0f1a] border border-[#1e1e32] p-3">
                <p className="text-white text-sm font-bold">{row.date} - {row.description}</p>
                <p className="text-[#7b7ba6] text-xs mt-1">{row.km ? `${row.km.toLocaleString()} km` : 'brez km'} | {row.amount ? `${row.amount.toFixed(2)} EUR` : 'brez zneska'} | {row.station || row.category}</p>
              </div>
            ))}
            {previewRows.length === 0 && <p className="text-[#7b7ba6] text-sm">Ni prepoznanih vrstic. Preveri datum stolpec.</p>}
          </div>
        </div>

        <button onClick={importData} disabled={loading || !carId || previewRows.length === 0}
          className="w-full bg-[#6c63ff] text-white font-semibold py-3 rounded-xl disabled:opacity-50">
          {loading ? 'Uvazam...' : `Uvozi ${previewRows.length} zapisov`}
        </button>

        {message && <p className="rounded-xl border border-[#6c63ff44] bg-[#6c63ff18] p-3 text-sm text-[#a09aff]">{message}</p>}
      </div>

      <HomeButton />
    </div>
  )
}
