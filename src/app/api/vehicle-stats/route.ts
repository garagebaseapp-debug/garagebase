import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export const dynamic = 'force-dynamic'
export const revalidate = 0

const rowCounts = (rowSet: { fuelRows: any[]; serviceRows: any[]; expenseRows: any[] }) => ({
  fuel: rowSet.fuelRows.length,
  service: rowSet.serviceRows.length,
  expense: rowSet.expenseRows.length,
})

const hasRows = (rowSet: { fuelRows: any[]; serviceRows: any[]; expenseRows: any[] }) =>
  rowSet.fuelRows.length > 0 || rowSet.serviceRows.length > 0 || rowSet.expenseRows.length > 0

const apiNumberValue = (value: unknown) => {
  const cleaned = String(value ?? '').replace(',', '.').replace(/[^0-9.-]/g, '')
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

const apiFuelCostValue = (row: any) => {
  const direct = apiNumberValue(row?.cena_skupaj)
  if (direct > 0) return direct
  const liters = apiNumberValue(row?.litri)
  const price = apiNumberValue(row?.cena_na_liter)
  return liters > 0 && price > 0 ? liters * price : 0
}

const apiImportBuckets = (rows: any[]) => rows.reduce((buckets: Record<string, number>, row: any) => {
  const key = row?.created_at ? String(row.created_at).slice(0, 16) : ''
  if (key) buckets[key] = (buckets[key] || 0) + 1
  return buckets
}, {})

const apiIsImportedHistoryRow = (row: any, buckets?: Record<string, number>) => {
  const rawText = `${row?.opis || ''} ${row?.postaja || ''} ${row?.servis || ''} ${row?.kategorija || ''}`
  const key = row?.created_at ? String(row.created_at).slice(0, 16) : ''
  return Boolean(
    row?.import_batch_id ||
    row?.source_owner_label ||
    (key && buckets && (buckets[key] || 0) >= 3) ||
    /\[(?:Drivvo|CSV|Naknadno|Prejsnji lastnik|Previous owner|IMPORTED HISTORY)/i.test(rawText)
  )
}

const apiSplitRowsBySource = (rows: any[]) => {
  const buckets = apiImportBuckets(rows)
  const imported: any[] = []
  const garageBase: any[] = []

  rows.forEach((row) => {
    if (apiIsImportedHistoryRow(row, buckets)) imported.push(row)
    else garageBase.push(row)
  })

  return { imported, garageBase }
}

const apiCostValueFor = (row: any) => {
  if (row?._tip === 'gorivo') return apiFuelCostValue(row)
  if (row?._tip === 'servis') return apiNumberValue(row?.cena)
  return apiNumberValue(row?.znesek)
}

const apiImportedConsumptionValue = (row: any) => {
  const rawText = `${row?.opis || ''} ${row?.postaja || ''} ${row?.kategorija || ''}`
  const match = rawText.match(/(?:Poraba|Consumption|Efficiency)\s*:\s*([0-9]+(?:[,.][0-9]+)?)/i)
  if (!match) return null
  const parsed = Number(match[1].replace(',', '.'))
  return Number.isFinite(parsed) && parsed > 0 && parsed < 100 ? parsed : null
}

const apiAverageKnownConsumption = (rows: any[]) => {
  const values = rows.map(apiImportedConsumptionValue).filter((value): value is number => value !== null)
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

const apiConsumptionSegment = (rows: any[]) => {
  const sorted = rows
    .filter((row) => apiNumberValue(row?.km) > 0 && apiNumberValue(row?.litri) > 0)
    .sort((a, b) => apiNumberValue(a.km) - apiNumberValue(b.km))

  if (sorted.length < 2) {
    return { average: apiAverageKnownConsumption(rows), distance: 0, liters: 0 }
  }

  let distance = 0
  let liters = 0
  for (let i = 1; i < sorted.length; i++) {
    const diff = apiNumberValue(sorted[i].km) - apiNumberValue(sorted[i - 1].km)
    if (diff <= 0) continue
    distance += diff
    liters += apiNumberValue(sorted[i].litri)
  }

  return {
    average: distance > 0 ? (liters / distance) * 100 : apiAverageKnownConsumption(rows),
    distance,
    liters,
  }
}

const apiCombineConsumptionSegments = (segments: Array<{ average: number | null; distance: number; liters: number }>) => {
  const measured = segments.filter((segment) => segment.distance > 0 && segment.liters > 0)
  const distance = measured.reduce((sum, segment) => sum + segment.distance, 0)
  const liters = measured.reduce((sum, segment) => sum + segment.liters, 0)
  if (distance > 0) return (liters / distance) * 100

  const known = segments.map((segment) => segment.average).filter((value): value is number => value !== null)
  if (known.length === 0) return null
  return known.reduce((sum, value) => sum + value, 0) / known.length
}

const buildApiVehicleStats = (fuelRows: any[], serviceRows: any[], expenseRows: any[], car?: any) => {
  const filteredExpenses = expenseRows.filter((row: any) => row?.kategorija !== 'km_sprememba')
  const costRows = [
    ...fuelRows.map((row) => ({ ...row, _tip: 'gorivo' })),
    ...serviceRows.map((row) => ({ ...row, _tip: 'servis' })),
    ...filteredExpenses.map((row) => ({ ...row, _tip: 'ostalo' })),
  ]
  const sourceSplit = apiSplitRowsBySource(costRows)
  const fuelSplit = apiSplitRowsBySource(fuelRows)
  const garageBaseConsumption = apiConsumptionSegment(fuelSplit.garageBase)
  const importedConsumption = apiConsumptionSegment(fuelSplit.imported)

  const fuelCost = fuelRows.reduce((sum, row) => sum + apiFuelCostValue(row), 0)
  const serviceCost = serviceRows.reduce((sum, row) => sum + apiNumberValue(row?.cena), 0)
  const expenseCost = filteredExpenses.reduce((sum, row) => sum + apiNumberValue(row?.znesek), 0)
  const totalCost = fuelCost + serviceCost + expenseCost
  const importedCost = sourceSplit.imported.reduce((sum, row) => sum + apiCostValueFor(row), 0)
  const garageBaseCost = Math.max(0, totalCost - importedCost)
  const drivenKm = Math.max(0, apiNumberValue(car?.km_trenutni) - apiNumberValue(car?.km_ob_vnosu))

  return {
    rows: {
      fuel: fuelRows.length,
      service: serviceRows.length,
      expense: filteredExpenses.length,
    },
    liters: fuelRows.reduce((sum, row) => sum + apiNumberValue(row?.litri), 0),
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
      total: apiCombineConsumptionSegments([garageBaseConsumption, importedConsumption]),
    },
  }
}

export async function GET(req: NextRequest) {
  if (!supabaseUrl || !anonKey) {
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
  const canUseServiceRole = Boolean(serviceRoleKey && serviceRoleKey.trim().length > 20)
  const dataClient = canUseServiceRole
    ? createClient(supabaseUrl, serviceRoleKey as string, { auth: { persistSession: false } })
    : userClient

  const { data: userData, error: userError } = await userClient.auth.getUser()
  if (userError || !userData.user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const carQuery = dataClient
    .from('cars')
    .select('id,user_id,km_trenutni,km_ob_vnosu')
    .eq('id', carId)

  if (canUseServiceRole) carQuery.eq('user_id', userData.user.id)

  const { data: car, error: carError } = await carQuery
    .maybeSingle()

  if (carError) {
    return NextResponse.json({ ok: false, error: carError.message }, { status: 500 })
  }
  if (!car) {
    return NextResponse.json({ ok: false, error: 'car_not_found' }, { status: 404 })
  }

  const fetchRows = async (client: any, label: string) => {
    const [fuelRes, serviceRes, expenseRes] = await Promise.all([
      client.from('fuel_logs').select('*').eq('car_id', carId).order('km', { ascending: true }),
      client.from('service_logs').select('*').eq('car_id', carId),
      client.from('expenses').select('*').eq('car_id', carId),
    ])

    return {
      label,
      error: fuelRes.error?.message || serviceRes.error?.message || expenseRes.error?.message || null,
      fuelRows: fuelRes.data || [],
      serviceRows: serviceRes.data || [],
      expenseRows: (expenseRes.data || []).filter((row: any) => row?.kategorija !== 'km_sprememba'),
    }
  }

  const primaryRows = await fetchRows(dataClient, canUseServiceRole ? 'service-role' : 'user-rls')
  let fallbackRows: Awaited<ReturnType<typeof fetchRows>> | null = null
  let selectedRows = primaryRows

  if (primaryRows.error) {
    return NextResponse.json({ ok: false, error: primaryRows.error }, { status: 500 })
  }

  if (canUseServiceRole && !hasRows(primaryRows)) {
    fallbackRows = await fetchRows(userClient, 'user-rls')
    if (fallbackRows.error) {
      return NextResponse.json({ ok: false, error: fallbackRows.error }, { status: 500 })
    }
    if (hasRows(fallbackRows)) selectedRows = fallbackRows
  }

  let userCarCounts: Array<{ id: string; name: string; fuel: number; service: number; expense: number }> = []
  if (!hasRows(selectedRows)) {
    const { data: carsForUser } = await dataClient
      .from('cars')
      .select('id,znamka,model')
      .eq('user_id', userData.user.id)

    const carIds = (carsForUser || []).map((userCar: any) => userCar.id).filter(Boolean)
    if (carIds.length > 0) {
      const [allFuelRes, allServiceRes, allExpenseRes] = await Promise.all([
        dataClient.from('fuel_logs').select('id,car_id').in('car_id', carIds),
        dataClient.from('service_logs').select('id,car_id').in('car_id', carIds),
        dataClient.from('expenses').select('id,car_id,kategorija').in('car_id', carIds),
      ])

      userCarCounts = (carsForUser || []).map((userCar: any) => {
        const expenses = (allExpenseRes.data || []).filter((row: any) => row.car_id === userCar.id && row.kategorija !== 'km_sprememba')
        return {
          id: userCar.id,
          name: [userCar.znamka, userCar.model].filter(Boolean).join(' '),
          fuel: (allFuelRes.data || []).filter((row: any) => row.car_id === userCar.id).length,
          service: (allServiceRes.data || []).filter((row: any) => row.car_id === userCar.id).length,
          expense: expenses.length,
        }
      }).filter((count: any) => count.fuel > 0 || count.service > 0 || count.expense > 0)
    }
  }

  const stats = buildApiVehicleStats(selectedRows.fuelRows, selectedRows.serviceRows, selectedRows.expenseRows, car)

  return NextResponse.json({
    ok: true,
    source: selectedRows.label,
    debug: {
      requestedCarId: carId,
      primary: { label: primaryRows.label, ...rowCounts(primaryRows) },
      fallback: fallbackRows ? { label: fallbackRows.label, ...rowCounts(fallbackRows) } : null,
      selected: { label: selectedRows.label, ...rowCounts(selectedRows) },
      statsRows: stats.rows,
      statsTotal: stats.costs.total,
      statsLiters: stats.liters,
      userCarsWithRows: userCarCounts.slice(0, 12),
    },
    stats,
  })
}
