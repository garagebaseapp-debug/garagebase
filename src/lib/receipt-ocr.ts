export type ReceiptScanResult = {
  date?: string
  liters?: string
  pricePerLiter?: string
  total?: string
  station?: string
  description?: string
  fuelType?: '95' | '100' | 'diesel'
}

const toNumber = (value: string) => {
  const cleaned = value
    .replace(/\s/g, '')
    .replace(/[€]/g, '')
    .replace(/eur/gi, '')
    .replace(/(?<=\d)[.](?=\d{3}\b)/g, '')
    .replace(',', '.')
  const parsed = Number.parseFloat(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

const toDecimalString = (value: number, decimals = 2) => value.toFixed(decimals).replace(/\.?0+$/, '')

const normalizeDate = (value: string) => {
  const iso = value.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/)
  const eu = value.match(/(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})/)
  const match = iso || eu
  if (!match) return undefined
  const yearRaw = iso ? match[1] : match[3]
  const monthRaw = iso ? match[2] : match[2]
  const dayRaw = iso ? match[3] : match[1]
  const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw
  return `${year}-${monthRaw.padStart(2, '0')}-${dayRaw.padStart(2, '0')}`
}

const numbersFrom = (line: string) =>
  Array.from(line.matchAll(/\d{1,4}(?:[.\s]\d{3})*(?:[,.]\d{1,3})?|\d+(?:[,.]\d{1,3})?/g))
    .map((m) => toNumber(m[0]))
    .filter((n): n is number => n !== null)

const scoreLine = (line: string, positive: RegExp[], negative: RegExp[] = []) => {
  const lower = line.toLowerCase()
  const plus = positive.reduce((sum, pattern) => sum + (pattern.test(lower) ? 3 : 0), 0)
  const minus = negative.reduce((sum, pattern) => sum + (pattern.test(lower) ? 4 : 0), 0)
  return plus - minus
}

const findBestNumber = (lines: string[], positive: RegExp[], range: (n: number) => boolean) => {
  const candidates = lines.flatMap((line, index) => {
    const score = scoreLine(line, positive, [/dav/, /ddv/, /tax/, /terminal/, /kartica/, /card/, /racun st/, /change/])
    return numbersFrom(line)
      .filter(range)
      .map((value) => ({ value, score, index }))
  })
  return candidates.sort((a, b) => b.score - a.score || b.index - a.index || b.value - a.value)[0]?.value
}

const findStation = (lines: string[]) => {
  const known = lines.find((line) =>
    /(omv|petrol|mol|shell|ina|agip|esso|tifon|q8|fuel|bencin|servis)/i.test(line)
    && !/\d{5,}/.test(line)
  )
  if (known) return known.replace(/\s+/g, ' ').substring(0, 60)

  return lines.find((line) =>
    /^[A-ZČŠŽĆĐ0-9 .,&-]{4,}$/.test(line)
    && !/\d{5,}/.test(line)
    && !/(racun|račun|ddv|dav|terminal|kartica|eur|total|skupaj)/i.test(line)
  )?.replace(/\s+/g, ' ').substring(0, 60)
}

export const parseReceiptText = (text: string): ReceiptScanResult => {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const allText = lines.join('\n')
  const allLower = allText.toLowerCase()
  const result: ReceiptScanResult = {}
  result.date = normalizeDate(allText)

  if (/(diesel|dizel|plinsko olje|diesel fuel|gas oil)/i.test(allText)) {
    result.fuelType = 'diesel'
  } else if (/(bencin\s*100|petrol\s*100|super\s*100|100\s*okt|premium\s*100|eurosuper\s*100)/i.test(allText)) {
    result.fuelType = '100'
  } else if (/(bencin\s*95|petrol\s*95|super\s*95|95\s*okt|eurosuper|gasoline|unleaded)/i.test(allText) || (allLower.includes('bencin') && !allLower.includes('100'))) {
    result.fuelType = '95'
  }

  const liters = findBestNumber(
    lines,
    [/\bl\b/, /lit/, /liter/, /kolicina/, /količina/, /quantity/, /qty/],
    (n) => n > 0.5 && n < 250
  )
  if (liters) result.liters = toDecimalString(liters, 2)

  const pricePerLiter = findBestNumber(
    lines,
    [/eur\/l/, /€\/l/, /cena\/l/, /price\/l/, /ppu/, /\bl\b/],
    (n) => n > 0.5 && n < 5
  )
  if (pricePerLiter) result.pricePerLiter = toDecimalString(pricePerLiter, 3)

  const totalLines = lines.filter((line) =>
    /(skupaj|znesek|total|amount|placilo|plačilo|za placilo|za plačilo|eur|€)/i.test(line)
  )
  const totals = totalLines.flatMap((line, index) =>
    numbersFrom(line)
      .filter((value) => value >= 1 && value < 10000)
      .map((value) => ({
        value,
        index,
        score: scoreLine(line, [/skupaj/, /total/, /amount/, /za placilo/, /za plačilo/, /eur/, /€/], [/dav/, /ddv/, /tax/]),
      }))
  )
  const total = totals.sort((a, b) => b.score - a.score || b.index - a.index || b.value - a.value)[0]?.value
  if (total) result.total = toDecimalString(total, 2)

  const parsedLiters = result.liters ? toNumber(result.liters) : null
  const parsedTotal = result.total ? toNumber(result.total) : null
  const parsedPrice = result.pricePerLiter ? toNumber(result.pricePerLiter) : null
  if (parsedLiters && parsedTotal && !parsedPrice) result.pricePerLiter = toDecimalString(parsedTotal / parsedLiters, 3)
  if (parsedLiters && parsedPrice && !parsedTotal) result.total = toDecimalString(parsedLiters * parsedPrice, 2)

  result.station = findStation(lines)
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
