'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { HomeButton, BackButton } from '@/lib/nav'
import { trackEvent } from '@/lib/analytics'
import { getStoredLanguage } from '@/lib/i18n'
import { type GarageBaseCurrency, formatMoney, getCurrencyFromSettings } from '@/lib/currency'

type ImportType = 'drivvo' | 'fuel' | 'service' | 'expense'
type ImportKind = 'fuel' | 'service' | 'expense'
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
  kind: ImportKind
  source: string
  date: string
  km: number | null
  description: string
  amount: number | null
  liters: number | null
  pricePerLiter: number | null
  station: string
  category: string
  fuelType: string | null
  fullTank?: string
  consumption?: string
  distance?: number | null
  driver?: string
  reason?: string
  payment?: string
  notes?: string
  importDetails?: string
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

const classifySection = (sectionName: string): ImportKind => {
  const normalized = normalizeText(sectionName)
  if (normalized.includes('refuelling') || normalized.includes('refueling') || normalized.includes('fuel') || normalized.includes('tank')) return 'fuel'
  if (normalized.includes('service') || normalized.includes('servis') || normalized.includes('maintenance')) return 'service'
  return 'expense'
}

const normalizeCategory = (value?: string | null) => {
  const normalized = normalizeText(value || '')
  if (normalized.includes('vinjeta') || normalized.includes('vignette')) return 'vinjeta'
  if (normalized.includes('registr')) return 'registracija'
  if (normalized.includes('zavar') || normalized.includes('insurance')) return 'zavarovanje'
  if (normalized.includes('gume') || normalized.includes('tire') || normalized.includes('tyre')) return 'gume'
  if (normalized.includes('tehnic') || normalized.includes('inspection')) return 'tehnicni'
  if (normalized.includes('lizing') || normalized.includes('leasing')) return 'lizing'
  if (normalized.includes('servis') || normalized.includes('service') || normalized.includes('repair')) return 'servis'
  return value || 'uvoz'
}

const asText = (value?: string | number | null) => (value === undefined || value === null ? '' : String(value).trim())

const joinDetails = (details: Array<[string, string | number | null | undefined]>) =>
  details
    .map(([label, value]) => [label, asText(value)] as [string, string])
    .filter(([, value]) => value && value !== '0' && value !== '0 L/100km' && value !== 'No')
    .map(([label, value]) => `${label}: ${value}`)
    .join(' | ')

const withImportNote = (base: string, details: string) => {
  if (!details) return base
  return base ? `${base} [Drivvo: ${details}]` : `[Drivvo: ${details}]`
}

