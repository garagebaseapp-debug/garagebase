import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { rateLimit } from '@/lib/server-rate-limit'
import { getRequestUser } from '@/lib/server-admin'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const optionalMissingRelation = (message: string) =>
  message.includes('does not exist') ||
  message.includes('Could not find the table') ||
  message.includes('schema cache')

async function deleteOptionalCarRows(
  admin: SupabaseClient,
  table: string,
  carId: string,
) {
  const { error } = await admin.from(table).delete().eq('car_id', carId)
  if (!error || optionalMissingRelation(error.message || '')) return null
  return `${table}: ${error.message}`
}

export async function POST(request: NextRequest) {
  try {
    const limited = await rateLimit(request, 'delete-vehicle', 10, 60_000)
    if (limited) return limited

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({
        error: 'Brisanje vozila potrebuje SUPABASE_SERVICE_ROLE_KEY v Vercel Environment Variables.',
      }, { status: 500 })
    }

    const auth = await getRequestUser(request)
    if (auth.error) return auth.error

    const body = await request.json().catch(() => ({}))
    const carId = String(body.carId || '').trim()
    if (!carId) return NextResponse.json({ error: 'Manjka ID vozila.' }, { status: 400 })

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
    const { data: car, error: carError } = await admin
      .from('cars')
      .select('id,user_id')
      .eq('id', carId)
      .eq('user_id', auth.user.id)
      .maybeSingle()

    if (carError) return NextResponse.json({ error: carError.message }, { status: 500 })
    if (!car) return NextResponse.json({ error: 'Vozila ni bilo mogoce potrditi za ta racun.' }, { status: 404 })

    const deleteTables = [
      'tire_tread_measurements',
      'tire_mounts',
      'tire_sets',
      'vehicle_mileage_events',
      'reminders',
      'vehicle_transfers',
      'archived_cars',
      'vehicle_public_registry',
      'service_logs',
      'fuel_logs',
      'expenses',
    ]

    const errors: string[] = []
    for (const table of deleteTables) {
      const error = await deleteOptionalCarRows(admin, table, carId)
      if (error) errors.push(error)
    }

    if (errors.length > 0) {
      return NextResponse.json({
        error: 'Povezanih podatkov vozila ni bilo mogoce izbrisati.',
        details: errors,
      }, { status: 500 })
    }

    const { error: deleteCarError } = await admin
      .from('cars')
      .delete()
      .eq('id', carId)
      .eq('user_id', auth.user.id)

    if (deleteCarError) return NextResponse.json({ error: deleteCarError.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Brisanje vozila ni uspelo.',
    }, { status: 500 })
  }
}
