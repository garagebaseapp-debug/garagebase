import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimit } from '@/lib/server-rate-limit'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const storageBuckets = ['car-images', 'service-documents']

async function removeUserStorageFiles(admin: any, userId: string) {
  const errors: string[] = []

  for (const bucket of storageBuckets) {
    const { data, error } = await admin.storage.from(bucket).list(userId, { limit: 1000 })
    if (error) {
      errors.push(`${bucket}: ${error.message}`)
      continue
    }

    const paths = (data || [])
      .filter((item: any) => item?.name)
      .map((item: any) => `${userId}/${item.name}`)

    if (paths.length === 0) continue

    const { error: removeError } = await admin.storage.from(bucket).remove(paths)
    if (removeError) errors.push(`${bucket}: ${removeError.message}`)
  }

  return errors
}

export async function POST(request: NextRequest) {
  try {
    const limited = await rateLimit(request, 'delete-account', 5, 60_000)
    if (limited) return limited

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return NextResponse.json({
        error: 'Brisanje računa potrebuje SUPABASE_SERVICE_ROLE_KEY v Vercel Environment Variables.',
      }, { status: 500 })
    }

    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Ni prijave.' }, { status: 401 })

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    })
    const { data: userData, error: userError } = await userClient.auth.getUser(token)
    if (userError || !userData.user) return NextResponse.json({ error: 'Prijava ni veljavna.' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const confirmation = String(body.confirmText || '').trim().toUpperCase()
    const confirmEmail = String(body.email || '').trim().toLowerCase()
    const userEmail = userData.user.email?.toLowerCase() || ''
    if ((confirmation !== 'IZBRISI' && confirmation !== 'DELETE') || confirmEmail !== userEmail) {
      return NextResponse.json({ error: 'Potrditev izbrisa ni pravilna.' }, { status: 400 })
    }

    const admin = createClient(supabaseUrl, serviceRoleKey)
    const userId = userData.user.id
    const { data: cars } = await admin.from('cars').select('id').eq('user_id', userId)
    const carIds = (cars || []).map((car: any) => car.id)
    const storageErrors = await removeUserStorageFiles(admin, userId)
    if (storageErrors.length > 0) {
      return NextResponse.json({
        error: 'Brisanje datotek racuna ni uspelo. Racun se ni bil izbrisan, zato lahko poskusis znova.',
        details: storageErrors,
      }, { status: 500 })
    }

    if (carIds.length > 0) {
      await admin.from('service_logs').delete().in('car_id', carIds)
      await admin.from('fuel_logs').delete().in('car_id', carIds)
      await admin.from('expenses').delete().in('car_id', carIds)
      await admin.from('reminders').delete().in('car_id', carIds)
      await admin.from('vehicle_transfers').delete().in('car_id', carIds)
      await admin.from('archived_cars').delete().in('car_id', carIds)
    }

    const userTables = [
      'push_subscriptions',
      'feedback',
      'bug_reports',
      'app_events',
      'app_errors',
      'user_plans',
      'user_admin_controls',
      'cars',
    ]

    for (const table of userTables) {
      if (table === 'user_plans') {
        await admin.from(table).delete().eq('email', userData.user.email)
      } else {
        await admin.from(table).delete().eq('user_id', userId)
      }
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(userId)
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Brisanje računa ni uspelo.' }, { status: 500 })
  }
}
