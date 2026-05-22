import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getRequestUser } from '@/lib/server-admin'
import {
  defaultRegistryVisibility,
  normalizeVin,
  sanitizeRegistryVisibility,
  validLookupVin,
  vehicleRegistryConsentVersion,
  vinHash,
} from '@/lib/vehicle-registry'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const adminClient = () => {
  if (!supabaseUrl || !serviceRoleKey) return null
  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
}

const missingTable = (error: any) =>
  error?.code === '42P01' || String(error?.message || '').toLowerCase().includes('vehicle_public_registry')

async function ownedCar(admin: any, carId: string, userId: string) {
  const { data, error } = await admin
    .from('cars')
    .select('id,user_id,vin,znamka,model,letnik,gorivo,tablica,km_trenutni')
    .eq('id', carId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function GET(request: NextRequest) {
  const auth = await getRequestUser(request)
  if (auth.error) return auth.error
  const admin = adminClient()
  if (!admin) return NextResponse.json({ error: 'missing_server_config' }, { status: 500 })

  const carId = request.nextUrl.searchParams.get('car') || ''
  if (!carId) return NextResponse.json({ error: 'missing_car' }, { status: 400 })

  try {
    const car = await ownedCar(admin, carId, auth.user.id)
    if (!car) return NextResponse.json({ error: 'car_not_found' }, { status: 404 })

    const { data, error } = await admin
      .from('vehicle_public_registry')
      .select('*')
      .eq('car_id', carId)
      .maybeSingle()

    if (error) {
      if (missingTable(error)) {
        return NextResponse.json({
          consent: {
            enabled: false,
            visibility: defaultRegistryVisibility,
            consent_version: vehicleRegistryConsentVersion,
          },
          missingMigration: true,
        })
      }
      return NextResponse.json({ error: 'registry_failed', details: error.message }, { status: 500 })
    }

    return NextResponse.json({
      consent: data || {
        enabled: false,
        visibility: defaultRegistryVisibility,
        consent_version: vehicleRegistryConsentVersion,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: 'registry_failed', details: error.message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await getRequestUser(request)
  if (auth.error) return auth.error
  const admin = adminClient()
  if (!admin) return NextResponse.json({ error: 'missing_server_config' }, { status: 500 })

  const body = await request.json().catch(() => ({}))
  const carId = String(body.carId || '').trim()
  const enabled = Boolean(body.enabled)
  const understood = Boolean(body.understood)
  const visibility = sanitizeRegistryVisibility(body.visibility)
  if (!carId) return NextResponse.json({ error: 'missing_car' }, { status: 400 })

  try {
    const car = await ownedCar(admin, carId, auth.user.id)
    if (!car) return NextResponse.json({ error: 'car_not_found' }, { status: 404 })

    const vin = normalizeVin(body.vin || car.vin || '')
    if (enabled) {
      if (!understood) return NextResponse.json({ error: 'missing_explicit_consent' }, { status: 400 })
      if (!validLookupVin(vin)) return NextResponse.json({ error: 'invalid_vin' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const payload = {
      car_id: car.id,
      user_id: auth.user.id,
      vin_hash: enabled ? vinHash(vin) : null,
      vin_last4: enabled ? vin.slice(-4) : null,
      enabled,
      visibility,
      consent_version: vehicleRegistryConsentVersion,
      consent_at: enabled ? now : null,
      revoked_at: enabled ? null : now,
      updated_at: now,
    }

    const { data: previous } = await admin
      .from('vehicle_public_registry')
      .select('*')
      .eq('car_id', car.id)
      .maybeSingle()

    const { error } = await admin.from('vehicle_public_registry').upsert(payload)
    if (error) return NextResponse.json({ error: 'registry_save_failed', details: error.message }, { status: 500 })

    await admin.from('vehicle_public_registry_events').insert({
      car_id: car.id,
      user_id: auth.user.id,
      action: enabled ? 'enabled' : 'disabled',
      previous_enabled: previous?.enabled ?? null,
      next_enabled: enabled,
      previous_visibility: previous?.visibility || null,
      next_visibility: visibility,
      consent_version: vehicleRegistryConsentVersion,
      ip_hash: vinHash(request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown').slice(0, 64),
      user_agent: request.headers.get('user-agent')?.slice(0, 500) || null,
    })

    return NextResponse.json({ ok: true, consent: payload })
  } catch (error: any) {
    return NextResponse.json({ error: 'registry_save_failed', details: error.message }, { status: 500 })
  }
}
