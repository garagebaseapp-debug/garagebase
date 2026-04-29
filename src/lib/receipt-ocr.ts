export type ReceiptScanResult = {
  date?: string
  liters?: string
  pricePerLiter?: string
  total?: string
  station?: string
  description?: string
}

const toNumber = (value: string) => {
  const cleaned = value.replace(/\s/g, '').replace(',', '.')
  const parsed = Number.parseFloat(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

const toDecimalString = (value: number, decimals = 2) => value.toFixed(decimals).replace(/\.?0+$/, '')

const normalizeDate = (value: string) => {
  const match = value.match(/(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})/)
  if (!match) return undefined
  const day = match[1].padStart(2, '0')
  const month = match[2].padStart(2, '0')
  const year = match[3].length === 2 ? `20${match[3]}` : match[3]
  return `${year}-${month}-${day}`
}

const numbersFrom = (line: string) =>
  Array.from(line.matchAll(/\d+(?:[,.]\d{1,3})?/g))
    .map((m) => toNumber(m[0]))
    .filter((n): n is number => n !== null)

export const parseReceiptText = (text: string): ReceiptScanResult => {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const lowerLines = lines.map((line) => line.toLowerCase())
  const allText = lines.join('\n')
  const result: ReceiptScanResult = {}

  result.date = normalizeDate(allText)

  const litersLine = lines.find((line) => /\b(l|lit|liter|litri|litrov)\b/i.test(line) && /\d/.test(line))
  if (litersLine) {
    const nums = numbersFrom(litersLine).filter((n) => n > 0 && n < 250)
    if (nums.length) result.liters = toDecimalString(nums[0], 2)
  }

  const priceLine = lines.find((line) => /(eur\/l|€\/l|cena\/l|price\/l|ppu)/i.test(line))
  if (priceLine) {
    const nums = numbersFrom(priceLine).filter((n) => n > 0 && n < 5)
    if (nums.length) result.pricePerLiter = toDecimalString(nums[nums.length - 1], 3)
  }

  const totalLines = lines.filter((line) => /(skupaj|znesek|total|amount|placilo|plačilo|eur|€)/i.test(line))
  const totalCandidates = totalLines
    .flatMap((line) => numbersFrom(line))
    .filter((n) => n >= 1 && n < 10000)
  if (totalCandidates.length) {
    result.total = toDecimalString(totalCandidates[totalCandidates.length - 1], 2)
  }

  const liters = result.liters ? toNumber(result.liters) : null
  const total = result.total ? toNumber(result.total) : null
  const price = result.pricePerLiter ? toNumber(result.pricePerLiter) : null
  if (liters && total && !price) result.pricePerLiter = toDecimalString(total / liters, 3)
  if (liters && price && !total) result.total = toDecimalString(liters * price, 2)

  const stationLine = lines.find((line, index) => {
    const lower = lowerLines[index]
    return /(omv|petrol|mol|shell|ina|agip|fuel|bencin|servis)/i.test(lower) && !/\d{4,}/.test(lower)
  }) || lines.find((line) => /^[A-ZČŠŽ0-9 .,&-]{4,}$/.test(line) && !/\d{4,}/.test(line))
  if (stationLine) result.station = stationLine.substring(0, 60)

  result.description = result.station || lines[0]?.substring(0, 80)
  return result
}

export const readReceiptTextFromImage = async (file: File): Promise<string> => {
  const win = window as any
  if (!win.TextDetector) {
    throw new Error('Ta brskalnik ne podpira avtomatskega branja teksta iz slike.')
  }
  const bitmap = await createImageBitmap(file)
  const detector = new win.TextDetector()
  const detections = await detector.detect(bitmap)
  bitmap.close?.()
  return detections
    .map((item: any) => item.rawValue || item.text || '')
    .filter(Boolean)
    .join('\n')
}
