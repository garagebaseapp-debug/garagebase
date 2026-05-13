import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server-admin'

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (auth.error) return auth.error
  const { admin } = auth

  const search = (request.nextUrl.searchParams.get('search') || '').trim().toLowerCase()
  const page = Math.max(1, Number(request.nextUrl.searchParams.get('page') || 1) || 1)
  const perPage = Math.min(100, Math.max(20, Number(request.nextUrl.searchParams.get('perPage') || 100) || 100))
  const authPage = search ? 1 : page
  const authPerPage = search ? 1000 : perPage

  const { data: authData, error: authError } = await admin.auth.admin.listUsers({ page: authPage, perPage: authPerPage })
  if (authError) return NextResponse.json({ error: 'auth_users_failed', details: authError.message }, { status: 500 })

  const visibleUsers = authData.users
    .map((user: any) => {
      const email = user.email?.toLowerCase() || ''
      return {
        id: user.id,
        email,
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at,
        plan: null,
      }
    })
    .filter((user: any) => !search || user.email.includes(search))
    .slice(0, perPage)

  const visibleEmails = visibleUsers.map((user: any) => user.email).filter(Boolean)
  let userPlans: any[] = []
  if (visibleEmails.length > 0) {
    const { data, error } = await admin
      .from('user_plans')
      .select('*')
      .in('email', visibleEmails)
    if (error) return NextResponse.json({ error: 'plans_failed', details: error.message }, { status: 500 })
    userPlans = data || []
  }

  const { data: recentPlans, error: recentPlansError } = await admin
    .from('user_plans')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(8)
  if (recentPlansError) return NextResponse.json({ error: 'plans_failed', details: recentPlansError.message }, { status: 500 })

  const planByEmail = new Map(userPlans.map((plan: any) => [String(plan.email).toLowerCase(), plan]))
  const users = visibleUsers.map((user: any) => ({
    ...user,
    plan: planByEmail.get(user.email) || null,
  }))

  return NextResponse.json({
    users,
    plans: recentPlans || [],
    page,
    perPage,
    hasMore: !search && authData.users.length === perPage,
  })
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
