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
    ownership: number
    garageBase: number
    imported: number
    total: number
    totalWithOwnership: number
    perKm: number | null
    perKmWithOwnership: number | null
  }
  consumption: {
    garageBase: number | null
    imported: number | null
    total: number | null
  }
}

export const numberValue = (value: unknown) => {
  const raw = String(value ?? '').trim()
  let normalized = raw
  const comma = raw.lastIndexOf(',')
  const dot = raw.lastIndexOf('.')
  if (comma >= 0 && dot >= 0) {
    normalized = comma > dot
      ? raw.replace(/\./g, '').replace(',', '.')
      : raw.replace(/,/g, '')
  } else if (comma >= 0) {
    normalized = raw.replace(',', '.')
  }
  const cleaned = normalized.replace(/[^0-9.-]/g, '')
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

export const rowMileageValue = (row: any) =>
  numberValue(row?.km ?? row?.kilometri ?? row?.km_trenutni)

const rowDateValue = (row: any) => new Date(row?.datum || row?.created_at || 0).getTime() || 0

export const sortRowsByMileageAndDate = <T extends Record<string, any>>(rows: T[] = []) =>
  [...(rows || [])].sort((a, b) => {
    const kmDiff = rowMileageValue(b) - rowMileageValue(a)
    if (kmDiff !== 0) return kmDiff
    return rowDateValue(b) - rowDateValue(a)
  })

const firstNumberValue = (row: any, keys: string[]) => {
  for (const key of keys) {
    const value = numberValue(row?.[key])
    if (value > 0) return value
  }
  return 0
}

export const fuelLitersValue = (row: any) =>
  firstNumberValue(row, ['litri', 'liters', 'litres', 'liter', 'volume', 'volumen', 'Volumen', 'kolicina', 'količina', 'quantity', 'qty'])

export const fuelPriceValue = (row: any) =>
  firstNumberValue(row, ['cena_na_liter', 'cenaNaLiter', 'price_per_liter', 'pricePerLiter', 'price/l', 'Cena / L', 'Cena/L'])

export const fuelCostValue = (row: any) => {
  const direct = firstNumberValue(row, ['cena_skupaj', 'cenaSkupaj', 'skupaj', 'skupni_stroski', 'skupniStroski', 'Skupni stroški', 'total', 'Total', 'amount', 'znesek'])
  if (direct > 0) return direct
  const liters = fuelLitersValue(row)
  const price = fuelPriceValue(row)
  return liters > 0 && price > 0 ? liters * price : 0
}

const parseConsumptionValue = (value: unknown) => {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  const match = raw.match(/([0-9]+(?:[,.][0-9]+)?)/)
  if (!match) return null
  const parsed = Number(match[1].replace(',', '.'))
  return Number.isFinite(parsed) && parsed > 0 && parsed < 100 ? parsed : null
}

const firstConsumptionValue = (row: any, keys: string[]) => {
  for (const key of keys) {
    const value = parseConsumptionValue(row?.[key])
    if (value !== null) return value
  }
  return null
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

  const statsFuel = numberValue(stats?.costs?.fuel)
  const statsService = numberValue(stats?.costs?.service)
  const statsExpense = numberValue(stats?.costs?.expense)
  const statsTotal = numberValue(stats?.costs?.total) || statsFuel + statsService + statsExpense

  if (total > 0 || (rows.length > 0 && statsTotal <= 0)) {
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
    fuel: statsFuel,
    service: statsService,
    expense: statsExpense,
    total: statsTotal,
    imported: numberValue(stats?.costs?.imported),
    garageBase: numberValue(stats?.costs?.garageBase),
    rows: {
      fuel: numberValue(stats?.rows?.fuel),
      service: numberValue(stats?.rows?.service),
      expense: numberValue(stats?.rows?.expense),
    },
  }
}

const knownConsumptionValue = (row: any) => {
  const direct = firstConsumptionValue(row, [
    'poraba',
    'consumption',
    'fuel_consumption',
    'fuelConsumption',
    'ucinkovitost',
    'učinkovitost',
    'Učinkovitost goriva',
    'efficiency',
    'l_per_100km',
    'liters_per_100km',
  ])
  if (direct !== null) return direct

  const rawText = `${row?.opis || ''} ${row?.postaja || ''} ${row?.kategorija || ''}`
  const match = rawText.match(/(?:Poraba|Consumption|Efficiency)\s*:\s*([0-9]+(?:[,.][0-9]+)?)/i)
  if (!match) return null
  return parseConsumptionValue(match[1])
}

const averageKnownConsumption = (rows: any[]) => {
  const values = rows.map(knownConsumptionValue).filter((value): value is number => value !== null)
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

const isPartialFillUpRow = (row: any) => row?.polni_rezervar === false || String(row?.polni_rezervar).toLowerCase() === 'false'

const startMileageValue = (car?: any) =>
  numberValue(car?.purchase_mileage ?? car?.km_ob_vnosu ?? car?.initial_mileage)

const firstFillConsumptionFromStart = (rows: any[], car?: any) => {
  const startKm = startMileageValue(car)
  if (startKm <= 0) return null
  const firstFill = rows
    .filter((row) => rowMileageValue(row) > startKm && fuelLitersValue(row) > 0 && !isPartialFillUpRow(row))
    .sort((a, b) => rowMileageValue(a) - rowMileageValue(b))[0]
  if (!firstFill) return null
  const distance = rowMileageValue(firstFill) - startKm
  const liters = fuelLitersValue(firstFill)
  if (distance <= 0 || liters <= 0) return null
  return { average: (liters / distance) * 100, distance, liters }
}

const rangeConsumptionFromVehicle = (rows: any[], car?: any) => {
  const startKm = startMileageValue(car)
  if (startKm <= 0) return null
  const usableRows = rows.filter((row) => rowMileageValue(row) > 0 && fuelLitersValue(row) > 0 && !isPartialFillUpRow(row))
  if (usableRows.length === 0) return null
  const latestFuelKm = Math.max(...usableRows.map(rowMileageValue))
  const currentKm = numberValue(car?.km_trenutni)
  const endKm = Math.max(latestFuelKm, currentKm)
  const distance = endKm - startKm
  const liters = usableRows.reduce((sum, row) => sum + fuelLitersValue(row), 0)
  if (distance <= 0 || liters <= 0) return null
  return { average: (liters / distance) * 100, distance, liters }
}

export const consumptionSegment = (rows: any[], car?: any) => {
  const sorted = rows
    .filter((row) => numberValue(row?.km) > 0 && fuelLitersValue(row) > 0)
    .sort((a, b) => numberValue(a.km) - numberValue(b.km))

  if (sorted.length < 2) {
    return rangeConsumptionFromVehicle(rows, car) || firstFillConsumptionFromStart(rows, car) || { average: averageKnownConsumption(rows), distance: 0, liters: 0 }
  }

  if (sorted.some(isPartialFillUpRow)) {
    const fullIndices = sorted
      .map((row, i) => ({ row, i }))
      .filter(({ row }) => !isPartialFillUpRow(row))
      .map(({ i }) => i)

    if (fullIndices.length >= 2) {
      let distance = 0
      let liters = 0
      for (let f = 1; f < fullIndices.length; f++) {
        const from = fullIndices[f - 1]
        const to = fullIndices[f]
        const diff = numberValue(sorted[to].km) - numberValue(sorted[from].km)
        if (diff <= 0) continue
        const segmentLiters = sorted
          .slice(from + 1, to + 1)
          .reduce((sum, row) => sum + fuelLitersValue(row), 0)
        distance += diff
        liters += segmentLiters
      }

      if (distance > 0) {
        return { average: (liters / distance) * 100, distance, liters }
      }
    }
  }

  let distance = 0
  let liters = 0
  for (let i = 1; i < sorted.length; i++) {
    const diff = numberValue(sorted[i].km) - numberValue(sorted[i - 1].km)
    if (diff <= 0) continue
    distance += diff
    liters += fuelLitersValue(sorted[i])
  }

  return {
    average: distance > 0 ? (liters / distance) * 100 : rangeConsumptionFromVehicle(rows, car)?.average ?? firstFillConsumptionFromStart(rows, car)?.average ?? averageKnownConsumption(rows),
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

export const costDistanceFromFuelRows = (fuelRows: any[], car?: any) => {
  const mileageValues = fuelRows
    .map(rowMileageValue)
    .filter((value) => value > 0)
    .sort((a, b) => a - b)

  if (mileageValues.length >= 2) {
    const dataDistance = mileageValues[mileageValues.length - 1] - mileageValues[0]
    if (dataDistance > 0) return dataDistance
  }

  return Math.max(0, numberValue(car?.km_trenutni) - numberValue(car?.km_ob_vnosu))
}

export const vehicleOwnershipCostValue = (car?: any) => {
  const purchase = numberValue(car?.purchase_price)
  const downPayment = numberValue(car?.down_payment)
  const financeTotal = numberValue(car?.finance_total_paid)
  const overpayment = numberValue(car?.finance_overpayment)
  const resale = numberValue(car?.resale_value)
  const base = financeTotal > 0
    ? downPayment + financeTotal
    : purchase + overpayment
  return Math.max(0, base - resale)
}

export const vehicleOwnershipDistance = (car?: any, fallbackDistance = 0) => {
  const current = numberValue(car?.km_trenutni)
  const purchaseMileage = numberValue(car?.purchase_mileage) || numberValue(car?.km_ob_vnosu)
  const distance = current > purchaseMileage ? current - purchaseMileage : 0
  return distance > 0 ? distance : Math.max(0, fallbackDistance)
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

  const garageBaseConsumption = consumptionSegment(fuelSplit.garageBase, car)
  const importedConsumption = consumptionSegment(fuelSplit.imported, car)
  const drivenKm = costDistanceFromFuelRows(fuelRows, car)
  const fuelCost = fuelRows.reduce((sum, row) => sum + fuelCostValue(row), 0)
  const serviceCost = serviceRows.reduce((sum, row) => sum + numberValue(row?.cena), 0)
  const expenseCost = filteredExpenses.reduce((sum, row) => sum + numberValue(row?.znesek), 0)
  const totalCost = garageBaseCost + importedCost
  const ownershipCost = vehicleOwnershipCostValue(car)
  const totalWithOwnership = totalCost + ownershipCost
  const ownershipDistance = vehicleOwnershipDistance(car, drivenKm)

  return {
    rows: {
      fuel: fuelRows.length,
      service: serviceRows.length,
      expense: filteredExpenses.length,
    },
    liters: fuelRows.reduce((sum, row) => sum + fuelLitersValue(row), 0),
    costs: {
      fuel: fuelCost,
      service: serviceCost,
      expense: expenseCost,
      ownership: ownershipCost,
      garageBase: garageBaseCost,
      imported: importedCost,
      total: totalCost,
      totalWithOwnership,
      perKm: drivenKm > 0 && garageBaseCost > 0 ? garageBaseCost / drivenKm : null,
      perKmWithOwnership: ownershipDistance > 0 && totalWithOwnership > 0 ? totalWithOwnership / ownershipDistance : null,
    },
    consumption: {
      garageBase: garageBaseConsumption.average,
      imported: importedConsumption.average,
      total: combineConsumptionSegments([garageBaseConsumption, importedConsumption]),
    },
  }
}
