import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const numberValue = (value: unknown) => {
  const cleaned = String(value ?? '').replace(',', '.').replace(/[^0-9.-]/g, '')
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

const isImportedRow = (row: any) => {
  const rawText = `${row?.opis || ''} ${row?.postaja || ''} ${row?.kategorija || ''}`
  return Boolean(
    row?.import_batch_id ||
    row?.source_owner_label ||
    /\[(?:Drivvo|CSV|Naknadno|Prejsnji lastnik|Previous owner|IMPORTED HISTORY)/i.test(rawText)
  )
}

const importBuckets = (rows: any[]) => rows.reduce((buckets: Record<string, number>, row: any) => {
  const key = row?.created_at ? String(row.created_at).slice(0, 16) : ''
  if (key) buckets[key] = (buckets[key] || 0) + 1
  return buckets
}, {})

const splitRowsBySource = (rows: any[]) => {
  const buckets = importBuckets(rows)
  const imported: any[] = []
  const garageBase: any[] = []

  rows.forEach((row) => {
    const key = row?.created_at ? String(row.created_at).slice(0, 16) : ''
    const looksLikeBulkImport = key && (buckets[key] || 0) >= 3
    if (isImportedRow(row) || looksLikeBulkImport) imported.push(row)
    else garageBase.push(row)
  })

  return { imported, garageBase }
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

const consumptionSegment = (rows: any[]) => {
  const sorted = rows
    .filter((row) => numberValue(row.km) > 0 && numberValue(row.litri) > 0)
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

const combineSegments = (segments: Array<{ average: number | null; distance: number; liters: number }>) => {
  const measured = segments.filter((segment) => segment.distance > 0 && segment.liters > 0)
  const distance = measured.reduce((sum, segment) => sum + segment.distance, 0)
  const liters = measured.reduce((sum, segment) => sum + segment.liters, 0)
  if (distance > 0) return (liters / distance) * 100

  const known = segments.map((segment) => segment.average).filter((value): value is number => value !== null)
  if (known.length === 0) return null
  return known.reduce((sum, value) => sum + value, 0) / known.length
}

const sumBy = (rows: any[], key: string) => rows.reduce((sum, row) => sum + numberValue(row?.[key]), 0)

export async function GET(req: NextRequest) {
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return NextResponse.json(
      { ok: false, error: 'missing_supabase_config' },
      { status: 500 }
    )
  }

  const carId = req.nextUrl.searchParams.get('car')
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')

  if (!carId || !token) {
    return NextResponse.json({ ok: false, error: 'missing_car_or_token' }, { status: 400 })
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  })
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  const { data: userData, error: userError } = await userClient.auth.getUser()
  if (userError || !userData.user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const { data: car, error: carError } = await admin
    .from('cars')
    .select('id,user_id,km_trenutni,km_ob_vnosu')
    .eq('id', carId)
    .eq('user_id', userData.user.id)
    .maybeSingle()

  if (carError) {
    return NextResponse.json({ ok: false, error: carError.message }, { status: 500 })
  }
  if (!car) {
    return NextResponse.json({ ok: false, error: 'car_not_found' }, { status: 404 })
  }

  const [fuelRes, serviceRes, expenseRes] = await Promise.all([
    admin.from('fuel_logs').select('*').eq('car_id', carId).order('km', { ascending: true }),
    admin.from('service_logs').select('*').eq('car_id', carId),
    admin.from('expenses').select('*').eq('car_id', carId),
  ])

  if (fuelRes.error || serviceRes.error || expenseRes.error) {
    return NextResponse.json(
      {
        ok: false,
        error: fuelRes.error?.message || serviceRes.error?.message || expenseRes.error?.message,
      },
      { status: 500 }
    )
  }

  const fuelRows = fuelRes.data || []
  const serviceRows = serviceRes.data || []
  const expenseRows = (expenseRes.data || []).filter((row: any) => row?.kategorija !== 'km_sprememba')

  const splitFuel = splitRowsBySource(fuelRows)
  const splitService = splitRowsBySource(serviceRows)
  const splitExpense = splitRowsBySource(expenseRows)
  const importedFuelRows = splitFuel.imported
  const garageBaseFuelRows = splitFuel.garageBase
  const importedServiceRows = splitService.imported
  const garageBaseServiceRows = splitService.garageBase
  const importedExpenseRows = splitExpense.imported
  const garageBaseExpenseRows = splitExpense.garageBase

  const importedCost =
    sumBy(importedFuelRows, 'cena_skupaj') +
    sumBy(importedServiceRows, 'cena') +
    sumBy(importedExpenseRows, 'znesek')
  const garageBaseCost =
    sumBy(garageBaseFuelRows, 'cena_skupaj') +
    sumBy(garageBaseServiceRows, 'cena') +
    sumBy(garageBaseExpenseRows, 'znesek')
  const totalCost = importedCost + garageBaseCost
  const garageBaseConsumption = consumptionSegment(garageBaseFuelRows)
  const importedConsumption = consumptionSegment(importedFuelRows)
  const kmCurrent = numberValue(car.km_trenutni)
  const kmStart = numberValue(car.km_ob_vnosu)
  const drivenKm = Math.max(0, kmCurrent - kmStart)

  return NextResponse.json({
    ok: true,
    stats: {
      rows: {
        fuel: fuelRows.length,
        service: serviceRows.length,
        expense: expenseRows.length,
      },
      liters: sumBy(fuelRows, 'litri'),
      costs: {
        fuel: sumBy(fuelRows, 'cena_skupaj'),
        service: sumBy(serviceRows, 'cena'),
        expense: sumBy(expenseRows, 'znesek'),
        garageBase: garageBaseCost,
        imported: importedCost,
        total: totalCost,
        perKm: drivenKm > 0 && totalCost > 0 ? totalCost / drivenKm : null,
      },
      consumption: {
        garageBase: garageBaseConsumption.average,
        imported: importedConsumption.average,
        total: combineSegments([garageBaseConsumption, importedConsumption]),
      },
    },
  })
}
