'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { HomeButton, BackButton } from '@/lib/nav'
import { trackEvent } from '@/lib/analytics'
import { getStoredLanguage } from '@/lib/i18n'
import { type GarageBaseCurrency, formatMoney, getCurrencyFromSettings } from '@/lib/currency'
import { formatDistance, getDistanceUnitFromSettings, type DistanceUnit } from '@/lib/units'
import { clearVehicleDataCaches } from '@/lib/vehicle-cache'

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

const uniqueHeaders = (headers: string[]) => {
  const seen = new Map<string, number>()
  return headers.map((header, index) => {
    const clean = header || `Column ${index + 1}`
    const key = normalizeText(clean) || `column${index + 1}`
    const count = seen.get(key) || 0
    seen.set(key, count + 1)
    return count === 0 ? clean : `${clean}__${count + 1}`
  })
}

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')

const cleanCsvMarker = (value: string) => {
  let cleaned = value.replace(/^\uFEFF/, '').trim()
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1).trim()
  }
  return cleaned
}

const firstCsvLine = (csv: string) =>
  csv.split(/\r?\n/).find(line => cleanCsvMarker(line)) || ''

const looksLikeDrivvoCsv = (csv: string) => {
  const first = cleanCsvMarker(firstCsvLine(csv))
  if (first.startsWith('##')) return true
  const firstValues = splitCsvLine(first, detectSeparator(first))
  const firstLooksLikeKm = /^\d+(?:[,.]\d+)?$/.test(firstValues[0] || '')
  const secondLooksLikeDate = /^\d{4}-\d{1,2}-\d{1,2}/.test(firstValues[1] || '')
  const thirdLooksLikeFuel = ['bencin', 'diesel', 'dizel', 'petrol', 'gasoline', 'fuel'].some(value => normalizeText(firstValues[2] || '').includes(value))
  if (firstLooksLikeKm && secondLooksLikeDate && thirdLooksLikeFuel) return true
  const firstBlock = csv.split(/\r?\n/).slice(0, 4).join(' ')
  const normalized = normalizeText(firstBlock)
  return normalized.includes('refuelling') ||
    (normalized.includes('datum') && normalized.includes('gorivo') && normalized.includes('volumen'))
}