const hashToUuid = (value: string) => {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  let h3 = 0x9e3779b9
  let h4 = 0x85ebca6b
  for (let i = 0; i < value.length; i++) {
    const ch = value.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
    h3 = Math.imul(h3 ^ ch, 2246822507)
    h4 = Math.imul(h4 ^ ch, 3266489909)
  }
  h1 = (Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)) >>> 0
  h2 = (Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)) >>> 0
  h3 = (Math.imul(h3 ^ (h3 >>> 16), 2246822507) ^ Math.imul(h4 ^ (h4 >>> 13), 3266489909)) >>> 0
  h4 = (Math.imul(h4 ^ (h4 >>> 16), 2246822507) ^ Math.imul(h3 ^ (h3 >>> 13), 3266489909)) >>> 0
  const hex = [h1, h2, h3, h4].map(part => part.toString(16).padStart(8, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
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
  const kind = classifySection(section.name)
  const isFuelSection = kind === 'fuel'
  const isExpenseSection = kind === 'expense'
  const isServiceSection = kind === 'service'
  const valueAt = (row: Record<string, string>, index: number, mappedHeader?: string) => {
    if (mappedHeader && row[mappedHeader]) return row[mappedHeader]
    const header = section.headers[index]
    return header ? row[header] || '' : ''
  }

  return section.records.map((row) => {
    const date = parseDate(isFuelSection || isExpenseSection ? valueAt(row, 1, map.date) : row[map.date])
    const km = toNumber(isFuelSection || isExpenseSection ? valueAt(row, 0, map.km) : row[map.km])
    const fullTank = isFuelSection ? valueAt(row, 6) : ''
    const consumption = isFuelSection ? valueAt(row, 17) : ''
    const distance = isFuelSection ? toNumber(valueAt(row, 18)) : null
    const station = isFuelSection ? valueAt(row, 19, map.station) : row[map.station] || ''
    const driver = isFuelSection ? valueAt(row, 20) : isExpenseSection ? valueAt(row, 5) : ''
    const reason = isFuelSection ? valueAt(row, 21) : isExpenseSection ? valueAt(row, 6) : ''
    const payment = isFuelSection ? valueAt(row, 22) : isExpenseSection ? valueAt(row, 7) : ''
    const notes = isFuelSection ? valueAt(row, 23) : isExpenseSection ? valueAt(row, 8, map.description) : row[map.description] || ''
    const rawCategory = isExpenseSection ? valueAt(row, 3, map.category) : row[map.category]
    const description = isFuelSection
      ? (notes || station || fallbackDescription)
      : isExpenseSection
        ? rawCategory || notes || fallbackDescription
        : row[map.description] || row[map.category] || fallbackDescription
    const importDetails = isFuelSection
      ? joinDetails([
          [language === 'en' ? 'Full tank' : 'Poln tank', fullTank],
          [language === 'en' ? 'Consumption' : 'Poraba', consumption],
          [language === 'en' ? 'Distance' : 'Razdalja', distance ? `${distance} km` : ''],
          [language === 'en' ? 'Driver' : 'Voznik', driver],
          [language === 'en' ? 'Reason' : 'Razlog', reason],
          [language === 'en' ? 'Payment' : 'Placilo', payment],
          [language === 'en' ? 'Note' : 'Opomba', notes],
        ])
      : joinDetails([
          [language === 'en' ? 'Mileage' : 'Kilometri', km ? `${km} km` : ''],
          [language === 'en' ? 'Driver' : 'Voznik', driver],
          [language === 'en' ? 'Reason' : 'Razlog', reason],
          [language === 'en' ? 'Payment' : 'Placilo', payment],
          [language === 'en' ? 'Note' : 'Opomba', notes],
        ])

    return {
      kind: importType === 'service' ? 'service' : kind,
      source: 'Drivvo',
      date,
      km,
      description,
      amount: toNumber(isFuelSection ? valueAt(row, 4, map.amount) : isExpenseSection ? valueAt(row, 2, map.amount) : row[map.amount]),
      liters: toNumber(isFuelSection ? valueAt(row, 5, map.liters) : row[map.liters]),
      pricePerLiter: toNumber(isFuelSection ? valueAt(row, 3, map.pricePerLiter) : row[map.pricePerLiter]),
      station,
      category: isExpenseSection ? normalizeCategory(rawCategory) : row[map.category] || (isServiceSection ? 'servis' : isFuelSection ? 'gorivo' : 'uvoz'),
      fuelType: normalizeFuelType(isFuelSection ? valueAt(row, 2, map.fuelType) : row[map.fuelType]),
      fullTank,
      consumption,
      distance,
      driver,
      reason,
      payment,
      notes,
      importDetails,
    }
  }).filter(row => row.date)
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
  const [valuta, setValuta] = useState<GarageBaseCurrency>('EUR')

  const tx = (sl: string, en: string) => language === 'en' ? en : sl

  useEffect(() => {
    setLanguage(getStoredLanguage() === 'en' ? 'en' : 'sl')
    setValuta(getCurrencyFromSettings())
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
    if (!isDrivvo || importType === 'drivvo') return null
    const wanted = importType === 'fuel'
      ? ['refuelling', 'refueling', 'fuel']
      : importType === 'expense'
        ? ['expense', 'expenses', 'stroski']
        : ['service', 'servis']
    return drivvoSections.find(section => wanted.some(name => normalizeText(section.name).includes(normalizeText(name)))) || null
  }, [drivvoSections, importType, isDrivvo])

  const drivvoRows = useMemo(() => {
    if (!isDrivvo) return []
    return drivvoSections.flatMap(section => sectionToRows(section, classifySection(section.name), language))
  }, [drivvoSections, isDrivvo, language])

  useEffect(() => {
    if (!isDrivvo && parsed.headers.length > 0) setMapping(autoMapping(parsed.headers))
  }, [parsed.headers.join('|'), isDrivvo])

  const previewRows = useMemo<PreviewRow[]>(() => {
    if (importType === 'drivvo') return drivvoRows
    if (activeDrivvoSection) return sectionToRows(activeDrivvoSection, importType, language)

    return parsed.records.map((row) => {
      const kind: ImportKind = importType === 'service' ? 'service' : importType === 'expense' ? 'expense' : 'fuel'
      return {
        kind,
        source: 'CSV',
        date: parseDate(row[mapping.date]),
        km: toNumber(row[mapping.km]),
        description: row[mapping.description] || row[mapping.category] || tx('Uvoz iz druge aplikacije', 'Import from another app'),
        amount: toNumber(row[mapping.amount]),
        liters: toNumber(row[mapping.liters]),
        pricePerLiter: toNumber(row[mapping.pricePerLiter]),
        station: row[mapping.station] || '',
        category: row[mapping.category] || (importType === 'fuel' ? 'gorivo' : importType === 'service' ? 'servis' : 'uvoz'),
        fuelType: row[mapping.fuelType] || null,
      }
    }).filter(row => row.date)
  }, [activeDrivvoSection, drivvoRows, parsed.records, mapping, importType, language])

  const handleFile = async (file?: File) => {
    if (!file) return
    const text = await file.text()
    setCsv(text)
    if (text.trimStart().startsWith('##')) setImportType('drivvo')
    setMessage('')
  }

  const importData = async () => {
    if (!carId || previewRows.length === 0) return
    setLoading(true)
    setMessage('')

    try {
      const importStamp = new Date().toISOString()
      const importSource = isDrivvo ? 'Drivvo' : 'CSV'
      const importedLabel = (source?: string) => `${source || importSource} import | ${importStamp}`
      const duplicateKey = (row: any) =>
        [row.source_entry_id || '', row.datum, row.km || '', row.cena_skupaj || row.cena || row.znesek || '', row.postaja || row.servis || row.opis || ''].join('|').toLowerCase()
      const sourceEntryId = (kind: ImportKind, row: PreviewRow) =>
        hashToUuid(`${carId}|${row.source || importSource}|${kind}|${row.date}|${row.km || ''}|${row.amount || ''}|${row.liters || ''}|${row.station || ''}|${row.description || ''}`)
      let skipped = 0
      const filterUniqueRows = <T extends Record<string, any>>(rows: T[], existingKeys: Set<string>) => {
        const importKeys = new Set<string>()
        return rows.filter(row => {
          const key = duplicateKey(row)
          const duplicate = existingKeys.has(key) || importKeys.has(key)
          if (duplicate) skipped++
          else importKeys.add(key)
          return !duplicate
        })
      }
      const insertedByType = { fuel: 0, service: 0, expense: 0 }

      const fuelRows = previewRows.filter(row => row.kind === 'fuel')
      if (fuelRows.length) {
        const { data: existing } = await supabase.from('fuel_logs').select('datum,km,cena_skupaj,postaja,source_entry_id').eq('car_id', carId)
        const existingKeys = new Set((existing || []).map(duplicateKey))
        const rows = filterUniqueRows(fuelRows.map(row => ({
          car_id: carId,
          datum: row.date,
          km: row.km,
          litri: row.liters,
          cena_na_liter: row.pricePerLiter,
          cena_skupaj: row.amount,
          postaja: withImportNote(row.station || row.description, row.importDetails || ''),
          tip_goriva: row.fuelType,
          verification_level: 'basic',
          source_owner_label: importedLabel(row.source),
          source_entry_id: sourceEntryId('fuel', row),
          locked_at: importStamp,
        })), existingKeys)
        insertedByType.fuel = rows.length
        if (rows.length) {
          const { error } = await supabase.from('fuel_logs').insert(rows)
          if (error) throw error
        }
      }

      const serviceRows = previewRows.filter(row => row.kind === 'service')
      if (serviceRows.length) {
        const { data: existing } = await supabase.from('service_logs').select('datum,km,cena,servis,opis,source_entry_id').eq('car_id', carId)
        const existingKeys = new Set((existing || []).map(duplicateKey))
        const rows = filterUniqueRows(serviceRows.map(row => ({
          car_id: carId,
          datum: row.date,
          km: row.km,
          opis: withImportNote(row.description, row.importDetails || ''),
          servis: row.station || null,
          cena: row.amount,
          verification_level: 'basic',
          source_owner_label: importedLabel(row.source),
          source_entry_id: sourceEntryId('service', row),
          locked_at: importStamp,
        })), existingKeys)
        insertedByType.service = rows.length
        if (rows.length) {
          const { error } = await supabase.from('service_logs').insert(rows)
          if (error) throw error
        }
      }

      const expenseRows = previewRows.filter(row => row.kind === 'expense')
      if (expenseRows.length) {
        const { data: existing } = await supabase.from('expenses').select('datum,znesek,kategorija,opis,source_entry_id').eq('car_id', carId)
        const existingKeys = new Set((existing || []).map(duplicateKey))
        const rows = filterUniqueRows(expenseRows.map(row => ({
          car_id: carId,
          datum: row.date,
          kategorija: row.category || 'uvoz',
          opis: withImportNote(row.description, row.importDetails || ''),
          znesek: row.amount || 0,
          verification_level: 'basic',
          source_owner_label: importedLabel(row.source),
          source_entry_id: sourceEntryId('expense', row),
          locked_at: importStamp,
        })), existingKeys)
        insertedByType.expense = rows.length
        if (rows.length) {
          const { error } = await supabase.from('expenses').insert(rows)
          if (error) throw error
        }
      }

      const maxKm = previewRows.reduce((max, row) => row.km && row.km > max ? row.km : max, 0)
      if (maxKm > 0) {
        const { data: currentCar } = await supabase.from('cars').select('km_trenutni').eq('id', carId).maybeSingle()
        const safeKm = Math.max(currentCar?.km_trenutni || 0, maxKm)
        const { error } = await supabase.from('cars').update({ km_trenutni: safeKm }).eq('id', carId)
        if (error) throw error
      }
      const inserted = insertedByType.fuel + insertedByType.service + insertedByType.expense
      trackEvent('external_import_saved', { rows: inserted, skipped, importType, source: isDrivvo ? 'drivvo' : 'generic', insertedByType })
      setMessage(tx(
        `Uvozeno ${inserted} zapisov: gorivo ${insertedByType.fuel}, servisi ${insertedByType.service}, stroski ${insertedByType.expense}. Preskoceno podvojenih: ${skipped}.`,
        `Imported ${inserted} records: fuel ${insertedByType.fuel}, services ${insertedByType.service}, costs ${insertedByType.expense}. Skipped duplicates: ${skipped}.`
      ))
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
    if (type === 'drivvo') return tx('Drivvo vse', 'Drivvo all')
    if (type === 'fuel') return tx('Gorivo', 'Fuel')
    if (type === 'service') return tx('Servis', 'Service')
    return tx('Stroski', 'Costs')
  }

  const kindLabel = (kind: ImportKind) => {
    if (kind === 'fuel') return tx('Gorivo', 'Fuel')
    if (kind === 'service') return tx('Servis', 'Service')
    return tx('Stroski', 'Costs')
  }

  const previewCounts = previewRows.reduce((acc, row) => {
    acc[row.kind] += 1
    return acc
  }, { fuel: 0, service: 0, expense: 0 } as Record<ImportKind, number>)

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

        <div className="grid grid-cols-2 gap-2">
          {(['drivvo', 'fuel', 'service', 'expense'] as ImportType[]).map(type => (
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
              {importType === 'drivvo'
                ? tx(
                    `Uvozil bom vse najdene sekcije: gorivo ${previewCounts.fuel}, servisi ${previewCounts.service}, stroski ${previewCounts.expense}.`,
                    `I will import all detected sections: fuel ${previewCounts.fuel}, services ${previewCounts.service}, costs ${previewCounts.expense}.`
                  )
                : activeDrivvoSection
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
                <div className="flex items-start justify-between gap-2">
                  <p className="text-white text-sm font-bold">{row.date} - {row.description}</p>
                  <span className="shrink-0 rounded-full bg-[#6c63ff22] border border-[#6c63ff55] px-2 py-1 text-[10px] font-black text-[#a09aff]">
                    {kindLabel(row.kind)}
                  </span>
                </div>
                <p className="text-[#7b7ba6] text-xs mt-1">{row.km ? `${row.km.toLocaleString()} km` : tx('brez km', 'no mileage')} | {row.amount ? formatMoney(row.amount, valuta) : tx('brez zneska', 'no amount')} | {row.station || row.category}</p>
                {row.importDetails && <p className="mt-2 text-[#5a5a80] text-[11px] leading-relaxed">{row.importDetails}</p>}
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
