import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const fallbackAdminEmails = new Set([
  'drazen.letsgo@gmail.com',
  'drazenletsgo@gmail.com',
  'garagebase.app@gmail.com',
])
const allowFallbackAdmins = process.env.NODE_ENV !== 'production' || process.env.GARAGEBASE_ALLOW_FALLBACK_ADMINS === 'true'

async function requireAdmin(request: NextRequest) {
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return { error: NextResponse.json({ error: 'missing_server_config' }, { status: 500 }) }
  }

  const authorization = request.headers.get('authorization') || ''
  const token = authorization.replace(/^Bearer\s+/i, '')
  if (!token) return { error: NextResponse.json({ error: 'missing_token' }, { status: 401 }) }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: { user }, error: userError } = await userClient.auth.getUser()
  const email = user?.email?.toLowerCase() || ''
  if (userError || !user || !email) return { error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }

  const admin = createClient(supabaseUrl, serviceRoleKey)
  if (!(allowFallbackAdmins && fallbackAdminEmails.has(email))) {
    const { data: adminRow, error: adminError } = await admin
      .from('admin_users')
      .select('email')
      .eq('email', email)
      .maybeSingle()

    if (adminError || !adminRow) return { error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) }
  }

  return { admin, user }
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (auth.error) return auth.error
  const { admin } = auth

  const search = (request.nextUrl.searchParams.get('search') || '').trim().toLowerCase()
  const { data: authData, error: authError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (authError) return NextResponse.json({ error: 'auth_users_failed', details: authError.message }, { status: 500 })

  const { data: plans, error: plansError } = await admin
    .from('user_plans')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(2000)
  if (plansError) return NextResponse.json({ error: 'plans_failed', details: plansError.message }, { status: 500 })

  const planByEmail = new Map((plans || []).map((plan: any) => [String(plan.email).toLowerCase(), plan]))
  const users = authData.users
    .map((user) => {
      const email = user.email?.toLowerCase() || ''
      return {
        id: user.id,
        email,
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at,
        plan: planByEmail.get(email) || null,
      }
    })
    .filter((user) => !search || user.email.includes(search))
    .slice(0, 100)

  return NextResponse.json({ users, plans: plans || [] })
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (auth.error) return auth.error
  const { admin, user } = auth

  const body = await request.json().catch(() => ({}))
  const email = String(body.email || '').trim().toLowerCase()
  const plan = String(body.plan || '').trim()
  const note = String(body.note || '').trim()
  const source = String(body.source || 'manual').trim()
  const billingStatus = String(body.billingStatus || 'free_open').trim()
  const confirmPaidChange = body.confirmPaidChange === true
  if (!email || !plan) return NextResponse.json({ error: 'missing_email_or_plan' }, { status: 400 })

  const { data: previous, error: previousError } = await admin
    .from('user_plans')
    .select('*')
    .eq('email', email)
    .maybeSingle()
  if (previousError) return NextResponse.json({ error: 'plan_read_failed', details: previousError.message }, { status: 500 })

  const isProtectedPaid = previous && (previous.locked === true || previous.source === 'paid' || previous.billing_status === 'paid_active')
  if (isProtectedPaid && !confirmPaidChange) {
    return NextResponse.json({ error: 'paid_change_requires_confirmation' }, { status: 409 })
  }

  const { error } = await admin
    .from('user_plans')
    .upsert({
      email,
      plan,
      note: note || null,
      source,
      billing_status: billingStatus,
      locked: source === 'paid' || billingStatus === 'paid_active',
      change_reason: note || null,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })

  if (error) return NextResponse.json({ error: 'plan_save_failed', details: error.message }, { status: 500 })

  await admin.from('admin_plan_changes').insert({
    email,
    previous_plan: previous?.plan || null,
    next_plan: plan,
    previous_source: previous?.source || null,
    next_source: source,
    previous_billing_status: previous?.billing_status || null,
    next_billing_status: billingStatus,
    note: note || null,
    changed_by: user.id,
  })

  return NextResponse.json({ ok: true })
}
