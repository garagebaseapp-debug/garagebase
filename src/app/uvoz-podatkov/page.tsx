'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { HomeButton, BackButton } from '@/lib/nav'
import { trackEvent } from '@/lib/analytics'
import { getStoredLanguage } from '@/lib/i18n'

type ImportType = 'fuel' | 'service' | 'expense'
type Language = 'sl' | 'en'

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

type PreviewRow = {
  date: string
  km: number | null
  description: string
  amount: number | null
  liters: number | null
  pricePerLiter: number | null
  station: string
  category: string
  fuelType: string | null
}

type ParsedSection = {
  name: string
  headers: string[]
  records: Record<string, string>[]
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
    const next = line[i + 1]

    if (char === '"' && quoted && next === '"') {
      current += '"'
      i++
      continue
    }
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

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')

const toNumber = (value?: string) => {
  if (!value) return null
  const cleaned = value
    .replace(/\s/g, '')
    .replace('EUR', '')
    .replace('€', '')
    .replace(',', '.')
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

const normalizeFuelType = (value?: string | null) => {
  const normalized = normalizeText(value || '')
  if (normalized.includes('premium') || normalized.includes('100')) return '100'
  if (normalized.includes('dizel') || normalized.includes('diesel')) return 'diesel'
  if (normalized.includes('bencin') || normalized.includes('petrol') || normalized.includes('gasoline') || normalized.includes('95')) return '95'
  return value || null
}

const findHeader = (headers: string[], options: string[]) => {
  const normalized = headers.map(normalizeText)
  const index = normalized.findIndex((header) => options.some((option) => header.includes(normalizeText(option))))
  return index >= 0 ? headers[index] : ''
}

const autoMapping = (headers: string[]): Mapping => ({
  date: findHeader(headers, ['date', 'datum', 'time']),
  km: findHeader(headers, ['odometer', 'mileage', 'kilometer', 'kilometri', 'km', 'stevec']),
  description: findHeader(headers, ['description', 'opis', 'note', 'notes', 'service', 'title', 'razlog']),
  amount: findHeader(headers, ['total', 'amount', 'cost', 'price', 'znesek', 'cena', 'value', 'skupni stroski']),
  liters: findHeader(headers, ['liters', 'litres', 'liter', 'litri', 'volume', 'volumen']),
  pricePerLiter: findHeader(headers, ['price/l', 'priceperliter', 'cena/l', 'cena na liter']),
  station: findHeader(headers, ['station', 'place', 'location', 'postaja', 'servis', 'workshop', 'bencinska crpalka']),
  category: findHeader(headers, ['category', 'type', 'kategorija', 'vrsta', 'vrsta stroska']),
  fuelType: findHeader(headers, ['fuel type', 'fuel', 'gorivo']),
})

const parseFlatCsv = (csv: string) => {
  const lines = csv.split(/\r?\n/).filter(line => line.trim())
  if (lines.length === 0) return { headers: [] as string[], records: [] as Record<string, string>[] }
  const separator = detectSeparator(lines[0])
  const headers = splitCsvLine(lines[0], separator)
  const records = lines.slice(1).map(line => {
    const values = splitCsvLine(line, separator)
    return headers.reduce((row, header, index) => ({ ...row, [header]: values[index] || '' }), {} as Record<string, string>)
  })
  return { headers, records }
}

const parseSectionedCsv = (csv: string): ParsedSection[] => {
  const sections: ParsedSection[] = []
  let current: ParsedSection | null = null
  let separator = ','
  let waitingForHeader = false

  for (const rawLine of csv.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue

    if (line.startsWith('##')) {
      current = { name: line.replace(/^##/, '').trim(), headers: [], records: [] }
      sections.push(current)
      waitingForHeader = true
      continue
    }

    if (!current) continue

    if (waitingForHeader) {
      separator = detectSeparator(line)
      current.headers = splitCsvLine(line, separator)
      waitingForHeader = false
      continue
    }

    const values = splitCsvLine(line, separator)
    current.records.push(current.headers.reduce((row, header, index) => ({ ...row, [header]: values[index] || '' }), {} as Record<string, string>))
  }

  return sections.filter(section => section.headers.length > 0)
}

const sectionToRows = (section: ParsedSection, importType: ImportType, language: Language): PreviewRow[] => {
  const map = autoMapping(section.headers)
  const fallbackDescription = language === 'en' ? 'Import from Drivvo' : 'Uvoz iz Drivvo'
  const sectionName = normalizeText(section.name)
  const isFuelSection = sectionName.includes('refuelling') || sectionName.includes('refueling') || sectionName.includes('fuel')
  const isExpenseSection = sectionName.includes('expense')
  const valueAt = (row: Record<string, string>, index: number, mappedHeader?: string) => {
    if (mappedHeader && row[mappedHeader]) return row[mappedHeader]
    const header = section.headers[index]
    return header ? row[header] || '' : ''
  }

  return section.records.map((row) => ({
    date: parseDate(isFuelSection || isExpenseSection ? valueAt(row, 1, map.date) : row[map.date]),
    km: toNumber(isFuelSection || isExpenseSection ? valueAt(row, 0, map.km) : row[map.km]),
    description: isExpenseSection
      ? valueAt(row, 3, map.category) || valueAt(row, 8, map.description) || fallbackDescription
      : row[map.description] || row[map.category] || fallbackDescription,
    amount: toNumber(isFuelSection ? valueAt(row, 4, map.amount) : isExpenseSection ? valueAt(row, 2, map.amount) : row[map.amount]),
    liters: toNumber(isFuelSection ? valueAt(row, 5, map.liters) : row[map.liters]),
    pricePerLiter: toNumber(isFuelSection ? valueAt(row, 3, map.pricePerLiter) : row[map.pricePerLiter]),
    station: isFuelSection ? valueAt(row, 19, map.station) : row[map.station] || '',
    category: isExpenseSection ? valueAt(row, 3, map.category) || 'uvoz' : row[map.category] || (importType === 'fuel' ? 'gorivo' : importType === 'service' ? 'servis' : 'uvoz'),
    fuelType: normalizeFuelType(isFuelSection ? valueAt(row, 2, map.fuelType) : row[map.fuelType]),
  })).filter(row => row.date)
}

export default function UvozPodatkov() {
  const [cars, setCars] = useState<any[]>([])
  const [carId, setCarId] = useState('')
  const [csv, setCsv] = useState(sampleCsv)
  const [importType, setImportType] = useState<ImportType>('fuel')
  const [mapping, setMapping] = useState<Mapping>(emptyMapping)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [language, setLanguage] = useState<Language>('sl')

  const tx = (sl: string, en: string) => language === 'en' ? en : sl

  useEffect(() => {
    setLanguage(getStoredLanguage() === 'en' ? 'en' : 'sl')
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/'; return }
      const params = new URLSearchParams(window.location.search)
      const carParam = params.get('car')
      const { data } = await supabase
        .from('cars')
        .select('id,znamka,model,km_trenutni')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
      setCars(data || [])
      const selected = data?.find((car: any) => car.id === carParam) || data?.[0]
      if (selected?.id) setCarId(selected.id)
      trackEvent('external_import_open')
    }
    init()
  }, [])

  const isDrivvo = csv.trimStart().startsWith('##')

  const parsed = useMemo(() => parseFlatCsv(csv), [csv])
  const drivvoSections = useMemo(() => isDrivvo ? parseSectionedCsv(csv) : [], [csv, isDrivvo])

  const activeDrivvoSection = useMemo(() => {
    if (!isDrivvo) return null
    const wanted = importType === 'fuel'
      ? ['refuelling', 'refueling', 'fuel']
      : importType === 'expense'
        ? ['expense', 'expenses', 'stroski']
        : ['service', 'servis']
    return drivvoSections.find(section => wanted.some(name => normalizeText(section.name).includes(normalizeText(name)))) || null
  }, [drivvoSections, importType, isDrivvo])

  useEffect(() => {
    if (!isDrivvo && parsed.headers.length > 0) setMapping(autoMapping(parsed.headers))
  }, [parsed.headers.join('|'), isDrivvo])

  const previewRows = useMemo(() => {
    if (activeDrivvoSection) return sectionToRows(activeDrivvoSection, importType, language)

    return parsed.records.map((row) => ({
      date: parseDate(row[mapping.date]),
      km: toNumber(row[mapping.km]),
      description: row[mapping.description] || row[mapping.category] || tx('Uvoz iz druge aplikacije', 'Import from another app'),
      amount: toNumber(row[mapping.amount]),
      liters: toNumber(row[mapping.liters]),
      pricePerLiter: toNumber(row[mapping.pricePerLiter]),
      station: row[mapping.station] || '',
      category: row[mapping.category] || (importType === 'fuel' ? 'gorivo' : importType === 'service' ? 'servis' : 'uvoz'),
      fuelType: row[mapping.fuelType] || null,
    })).filter(row => row.date)
  }, [activeDrivvoSection, parsed.records, mapping, importType, language])

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
      let inserted = 0

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
        inserted = rows.length
        if (rows.length) {
          const { error } = await supabase.from('fuel_logs').insert(rows)
          if (error) throw error
        }
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
        inserted = rows.length
        if (rows.length) {
          const { error } = await supabase.from('service_logs').insert(rows)
          if (error) throw error
        }
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
        inserted = rows.length
        if (rows.length) {
          const { error } = await supabase.from('expenses').insert(rows)
          if (error) throw error
        }
      }

      const maxKm = previewRows.reduce((max, row) => row.km && row.km > max ? row.km : max, 0)
      if (maxKm > 0) {
        const { error } = await supabase.from('cars').update({ km_trenutni: maxKm }).eq('id', carId)
        if (error) throw error
      }
      trackEvent('external_import_saved', { rows: inserted, skipped, importType, source: isDrivvo ? 'drivvo' : 'generic' })
      setMessage(tx(`Uvozeno ${inserted} zapisov. Preskoceno podvojenih: ${skipped}.`, `Imported ${inserted} records. Skipped duplicates: ${skipped}.`))
    } catch (error: any) {
      setMessage(error.message?.includes('verification_level')
        ? tx('Najprej v Supabase zazeni migracijo za zaupanje/prenos, potem poskusi znova.', 'First run the trust/transfer migration in Supabase, then try again.')
        : tx('Uvoz ni uspel: ', 'Import failed: ') + (error.message || tx('neznana napaka', 'unknown error')))
    } finally {
      setLoading(false)
    }
  }

  const SelectMap = ({ field, label }: { field: keyof Mapping, label: string }) => (
    <label className="block">
      <span className="text-[#5a5a80] text-xs uppercase tracking-wider mb-1 block">{label}</span>
      <select value={mapping[field]} onChange={e => setMapping({ ...mapping, [field]: e.target.value })}
        className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-[#6c63ff]">
        <option value="">{tx('-- brez --', '-- none --')}</option>
        {parsed.headers.map(header => <option key={header} value={header}>{header}</option>)}
      </select>
    </label>
  )

  const typeLabel = (type: ImportType) => {
    if (type === 'fuel') return tx('Gorivo', 'Fuel')
    if (type === 'service') return tx('Servis', 'Service')
    return tx('Stroski', 'Costs')
  }

  return (
    <div className="min-h-screen bg-[#080810] px-4 py-6 pb-24">
      <div className="flex items-center gap-3 mb-6">
        <BackButton />
        <div>
          <h1 className="text-xl font-bold text-white">{tx('Uvoz iz drugih app', 'Import from other apps')}</h1>
          <p className="text-[#7b7ba6] text-xs">{tx('Najprej izberi vozilo, nato nalozi CSV. Drivvo se prepozna samodejno.', 'Choose the vehicle first, then upload the CSV. Drivvo is detected automatically.')}</p>
        </div>
      </div>

      <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5 space-y-5">
        <div>
          <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">{tx('Vozilo', 'Vehicle')}</label>
          <select value={carId} onChange={e => setCarId(e.target.value)}
            className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff]">
            {cars.map(car => <option key={car.id} value={car.id}>{car.znamka} {car.model}</option>)}
          </select>
          <p className="mt-2 text-[#7b7ba6] text-xs">{tx('Uvoz bo shranjen samo na izbrano vozilo.', 'The import will be saved only to the selected vehicle.')}</p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {(['fuel', 'service', 'expense'] as ImportType[]).map(type => (
            <button key={type} onClick={() => setImportType(type)}
              className={`rounded-xl border px-3 py-3 text-sm font-bold ${importType === type ? 'bg-[#6c63ff] border-[#6c63ff] text-white' : 'bg-[#13131f] border-[#1e1e32] text-[#7b7ba6]'}`}>
              {typeLabel(type)}
            </button>
          ))}
        </div>

        <label className="block rounded-xl border border-dashed border-[#6c63ff66] bg-[#6c63ff11] p-4 text-center cursor-pointer">
          <input type="file" accept=".csv,text/csv" onChange={e => handleFile(e.target.files?.[0])} className="hidden" />
          <span className="text-[#a09aff] font-bold">{tx('Nalozi CSV datoteko', 'Upload CSV file')}</span>
          <p className="mt-1 text-[#7b7ba6] text-xs">{tx('Ce ne gre, lahko vsebino CSV tudi prilepis spodaj.', 'If upload does not work, paste the CSV content below.')}</p>
        </label>

        {isDrivvo && (
          <div className="rounded-xl border border-[#3ecfcf55] bg-[#3ecfcf14] p-3">
            <p className="text-[#3ecfcf] text-sm font-bold">{tx('Drivvo CSV prepoznan', 'Drivvo CSV detected')}</p>
            <p className="text-[#b7f7f7] text-xs mt-1">
              {activeDrivvoSection
                ? tx(`Berem sekcijo: ${activeDrivvoSection.name}.`, `Reading section: ${activeDrivvoSection.name}.`)
                : tx('Za izbrano vrsto ni najdene sekcije. Poskusi Gorivo ali Stroski.', 'No section found for the selected type. Try Fuel or Costs.')}
            </p>
          </div>
        )}

        <div>
          <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">{tx('CSV podatki', 'CSV data')}</label>
          <textarea value={csv} onChange={e => setCsv(e.target.value)} rows={8}
            className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-xs font-mono outline-none focus:border-[#6c63ff]" />
        </div>

        {!isDrivvo && (
          <div className="rounded-2xl border border-[#1e1e32] bg-[#13131f] p-4">
            <p className="text-white font-bold mb-3">{tx('Povezi stolpce', 'Map columns')}</p>
            <div className="grid grid-cols-2 gap-3">
              <SelectMap field="date" label={tx('Datum', 'Date')} />
              <SelectMap field="km" label={tx('Kilometri', 'Mileage')} />
              <SelectMap field="description" label={tx('Opis', 'Description')} />
              <SelectMap field="amount" label={tx('Znesek', 'Amount')} />
              {importType === 'fuel' && <SelectMap field="liters" label={tx('Litri', 'Liters')} />}
              {importType === 'fuel' && <SelectMap field="pricePerLiter" label={tx('Cena/L', 'Price/L')} />}
              <SelectMap field="station" label={importType === 'service' ? tx('Servis', 'Service shop') : tx('Postaja / lokacija', 'Station / location')} />
              <SelectMap field="category" label={tx('Kategorija', 'Category')} />
              {importType === 'fuel' && <SelectMap field="fuelType" label={tx('Tip goriva', 'Fuel type')} />}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-[#1e1e32] bg-[#13131f] p-4">
          <div className="flex justify-between items-center mb-3">
            <p className="text-white font-bold">{tx('Predogled', 'Preview')}</p>
            <p className="text-[#3ecfcf] font-black">{previewRows.length} {tx('vrstic', 'rows')}</p>
          </div>
          <div className="max-h-56 overflow-auto flex flex-col gap-2">
            {previewRows.slice(0, 8).map((row, index) => (
              <div key={index} className="rounded-xl bg-[#0f0f1a] border border-[#1e1e32] p-3">
                <p className="text-white text-sm font-bold">{row.date} - {row.description}</p>
                <p className="text-[#7b7ba6] text-xs mt-1">{row.km ? `${row.km.toLocaleString()} km` : tx('brez km', 'no mileage')} | {row.amount ? `${row.amount.toFixed(2)} EUR` : tx('brez zneska', 'no amount')} | {row.station || row.category}</p>
              </div>
            ))}
            {previewRows.length === 0 && <p className="text-[#7b7ba6] text-sm">{tx('Ni prepoznanih vrstic. Preveri datum stolpec ali izbrano sekcijo.', 'No rows detected. Check the date column or selected section.')}</p>}
          </div>
        </div>

        <button onClick={importData} disabled={loading || !carId || previewRows.length === 0}
          className="w-full bg-[#6c63ff] text-white font-semibold py-3 rounded-xl disabled:opacity-50">
          {loading ? tx('Uvazam...', 'Importing...') : tx(`Uvozi ${previewRows.length} zapisov`, `Import ${previewRows.length} records`)}
        </button>

        {message && <p className="rounded-xl border border-[#6c63ff44] bg-[#6c63ff18] p-3 text-sm text-[#a09aff]">{message}</p>}
      </div>

      <HomeButton />
    </div>
  )
}
