export type CostRowType = 'gorivo' | 'servis' | 'ostalo'

export type VehicleStats = {
  rows: {
    fuel: number
    service: number
    expense: number
  }
  liters: number
  costs: {
    fuel: number
    service: number
    expense: number
    garageBase: number
    imported: number
    total: number
    perKm: number | null
  }
  consumption: {
    garageBase: number | null
    imported: number | null
    total: number | null
  }
}

export const numberValue = (value: unknown) => {
  const cleaned = String(value ?? '').replace(',', '.').replace(/[^0-9.-]/g, '')
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

export const fuelCostValue = (row: any) => {
  const direct = numberValue(row?.cena_skupaj)
  if (direct > 0) return direct
  const liters = numberValue(row?.litri)
  const price = numberValue(row?.cena_na_liter)
  return liters > 0 && price > 0 ? liters * price : 0
}

export const costValueFor = (row: any) => {
  if (row?._tip === 'gorivo') return fuelCostValue(row)
  if (row?._tip === 'servis') return numberValue(row?.cena)
  return numberValue(row?.znesek)
}

export const importBuckets = (rows: any[]) => rows.reduce((buckets: Record<string, number>, row: any) => {
  const key = row?.created_at ? String(row.created_at).slice(0, 16) : ''
  if (key) buckets[key] = (buckets[key] || 0) + 1
  return buckets
}, {})

export const isImportedHistoryRow = (row: any, buckets?: Record<string, number>) => {
  const rawText = `${row?.opis || ''} ${row?.postaja || ''} ${row?.servis || ''} ${row?.kategorija || ''}`
  const key = row?.created_at ? String(row.created_at).slice(0, 16) : ''
  return Boolean(
    row?.import_batch_id ||
    row?.source_owner_label ||
    (key && buckets && (buckets[key] || 0) >= 3) ||
    /\[(?:Drivvo|CSV|Naknadno|Prejsnji lastnik|Previous owner|IMPORTED HISTORY)/i.test(rawText)
  )
}

export const splitRowsBySource = (rows: any[]) => {
  const buckets = importBuckets(rows)
  const imported: any[] = []
  const garageBase: any[] = []

  rows.forEach((row) => {
    if (isImportedHistoryRow(row, buckets)) imported.push(row)
    else garageBase.push(row)
  })

  return { imported, garageBase }
}

export const withCostTypes = (fuelRows: any[], serviceRows: any[], expenseRows: any[]) => [
  ...fuelRows.map((row) => ({ ...row, _tip: 'gorivo' as const })),
  ...serviceRows.map((row) => ({ ...row, _tip: 'servis' as const })),
  ...expenseRows.map((row) => ({ ...row, _tip: 'ostalo' as const })),
]

export const buildCostSummary = (fuelRows: any[], serviceRows: any[], expenseRows: any[], stats?: any) => {
  const rows = withCostTypes(fuelRows, serviceRows, expenseRows)
  const fuel = fuelRows.reduce((sum, row) => sum + fuelCostValue(row), 0)
  const service = serviceRows.reduce((sum, row) => sum + numberValue(row?.cena), 0)
  const expense = expenseRows.reduce((sum, row) => sum + numberValue(row?.znesek), 0)
  const total = fuel + service + expense
  const split = splitRowsBySource(rows)
  const imported = split.imported.reduce((sum, row) => sum + costValueFor(row), 0)
  const garageBase = Math.max(0, total - imported)

  if (total > 0 || rows.length > 0) {
    return {
      fuel,
      service,
      expense,
      total,
      imported,
      garageBase,
      rows: {
        fuel: fuelRows.length,
        service: serviceRows.length,
        expense: expenseRows.length,
      },
    }
  }

  return {
    fuel: numberValue(stats?.costs?.fuel),
    service: numberValue(stats?.costs?.service),
    expense: numberValue(stats?.costs?.expense),
    total: numberValue(stats?.costs?.total),
    imported: numberValue(stats?.costs?.imported),
    garageBase: numberValue(stats?.costs?.garageBase),
    rows: {
      fuel: numberValue(stats?.rows?.fuel),
      service: numberValue(stats?.rows?.service),
      expense: numberValue(stats?.rows?.expense),
    },
  }
}

const importedConsumptionValue = (row: any) => {
  const rawText = `${row?.opis || ''} ${row?.postaja || ''} ${row?.kategorija || ''}`
  const match = rawText.match(/(?:Poraba|Consumption|Efficiency)\s*:\s*([0-9]+(?:[,.][0-9]+)?)/i)
  if (!match) return null
  const parsed = Number(match[1].replace(',', '.'))
  return Number.isFinite(parsed) && parsed > 0 && parsed < 100 ? parsed : null
}

const averageKnownConsumption = (rows: any[]) => {
  const values = rows.map(importedConsumptionValue).filter((value): value is number => value !== null)
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export const consumptionSegment = (rows: any[]) => {
  const sorted = rows
    .filter((row) => numberValue(row?.km) > 0 && numberValue(row?.litri) > 0)
    .sort((a, b) => numberValue(a.km) - numberValue(b.km))

  if (sorted.length < 2) {
    return { average: averageKnownConsumption(rows), distance: 0, liters: 0 }
  }

  let distance = 0
  let liters = 0
  for (let i = 1; i < sorted.length; i++) {
    const diff = numberValue(sorted[i].km) - numberValue(sorted[i - 1].km)
    if (diff <= 0) continue
    distance += diff
    liters += numberValue(sorted[i].litri)
  }

  return {
    average: distance > 0 ? (liters / distance) * 100 : averageKnownConsumption(rows),
    distance,
    liters,
  }
}

export const combineConsumptionSegments = (segments: Array<{ average: number | null; distance: number; liters: number }>) => {
  const measured = segments.filter((segment) => segment.distance > 0 && segment.liters > 0)
  const distance = measured.reduce((sum, segment) => sum + segment.distance, 0)
  const liters = measured.reduce((sum, segment) => sum + segment.liters, 0)
  if (distance > 0) return (liters / distance) * 100

  const known = segments.map((segment) => segment.average).filter((value): value is number => value !== null)
  if (known.length === 0) return null
  return known.reduce((sum, value) => sum + value, 0) / known.length
}

export const buildVehicleStats = (fuelRows: any[], serviceRows: any[], expenseRows: any[], car?: any): VehicleStats => {
  const filteredExpenses = expenseRows.filter((row: any) => row?.kategorija !== 'km_sprememba')
  const fuelSplit = splitRowsBySource(fuelRows)
  const serviceSplit = splitRowsBySource(serviceRows)
  const expenseSplit = splitRowsBySource(filteredExpenses)

  const importedCost =
    fuelSplit.imported.reduce((sum, row) => sum + fuelCostValue(row), 0) +
    serviceSplit.imported.reduce((sum, row) => sum + numberValue(row?.cena), 0) +
    expenseSplit.imported.reduce((sum, row) => sum + numberValue(row?.znesek), 0)

  const garageBaseCost =
    fuelSplit.garageBase.reduce((sum, row) => sum + fuelCostValue(row), 0) +
    serviceSplit.garageBase.reduce((sum, row) => sum + numberValue(row?.cena), 0) +
    expenseSplit.garageBase.reduce((sum, row) => sum + numberValue(row?.znesek), 0)

  const garageBaseConsumption = consumptionSegment(fuelSplit.garageBase)
  const importedConsumption = consumptionSegment(fuelSplit.imported)
  const kmCurrent = numberValue(car?.km_trenutni)
  const kmStart = numberValue(car?.km_ob_vnosu)
  const drivenKm = Math.max(0, kmCurrent - kmStart)
  const fuelCost = fuelRows.reduce((sum, row) => sum + fuelCostValue(row), 0)
  const serviceCost = serviceRows.reduce((sum, row) => sum + numberValue(row?.cena), 0)
  const expenseCost = filteredExpenses.reduce((sum, row) => sum + numberValue(row?.znesek), 0)
  const totalCost = garageBaseCost + importedCost

  return {
    rows: {
      fuel: fuelRows.length,
      service: serviceRows.length,
      expense: filteredExpenses.length,
    },
    liters: fuelRows.reduce((sum, row) => sum + numberValue(row?.litri), 0),
    costs: {
      fuel: fuelCost,
      service: serviceCost,
      expense: expenseCost,
      garageBase: garageBaseCost,
      imported: importedCost,
      total: totalCost,
      perKm: drivenKm > 0 && totalCost > 0 ? totalCost / drivenKm : null,
    },
    consumption: {
      garageBase: garageBaseConsumption.average,
      imported: importedConsumption.average,
      total: combineConsumptionSegments([garageBaseConsumption, importedConsumption]),
    },
  }
}
