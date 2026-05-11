import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { buildVehicleStats } from '@/lib/vehicle-costs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

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

  return NextResponse.json({
    ok: true,
    stats: buildVehicleStats(fuelRows, serviceRows, expenseRows, car),
  })
}