const toNumber = (value?: string) => {
  if (!value) return null
  let cleaned = String(value)
    .replace(/\s/g, '')
    .replace(/EUR|USD|\u20ac|\$/gi, '')
    .replace(/litrov|litri|liter|liters|litres|litra|ltr|lt|l\b/gi, '')
    .replace(/[^\d,.-]/g, '')
  const decimalComma = cleaned.lastIndexOf(',')
  const decimalDot = cleaned.lastIndexOf('.')
  if (decimalComma >= 0 && decimalDot >= 0) {
    const decimalSeparator = decimalComma > decimalDot ? ',' : '.'
    const thousandSeparator = decimalSeparator === ',' ? '.' : ','
    cleaned = cleaned.replaceAll(thousandSeparator, '').replace(decimalSeparator, '.')
  } else if (decimalComma >= 0) {
    cleaned = cleaned.replace(',', '.')
  }
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

const numberFromRow = (
  row: Record<string, string>,
  headers: string[],
  mappedHeader: string | undefined,
  fallbackIndexes: number[],
  fallbackNames: string[],
) => {
  const candidates: string[] = []
  if (mappedHeader && row[mappedHeader]) candidates.push(row[mappedHeader])
  for (const name of fallbackNames) {
    const header = findHeader(headers, [name])
    if (header && row[header]) candidates.push(row[header])
  }
  for (const index of fallbackIndexes) {
    const header = headers[index]
    if (header && row[header]) candidates.push(row[header])
  }
  for (const candidate of candidates) {
    const value = toNumber(candidate)
    if (value !== null) return value
  }
  return null
}

const numbersFromRow = (row: Record<string, string>, headers: string[]) =>
  headers
    .map((header, index) => ({ index, header, value: toNumber(row[header]) }))
    .filter((item): item is { index: number; header: string; value: number } => item.value !== null)

const inferFuelNumbers = (row: Record<string, string>, headers: string[], mapped: {
  amount: number | null
  liters: number | null
  pricePerLiter: number | null
}) => {
  let amount = saneAmount(mapped.amount)
  let liters = saneLiters(mapped.liters)
  let pricePerLiter = sanePricePerLiter(mapped.pricePerLiter)
  const numbers = numbersFromRow(row, headers)

  if (liters === null) {
    const directVolume = numbers.find(item => [5, 4, 6].includes(item.index) && saneLiters(item.value))
    liters = saneLiters(directVolume?.value ?? null)
  }
  if (pricePerLiter === null) {
    const directPrice = numbers.find(item => [3, 4].includes(item.index) && sanePricePerLiter(item.value))
    pricePerLiter = sanePricePerLiter(directPrice?.value ?? null)
  }
  if (amount === null) {
    const directAmount = numbers.find(item => [4, 5, 6].includes(item.index) && item.value > 5 && item.value < 20000)
    amount = saneAmount(directAmount?.value ?? null)
  }

  if (liters === null && amount && pricePerLiter) {
    liters = saneLiters(Number((amount / pricePerLiter).toFixed(2)))
  }
  if (pricePerLiter === null && amount && liters) {
    pricePerLiter = sanePricePerLiter(Number((amount / liters).toFixed(3)))
  }
  if (amount === null && liters && pricePerLiter) {
    amount = saneAmount(Number((liters * pricePerLiter).toFixed(2)))
  }

  return { amount, liters, pricePerLiter }
}

const parseDate = (value?: string) => {
  if (!value) return ''
  const trimmed = value.trim()
  const iso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`
  const slash = trimmed.match(/^(\d{1,2})\/\s*(\d{1,2})\/\s*(\d{4})/)
  if (slash) {
    const first = Number(slash[1])
    const second = Number(slash[2])
    const day = first > 12 ? first : second
    const month = first > 12 ? second : first
    return `${slash[3]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }
  const eu = trimmed.match(/^(\d{1,2})[.-]\s*(\d{1,2})[.-]\s*(\d{4})/)
  if (eu) return `${eu[3]}-${eu[2].padStart(2, '0')}-${eu[1].padStart(2, '0')}`
  return ''
}

const isValidImportDate = (value?: string) => /^\d{4}-\d{2}-\d{2}$/.test(value || '')

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

const saneLiters = (value: number | null) => value !== null && value > 0 && value < 500 ? value : null
const sanePricePerLiter = (value: number | null) => value !== null && value > 0 && value < 20 ? value : null
const saneAmount = (value: number | null) => value !== null && value > 0 ? value : null

const optionalImportColumns = new Set([
  'verification_level',
  'source_owner_label',
  'source_entry_id',
  'import_batch_id',
  'imported_at',
  'locked_at',
  'verified_document_url',
])

const getMissingSchemaColumn = (error: unknown) => {
  const message = String((error as { message?: string } | null)?.message || '')
  if (!message.includes('schema cache') || !message.includes('Could not find')) return null
  const match = message.match(/'([^']+)' column of '([^']+)'/)
  return match?.[1] || null
}

const stripImportColumns = (rows: Array<Record<string, unknown>>, columns: Set<string>) =>
  rows.map(row => Object.fromEntries(
    Object.entries(row).filter(([key]) => !columns.has(key))
  ))

const insertImportRows = async (table: 'fuel_logs' | 'service_logs' | 'expenses', rows: Array<Record<string, unknown>>) => {
  if (!rows.length) return

  let rowsForInsert = rows
  const removedColumns = new Set<string>()

  for (let attempt = 0; attempt <= optionalImportColumns.size; attempt += 1) {
    const { error } = await supabase.from(table).insert(rowsForInsert)
    if (!error) return

    const missingColumn = getMissingSchemaColumn(error)
    if (!missingColumn || !optionalImportColumns.has(missingColumn) || removedColumns.has(missingColumn)) {
      throw error
    }

    removedColumns.add(missingColumn)
    rowsForInsert = stripImportColumns(rows, removedColumns)
  }
}

const asText = (value?: string | number | null) => (value === undefined || value === null ? '' : String(value).trim())

const joinDetails = (details: Array<[string, string | number | null | undefined]>) =>
  details
    .map(([label, value]) => [label, asText(value)] as [string, string])
    .filter(([, value]) => value && value !== '0' && value !== '0 L/100km' && value !== 'No')
    .map(([label, value]) => `${label}: ${value}`)
    .join(' | ')

const withImportNote = (base: string, details: string) => {
  const cleanBase = asText(base)
  return cleanBase || asText(details)
}

const findHeader = (headers: string[], options: string[]) => {
  const normalized = headers.map(normalizeText)
  const index = normalized.findIndex((header) => options.some((option) => header.includes(normalizeText(option))))
  return index >= 0 ? headers[index] : ''
}

const amountHeaders = ['total', 'amount', 'cost', 'znesek', 'cena skupaj', 'skupaj', 'value', 'skupni stroski', 'total cost', 'total price', 'sum', 'subtotal']
const literHeaders = ['liters', 'litres', 'liter', 'litri', 'litrov', 'litra', 'volume', 'volumen', 'vol', 'quantity', 'qty', 'kolicina', 'količina', 'natoceno', 'natočeno', 'toceno', 'točeno', 'amount of fuel', 'fuel amount', 'fuel volume', 'refuelled', 'refueled', 'filled']
const pricePerLiterHeaders = ['price/l', 'priceperliter', 'price per liter', 'price per litre', 'cena/l', 'cena na liter', 'unit price', 'price per unit', 'ppu']

const autoMapping = (headers: string[]): Mapping => ({
  date: findHeader(headers, ['date', 'datum', 'time']),
  km: findHeader(headers, ['odometer', 'mileage', 'kilometer', 'kilometri', 'km', 'stevec']),
  description: findHeader(headers, ['description', 'opis', 'note', 'notes', 'service', 'title', 'razlog']),
  amount: findHeader(headers, amountHeaders),
  liters: findHeader(headers, literHeaders),
  pricePerLiter: findHeader(headers, pricePerLiterHeaders),
  station: findHeader(headers, ['station', 'place', 'location', 'postaja', 'servis', 'workshop', 'bencinska crpalka']),
  category: findHeader(headers, ['category', 'type', 'kategorija', 'vrsta', 'vrsta stroska']),
  fuelType: findHeader(headers, ['fuel type', 'fuel', 'gorivo']),
})

const parseFlatCsv = (csv: string) => {
  const lines = csv.split(/\r?\n/).map(line => line.replace(/^\uFEFF/, '')).filter(line => cleanCsvMarker(line))
  if (lines.length === 0) return { headers: [] as string[], records: [] as Record<string, string>[] }
  const separator = detectSeparator(lines[0])
  const headers = uniqueHeaders(splitCsvLine(lines[0], separator))
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
    const line = rawLine.replace(/^\uFEFF/, '').trim()
    const marker = cleanCsvMarker(line)
    if (!line) continue

    if (marker.startsWith('##')) {
      const sectionCell = splitCsvLine(marker, detectSeparator(marker))[0] || marker
      current = { name: sectionCell.replace(/^##/, '').trim(), headers: [], records: [] }
      sections.push(current)
      waitingForHeader = true
      continue
    }

    if (!current) continue

    if (waitingForHeader) {
      separator = detectSeparator(line)
      current.headers = uniqueHeaders(splitCsvLine(line, separator))
      waitingForHeader = false
      continue
    }

    const values = splitCsvLine(line, separator)
    current.records.push(current.headers.reduce((row, header, index) => ({ ...row, [header]: values[index] || '' }), {} as Record<string, string>))
  }

  return sections.filter(section => section.headers.length > 0)
}

const drivvoFuelHeaders = [
  'Odometer',
  'Date',
  'Fuel type',
  'Price/L',
  'Total',
  'Liters',
  'Full tank',
  'Missed fill-up',
  'Partial fill-up',
  'Tire pressure',
  'City',
  'Highway',
  'Road',
  'Air conditioning',
  'Trailer',
  'Roof rack',
  'Heavy load',
  'Consumption',
  'Distance',
  'Station',
  'Driver',
  'Reason',
  'Payment',
  'Notes',
]

const parseHeaderlessDrivvoFuelCsv = (csv: string): ParsedSection | null => {
  const records = csv
    .split(/\r?\n/)
    .map(line => cleanCsvMarker(line))
    .filter(line => line && !line.startsWith('##'))
    .map(line => splitCsvLine(line, detectSeparator(line)))
    .filter(values => toNumber(values[0]) !== null && isValidImportDate(parseDate(values[1])))
    .map(values => drivvoFuelHeaders.reduce((row, header, index) => ({ ...row, [header]: values[index] || '' }), {} as Record<string, string>))

  return records.length ? { name: 'Refuelling', headers: drivvoFuelHeaders, records } : null
}

const sectionToRows = (section: ParsedSection, importType: ImportType, language: Language, distanceUnit: DistanceUnit = 'km'): PreviewRow[] => {
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
    const fuelAmount = isFuelSection
      ? saneAmount(numberFromRow(row, section.headers, map.amount, [4, 5, 6], amountHeaders))
      : null
    const fuelPricePerLiter = isFuelSection
      ? sanePricePerLiter(numberFromRow(row, section.headers, map.pricePerLiter, [3, 4, 5], pricePerLiterHeaders))
      : null
    const fuelLiters = isFuelSection
      ? saneLiters(numberFromRow(row, section.headers, map.liters, [5, 4, 3], literHeaders))
      : null
    const inferredFuel = inferFuelNumbers(row, section.headers, {
      amount: fuelAmount,
      liters: fuelLiters,
      pricePerLiter: fuelPricePerLiter,
    })
    const importDetails = isFuelSection
      ? joinDetails([
          [language === 'en' ? 'Full tank' : 'Poln tank', fullTank],
          [language === 'en' ? 'Consumption' : 'Poraba', consumption],
          [language === 'en' ? 'Distance' : 'Razdalja', distance ? formatDistance(distance, distanceUnit) : ''],
          [language === 'en' ? 'Driver' : 'Voznik', driver],
          [language === 'en' ? 'Reason' : 'Razlog', reason],
          [language === 'en' ? 'Payment' : 'Placilo', payment],
          [language === 'en' ? 'Note' : 'Opomba', notes],
        ])
      : joinDetails([
          [language === 'en' ? 'Mileage' : 'Kilometri', km ? formatDistance(km, distanceUnit) : ''],
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
      amount: isFuelSection ? inferredFuel.amount : toNumber(isExpenseSection ? valueAt(row, 2, map.amount) : row[map.amount]),
      liters: isFuelSection ? inferredFuel.liters : toNumber(row[map.liters]),
      pricePerLiter: isFuelSection ? inferredFuel.pricePerLiter : toNumber(row[map.pricePerLiter]),
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
  }).filter(row => isValidImportDate(row.date))
}

export default function UvozPodatkov() {
  const [cars, setCars] = useState<any[]>([])
  const [carId, setCarId] = useState('')
  const [csv, setCsv] = useState(sampleCsv)
  const [importType, setImportType] = useState<ImportType>('fuel')
  const [mapping, setMapping] = useState<Mapping>(emptyMapping)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [lastImportCounts, setLastImportCounts] = useState<Record<ImportKind, number> | null>(null)
  const [lastImportBatchId, setLastImportBatchId] = useState('')
  const [undoLoading, setUndoLoading] = useState(false)
  const [language, setLanguage] = useState<Language>('sl')
  const [valuta, setValuta] = useState<GarageBaseCurrency>('EUR')
  const [enotaRazdalje, setEnotaRazdalje] = useState<DistanceUnit>('km')

  const tx = (sl: string, en: string) => language === 'en' ? en : sl

  useEffect(() => {
    setLanguage(getStoredLanguage() === 'en' ? 'en' : 'sl')
    setValuta(getCurrencyFromSettings())
    setEnotaRazdalje(getDistanceUnitFromSettings())
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

  const parsed = useMemo(() => parseFlatCsv(csv), [csv])
  const headerlessDrivvoFuel = useMemo(() => parseHeaderlessDrivvoFuelCsv(csv), [csv])
  const isDrivvo = looksLikeDrivvoCsv(csv) || Boolean(headerlessDrivvoFuel)
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
    if (drivvoSections.length === 0 && headerlessDrivvoFuel) {
      return sectionToRows(headerlessDrivvoFuel, 'fuel', language, enotaRazdalje)
    }
    return drivvoSections.flatMap(section => sectionToRows(section, classifySection(section.name), language, enotaRazdalje))
  }, [drivvoSections, headerlessDrivvoFuel, isDrivvo, language, enotaRazdalje])

  useEffect(() => {
    if (!isDrivvo && parsed.headers.length > 0) setMapping(autoMapping(parsed.headers))
  }, [parsed.headers.join('|'), isDrivvo])

  const previewRows = useMemo<PreviewRow[]>(() => {
    if (importType === 'drivvo') return drivvoRows
    if (activeDrivvoSection) return sectionToRows(activeDrivvoSection, importType, language, enotaRazdalje)
    if (isDrivvo && importType === 'fuel' && headerlessDrivvoFuel) return sectionToRows(headerlessDrivvoFuel, 'fuel', language, enotaRazdalje)

    return parsed.records.map((row) => {
      const kind: ImportKind = importType === 'service' ? 'service' : importType === 'expense' ? 'expense' : 'fuel'
      const csvAmount = kind === 'fuel'
        ? saneAmount(numberFromRow(row, parsed.headers, mapping.amount, [], amountHeaders))
        : toNumber(row[mapping.amount])
      const csvLiters = kind === 'fuel'
        ? saneLiters(numberFromRow(row, parsed.headers, mapping.liters, [], literHeaders))
        : toNumber(row[mapping.liters])
      const csvPricePerLiter = kind === 'fuel'
        ? sanePricePerLiter(numberFromRow(row, parsed.headers, mapping.pricePerLiter, [], pricePerLiterHeaders))
        : toNumber(row[mapping.pricePerLiter])
      const inferredFuel = kind === 'fuel'
        ? inferFuelNumbers(row, parsed.headers, { amount: csvAmount, liters: csvLiters, pricePerLiter: csvPricePerLiter })
        : { amount: csvAmount, liters: csvLiters, pricePerLiter: csvPricePerLiter }
      return {
        kind,
        source: 'CSV',
        date: parseDate(row[mapping.date]),
        km: toNumber(row[mapping.km]),
        description: row[mapping.description] || row[mapping.category] || tx('Uvoz iz druge aplikacije', 'Import from another app'),
        amount: inferredFuel.amount,
        liters: inferredFuel.liters,
        pricePerLiter: inferredFuel.pricePerLiter,
        station: row[mapping.station] || '',
        category: row[mapping.category] || (importType === 'fuel' ? 'gorivo' : importType === 'service' ? 'servis' : 'uvoz'),
        fuelType: row[mapping.fuelType] || null,
      }
    }).filter(row => isValidImportDate(row.date))
  }, [activeDrivvoSection, drivvoRows, headerlessDrivvoFuel, isDrivvo, parsed.records, mapping, importType, language, enotaRazdalje])

  const handleFile = async (file?: File) => {
    if (!file) return
    const text = await file.text()
    setCsv(text)
    if (looksLikeDrivvoCsv(text) || parseHeaderlessDrivvoFuelCsv(text)) setImportType('drivvo')
    setMessage('')
    setLastImportCounts(null)
    setLastImportBatchId('')
  }

  const importData = async () => {
    if (!carId || previewRows.length === 0) return
    setLoading(true)
    setMessage('')
    setLastImportCounts(null)

    try {
      const importStamp = new Date().toISOString()
      const importBatchId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `import-${Date.now()}-${Math.random().toString(16).slice(2)}`
      const lockedAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      const importSource = isDrivvo ? 'Drivvo' : 'CSV'
      const importedLabel = (source?: string) => `${source || importSource} import | ${importStamp}`
      const duplicateKey = (row: any) =>
        [row.datum, row.km || '', row.cena_skupaj || row.cena || row.znesek || '', row.postaja || row.servis || row.opis || row.kategorija || ''].join('|').toLowerCase()
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
        const { data: existing } = await supabase.from('fuel_logs').select('datum,km,cena_skupaj,postaja').eq('car_id', carId)
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
          import_batch_id: importBatchId,
          imported_at: importStamp,
          locked_at: lockedAt,
        })), existingKeys)
        insertedByType.fuel = rows.length
        await insertImportRows('fuel_logs', rows)
      }

      const serviceRows = previewRows.filter(row => row.kind === 'service')
      if (serviceRows.length) {
        const { data: existing } = await supabase.from('service_logs').select('datum,km,cena,servis,opis').eq('car_id', carId)
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
          import_batch_id: importBatchId,
          imported_at: importStamp,
          locked_at: lockedAt,
        })), existingKeys)
        insertedByType.service = rows.length
        await insertImportRows('service_logs', rows)
      }

      const expenseRows = previewRows.filter(row => row.kind === 'expense')
      if (expenseRows.length) {
        const { data: existing } = await supabase.from('expenses').select('datum,znesek,kategorija,opis').eq('car_id', carId)
        const existingKeys = new Set((existing || []).map(duplicateKey))
        const rows = filterUniqueRows(expenseRows.map(row => ({
          car_id: carId,
          datum: row.date,
          kategorija: row.category || 'uvoz',
          opis: withImportNote(row.description, row.importDetails || ''),
          znesek: row.amount || 0,
          verification_level: 'basic',
          source_owner_label: importedLabel(row.source),
          import_batch_id: importBatchId,
          imported_at: importStamp,
          locked_at: lockedAt,
        })), existingKeys)
        insertedByType.expense = rows.length
        await insertImportRows('expenses', rows)
      }

      const maxKm = previewRows.reduce((max, row) => row.km && row.km > max ? row.km : max, 0)
      if (maxKm > 0) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error(tx('Prijava ni vec veljavna.', 'The session is no longer valid.'))
        const { data: currentCar } = await supabase.from('cars').select('km_trenutni').eq('id', carId).eq('user_id', user.id).maybeSingle()
        const safeKm = Math.max(currentCar?.km_trenutni || 0, maxKm)
        const { error } = await supabase.from('cars').update({ km_trenutni: safeKm }).eq('id', carId).eq('user_id', user.id)
        if (error) throw error
      }
      const inserted = insertedByType.fuel + insertedByType.service + insertedByType.expense
      trackEvent('external_import_saved', { rows: inserted, skipped, importType, source: isDrivvo ? 'drivvo' : 'generic', insertedByType })
      localStorage.removeItem('garagebase_garaza_cache')
      clearVehicleDataCaches(carId)
      setLastImportCounts(insertedByType)
      setLastImportBatchId(inserted > 0 ? importBatchId : '')
      setMessage(tx(
        `Uvozeno ${inserted} zapisov: gorivo ${insertedByType.fuel}, servisi ${insertedByType.service}, stroski ${insertedByType.expense}. Preskoceno podvojenih: ${skipped}.`,
        `Imported ${inserted} records: fuel ${insertedByType.fuel}, services ${insertedByType.service}, costs ${insertedByType.expense}. Skipped duplicates: ${skipped}.`
      ))
    } catch (error: any) {
      setLastImportCounts(null)
      setMessage(tx('Uvoz ni uspel: ', 'Import failed: ') + (error.message || tx('neznana napaka', 'unknown error')))
    } finally {
      setLoading(false)
    }
  }

  const undoLastImport = async () => {
    if (!carId || !lastImportBatchId || !lastImportCounts) return
    const confirmed = window.confirm(tx(
      'Razveljavim zadnji uvoz za izbrano vozilo? Izbrisani bodo samo zapisi iz tega uvoza.',
      'Undo the last import for the selected vehicle? Only records from this import will be deleted.'
    ))
    if (!confirmed) return

    setUndoLoading(true)
    setMessage('')
    try {
      const [fuelResult, serviceResult, expenseResult] = await Promise.all([
        supabase.from('fuel_logs').delete().eq('car_id', carId).eq('import_batch_id', lastImportBatchId),
        supabase.from('service_logs').delete().eq('car_id', carId).eq('import_batch_id', lastImportBatchId),
        supabase.from('expenses').delete().eq('car_id', carId).eq('import_batch_id', lastImportBatchId),
      ])
      const error = fuelResult.error || serviceResult.error || expenseResult.error
      if (error) throw error

      trackEvent('external_import_undone', { importBatchId: lastImportBatchId, counts: lastImportCounts })
      localStorage.removeItem('garagebase_garaza_cache')
      clearVehicleDataCaches(carId)
      setLastImportCounts(null)
      setLastImportBatchId('')
      setMessage(tx('Zadnji uvoz je razveljavljen.', 'The last import has been undone.'))
    } catch (error: any) {
      setMessage(tx(
        'Razveljavitev ni uspela. Preveri, da je zagnana migracija za import_batch_id.',
        'Undo failed. Check that the import_batch_id migration has been run.'
      ) + ` ${error.message || ''}`)
    } finally {
      setUndoLoading(false)
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
          <textarea value={csv} onChange={e => {
            const nextCsv = e.target.value
            setCsv(nextCsv)
            if (looksLikeDrivvoCsv(nextCsv) || parseHeaderlessDrivvoFuelCsv(nextCsv)) setImportType('drivvo')
          }} rows={8}
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
                <p className="text-[#7b7ba6] text-xs mt-1">{row.km ? formatDistance(row.km, enotaRazdalje) : tx('brez km', 'no mileage')} | {row.amount ? formatMoney(row.amount, valuta) : tx('brez zneska', 'no amount')} | {row.station || row.category}</p>
                {row.kind === 'fuel' && (
                  <p className="mt-1 text-xs font-semibold text-[#3ecfcf]">
                    {tx('Litri', 'Liters')}: {row.liters ?? tx('ni podatka', 'missing')} {row.liters ? 'L' : ''}
                    {row.pricePerLiter ? ` | ${tx('Cena/L', 'Price/L')}: ${formatMoney(row.pricePerLiter, valuta)}` : ''}
                  </p>
                )}
                {row.importDetails && <p className="mt-2 text-[#5a5a80] text-[11px] leading-relaxed">{row.importDetails}</p>}
              </div>
            ))}
            {previewRows.length === 0 && <p className="text-[#7b7ba6] text-sm">{tx('Ni prepoznanih vrstic. Preveri datum stolpec ali izbrano sekcijo.', 'No rows detected. Check the date column or selected section.')}</p>}
          </div>
        </div>

        <div className="rounded-2xl border border-[#3ecfcf44] bg-[#3ecfcf12] p-4">
          <p className="text-[#3ecfcf] text-sm font-black">{tx('Varna uvozna sled', 'Safe import trail')}</p>
          <p className="mt-1 text-[#b7f7f7] text-xs leading-relaxed">
            {tx(
              'Zapisi se shranijo na izbrano vozilo kot Basic import, dobijo casovni zig in podvojeni vnosi se preskocijo. Zadnji uvoz lahko razveljavis takoj po uvozu, posamezne zapise pa lahko urejas samo prvih 24 ur.',
              'Records are saved to the selected vehicle as a Basic import, get a timestamp, and duplicate entries are skipped. You can undo the last import right after importing, and individual records can be edited only for the first 24 hours.'
            )}
          </p>
        </div>

        <button onClick={importData} disabled={loading || !carId || previewRows.length === 0}
          className="w-full bg-[#6c63ff] text-white font-semibold py-3 rounded-xl disabled:opacity-50">
          {loading ? tx('Uvazam...', 'Importing...') : tx(`Uvozi ${previewRows.length} zapisov`, `Import ${previewRows.length} records`)}
        </button>

        {message && (
          <div className="rounded-xl border border-[#6c63ff44] bg-[#6c63ff18] p-3 text-sm text-[#a09aff] space-y-3">
            <p>{message}</p>
            {lastImportCounts && (
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => window.location.href = `/zgodovina-goriva?car=${carId}`}
                  className="rounded-lg border border-[#3ecfcf55] bg-[#3ecfcf14] px-2 py-2 text-xs font-bold text-[#3ecfcf]">
                  {tx('Gorivo', 'Fuel')} {lastImportCounts.fuel}
                </button>
                <button onClick={() => window.location.href = `/zgodovina-servisa?car=${carId}`}
                  className="rounded-lg border border-[#f59e0b55] bg-[#f59e0b14] px-2 py-2 text-xs font-bold text-[#f59e0b]">
                  {tx('Servisi', 'Services')} {lastImportCounts.service}
                </button>
                <button onClick={() => window.location.href = `/stroski?car=${carId}`}
                  className="rounded-lg border border-[#6c63ff55] bg-[#6c63ff14] px-2 py-2 text-xs font-bold text-[#c8c4ff]">
                  {tx('Stroski', 'Costs')} {lastImportCounts.expense}
                </button>
              </div>
            )}
            {lastImportBatchId && (
              <button onClick={undoLastImport} disabled={undoLoading}
                className="w-full rounded-lg border border-[#ef444455] bg-[#ef444418] px-3 py-2 text-xs font-bold text-[#fca5a5] disabled:opacity-60">
                {undoLoading ? tx('Razveljavljam...', 'Undoing...') : tx('Razveljavi zadnji uvoz', 'Undo last import')}
              </button>
            )}
          </div>
        )}
      </div>

      <HomeButton />
    </div>
  )
}
