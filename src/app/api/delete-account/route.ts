import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export async function POST(request: NextRequest) {
  try {
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

    const admin = createClient(supabaseUrl, serviceRoleKey)
    const userId = userData.user.id
    const { data: cars } = await admin.from('cars').select('id').eq('user_id', userId)
    const carIds = (cars || []).map((car: any) => car.id)

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
