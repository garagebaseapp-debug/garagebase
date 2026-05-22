import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimit } from '@/lib/server-rate-limit'
import { normalizeVin, validLookupVin, vinHash } from '@/lib/vehicle-registry'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, 'vehicle-registry-check', 15, 60_000)
  if (limited) return limited
  if (!supabaseUrl || !serviceRoleKey) return NextResponse.json({ error: 'missing_server_config' }, { status: 500 })

  const body = await request.json().catch(() => ({}))
  const vin = normalizeVin(String(body.vin || ''))
  if (!validLookupVin(vin)) return NextResponse.json({ found: false, error: 'invalid_vin' }, { status: 400 })

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
  const { data: registryRows, error } = await admin
    .from('vehicle_public_registry')
    .select('car_id,user_id,visibility,consent_at,updated_at,vin_last4')
    .eq('vin_hash', vinHash(vin))
    .eq('enabled', true)
    .is('revoked_at', null)
    .order('updated_at', { ascending: false })
    .limit(1)

  if (error) return NextResponse.json({ error: 'lookup_failed', details: error.message }, { status: 500 })
  const registry = registryRows?.[0]
  if (!registry) {
    await admin.from('vehicle_public_registry_lookups').insert({
      vin_hash: vinHash(vin),
      found: false,
      lookup_ip_hash: vinHash(request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown').slice(0, 64),
      user_agent: request.headers.get('user-agent')?.slice(0, 500) || null,
    })
    return NextResponse.json({ found: false })
  }

  const { data: car, error: carError } = await admin
    .from('cars')
    .select('id,znamka,model,letnik,gorivo,tablica,km_trenutni,km_ob_vnosu,created_at')
    .eq('id', registry.car_id)
    .maybeSingle()

  if (carError || !car) return NextResponse.json({ found: false })

  const visibility = registry.visibility || {}
  const [fuelRes, serviceLatestRes, serviceCountRes, expenseCountRes] = await Promise.all([
    admin.from('fuel_logs').select('id,km,datum').eq('car_id', registry.car_id).order('km', { ascending: false }).limit(1),
    admin.from('service_logs').select('id,datum,km').eq('car_id', registry.car_id).order('datum', { ascending: false }).limit(1),
    admin.from('service_logs').select('id', { count: 'exact', head: true }).eq('car_id', registry.car_id),
    admin.from('expenses').select('id', { count: 'exact', head: true }).eq('car_id', registry.car_id).neq('kategorija', 'km_sprememba'),
  ])

  const latestFuel = fuelRes.data?.[0] || null
  const latestService = serviceLatestRes.data?.[0] || null
  const mileageValues = [car.km_trenutni, car.km_ob_vnosu, latestFuel?.km, latestService?.km]
    .map((value) => Number(value || 0))
    .filter((value) => Number.isFinite(value) && value > 0)
  const latestKm = mileageValues.length ? Math.max(...mileageValues) : null

  await admin.from('vehicle_public_registry_lookups').insert({
    vin_hash: vinHash(vin),
    found: true,
    matched_car_id: registry.car_id,
    lookup_ip_hash: vinHash(request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown').slice(0, 64),
    user_agent: request.headers.get('user-agent')?.slice(0, 500) || null,
  })

  return NextResponse.json({
    found: true,
    vehicle: {
      make: car.znamka || null,
      model: car.model || null,
      year: car.letnik || null,
      fuel: car.gorivo || null,
      plate: visibility.showPlate ? car.tablica || null : null,
      vinLast4: registry.vin_last4 || vin.slice(-4),
    },
    history: {
      consentAt: registry.consent_at,
      firstGarageBaseRecord: car.created_at || null,
      latestMileage: visibility.showMileage ? latestKm : null,
      serviceRecords: visibility.showServiceSummary ? serviceCountRes.count || 0 : null,
      hasServiceHistory: visibility.showServiceSummary ? Boolean(latestService) : null,
      lastServiceDate: visibility.showServiceSummary ? latestService?.datum || null : null,
      expenseRecords: visibility.showCostSummary ? expenseCountRes.count || 0 : null,
      documentsAvailableOnRequest: Boolean(visibility.showDocuments),
    },
  })
}
