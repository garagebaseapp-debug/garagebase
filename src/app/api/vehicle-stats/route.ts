import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { buildVehicleStats, fuelCostValue, fuelLitersValue } from '@/lib/vehicle-costs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const fuelColumns = 'id,car_id,datum,km,litri,cena_skupaj,cena_na_liter,postaja,created_at,import_batch_id,source_owner_label,polni_rezervar'
const serviceColumns = 'id,car_id,datum,km,cena,servis,opis,created_at,import_batch_id,source_owner_label'
const expenseColumns = 'id,car_id,datum,znesek,kategorija,opis,created_at,import_batch_id,source_owner_label'
const carStatsColumns = 'id,user_id,km_trenutni,km_ob_vnosu,purchase_price,purchase_mileage,down_payment,finance_total_paid,finance_overpayment,resale_value'

type DbRow = Record<string, unknown> & {
  id?: string
  car_id?: string
  kategorija?: string
  znamka?: string
  model?: string
}

type RowSet = {
  label: string
  error: string | null
  fuelRows: DbRow[]
  serviceRows: DbRow[]
  expenseRows: DbRow[]
}

type VehicleStatsResponse = {
  ok: true
  source: string
  stats: ReturnType<typeof buildVehicleStats>
  debug?: Record<string, unknown>
}

const rowCounts = (rowSet: Pick<RowSet, 'fuelRows' | 'serviceRows' | 'expenseRows'>) => ({
  fuel: rowSet.fuelRows.length,
  service: rowSet.serviceRows.length,
  expense: rowSet.expenseRows.length,
})

const hasRows = (rowSet: Pick<RowSet, 'fuelRows' | 'serviceRows' | 'expenseRows'>) =>
  rowSet.fuelRows.length > 0 || rowSet.serviceRows.length > 0 || rowSet.expenseRows.length > 0

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
    .select(carStatsColumns)
    .eq('id', carId)

  if (canUseServiceRole) carQuery.eq('user_id', userData.user.id)

  const carResult = await carQuery.maybeSingle()
  let car = carResult.data as DbRow | null
  let carError = carResult.error
  if (carError) {
    const fallbackCarQuery = dataClient
      .from('cars')
      .select('id,user_id,km_trenutni,km_ob_vnosu')
      .eq('id', carId)
    if (canUseServiceRole) fallbackCarQuery.eq('user_id', userData.user.id)
    const fallbackCar = await fallbackCarQuery.maybeSingle()
    if (!fallbackCar.error) {
      car = fallbackCar.data
      carError = null
    }
  }

  if (carError) {
    return NextResponse.json({ ok: false, error: carError.message }, { status: 500 })
  }
  if (!car) {
    return NextResponse.json({ ok: false, error: 'car_not_found' }, { status: 404 })
  }

  const fetchRows = async (client: typeof userClient, label: string): Promise<RowSet> => {
    const [fuelRes, serviceRes, expenseRes] = await Promise.all([
      client.from('fuel_logs').select(fuelColumns).eq('car_id', carId).order('km', { ascending: true }),
      client.from('service_logs').select(serviceColumns).eq('car_id', carId),
      client.from('expenses').select(expenseColumns).eq('car_id', carId),
    ])

    return {
      label,
      error: fuelRes.error?.message || serviceRes.error?.message || expenseRes.error?.message || null,
      fuelRows: (fuelRes.data || []) as DbRow[],
      serviceRows: (serviceRes.data || []) as DbRow[],
      expenseRows: ((expenseRes.data || []) as DbRow[]).filter((row) => row?.kategorija !== 'km_sprememba'),
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
  if (process.env.NODE_ENV !== 'production' && !hasRows(selectedRows)) {
    const { data: carsForUser } = await dataClient
      .from('cars')
      .select('id,znamka,model')
      .eq('user_id', userData.user.id)

    const carRows = (carsForUser || []) as DbRow[]
    const carsWithIds = carRows.filter((userCar): userCar is DbRow & { id: string } => Boolean(userCar.id))
    const carIds = carsWithIds.map((userCar) => userCar.id)
    if (carIds.length > 0) {
      const [allFuelRes, allServiceRes, allExpenseRes] = await Promise.all([
        dataClient.from('fuel_logs').select('id,car_id').in('car_id', carIds),
        dataClient.from('service_logs').select('id,car_id').in('car_id', carIds),
        dataClient.from('expenses').select('id,car_id,kategorija').in('car_id', carIds),
      ])

      const allFuelRows = (allFuelRes.data || []) as DbRow[]
      const allServiceRows = (allServiceRes.data || []) as DbRow[]
      const allExpenseRows = (allExpenseRes.data || []) as DbRow[]

      userCarCounts = carsWithIds.map((userCar) => {
        const expenses = allExpenseRows.filter((row) => row.car_id === userCar.id && row.kategorija !== 'km_sprememba')
        return {
          id: userCar.id,
          name: [userCar.znamka, userCar.model].filter(Boolean).join(' '),
          fuel: allFuelRows.filter((row) => row.car_id === userCar.id).length,
          service: allServiceRows.filter((row) => row.car_id === userCar.id).length,
          expense: expenses.length,
        }
      }).filter((count) => count.fuel > 0 || count.service > 0 || count.expense > 0)
    }
  }

  const stats = buildVehicleStats(selectedRows.fuelRows, selectedRows.serviceRows, selectedRows.expenseRows, car)
  const sampleFuel = selectedRows.fuelRows[0] || null

  const body: VehicleStatsResponse = {
    ok: true,
    source: selectedRows.label,
    stats,
  }

  if (process.env.NODE_ENV !== 'production') {
    body.debug = {
      requestedCarId: carId,
      primary: { label: primaryRows.label, ...rowCounts(primaryRows) },
      fallback: fallbackRows ? { label: fallbackRows.label, ...rowCounts(fallbackRows) } : null,
      selected: { label: selectedRows.label, ...rowCounts(selectedRows) },
      statsRows: stats.rows,
      statsTotal: stats.costs.total,
      statsLiters: stats.liters,
      statsConsumption: stats.consumption,
      sampleFuel: sampleFuel ? {
        keys: Object.keys(sampleFuel).slice(0, 12),
        litri: sampleFuel.litri,
        cena_skupaj: sampleFuel.cena_skupaj,
        cena_na_liter: sampleFuel.cena_na_liter,
        computedCost: fuelCostValue(sampleFuel),
        computedLiters: fuelLitersValue(sampleFuel),
      } : null,
      userCarsWithRows: userCarCounts.slice(0, 12),
    }
  }

  return NextResponse.json(body)
}
