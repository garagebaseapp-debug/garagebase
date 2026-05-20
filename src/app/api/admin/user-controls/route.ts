import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server-admin'

const validStatuses = new Set(['normal', 'tester', 'watch', 'limited', 'blocked'])
const validPlans = new Set(['free', 'pro', 'max', 'business'])

const sanitizeLimits = (value: any) => {
  const raw = value && typeof value === 'object' ? value : {}
  return {
    readOnly: Boolean(raw.readOnly),
    blockReports: Boolean(raw.blockReports),
    blockQrTransfer: Boolean(raw.blockQrTransfer),
    blockUploads: Boolean(raw.blockUploads),
    blockPush: Boolean(raw.blockPush),
    maxCars: Math.max(0, Math.min(100, Number(raw.maxCars || 0) || 0)),
  }
}

const findUser = async (admin: any, userId: string, email: string) => {
  if (userId) {
    const getter = (admin.auth.admin as any).getUserById
    if (typeof getter === 'function') {
      const { data, error } = await getter.call(admin.auth.admin, userId)
      if (!error && data?.user) return data.user
    }
  }
  if (!email) return null
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) throw error
  return data.users.find((user: any) => String(user.email || '').toLowerCase() === email) || null
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (auth.error) return auth.error
  const { admin } = auth

  const userId = (request.nextUrl.searchParams.get('userId') || '').trim()
  const email = (request.nextUrl.searchParams.get('email') || '').trim().toLowerCase()
  if (!userId && !email) return NextResponse.json({ error: 'missing_user' }, { status: 400 })

  const user = await findUser(admin, userId, email)
  const targetUserId = user?.id || userId
  const targetEmail = String(user?.email || email || '').toLowerCase()
  if (!targetUserId) return NextResponse.json({ error: 'user_not_found' }, { status: 404 })

  const { data, error } = await admin
    .from('user_admin_controls')
    .select('*')
    .eq('user_id', targetUserId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'controls_failed', details: error.message }, { status: 500 })

  return NextResponse.json({
    controls: data || {
      user_id: targetUserId,
      email: targetEmail,
      status: 'normal',
      blocked_until: null,
      reason: '',
      internal_note: '',
      feature_limits: {},
    },
  })
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (auth.error) return auth.error
  const { admin, user: adminUser } = auth
  const body = await request.json().catch(() => ({}))

  const email = String(body.email || '').trim().toLowerCase()
  const userId = String(body.userId || '').trim()
  const status = validStatuses.has(String(body.status)) ? String(body.status) : 'normal'
  const reason = String(body.reason || '').trim()
  const internalNote = String(body.internalNote || '').trim()
  const blockedUntil = body.blockedUntil ? new Date(String(body.blockedUntil)).toISOString() : null
  const limits = sanitizeLimits(body.featureLimits)
  const plan = validPlans.has(String(body.plan || '')) ? String(body.plan) : ''
  const planNote = String(body.planNote || '').trim()

  const targetUser = await findUser(admin, userId, email)
  if (!targetUser?.id || !targetUser.email) return NextResponse.json({ error: 'user_not_found' }, { status: 404 })

  const { data: previous } = await admin
    .from('user_admin_controls')
    .select('*')
    .eq('user_id', targetUser.id)
    .maybeSingle()

  const payload = {
    user_id: targetUser.id,
    email: targetUser.email.toLowerCase(),
    status,
    blocked_until: blockedUntil,
    reason: reason || null,
    internal_note: internalNote || null,
    feature_limits: limits,
    updated_by: adminUser.id,
    updated_at: new Date().toISOString(),
  }

  const { error } = await admin.from('user_admin_controls').upsert(payload)
  if (error) return NextResponse.json({ error: 'controls_save_failed', details: error.message }, { status: 500 })

  await admin.from('admin_user_control_changes').insert({
    target_user_id: targetUser.id,
    target_email: targetUser.email.toLowerCase(),
    previous_status: previous?.status || null,
    next_status: status,
    previous_feature_limits: previous?.feature_limits || null,
    next_feature_limits: limits,
    previous_blocked_until: previous?.blocked_until || null,
    next_blocked_until: blockedUntil,
    reason: reason || planNote || null,
    changed_by: adminUser.id,
  })

  if (plan) {
    const { data: previousPlan } = await admin
      .from('user_plans')
      .select('*')
      .eq('email', targetUser.email.toLowerCase())
      .maybeSingle()

    const { error: planError } = await admin.from('user_plans').upsert({
      email: targetUser.email.toLowerCase(),
      plan,
      note: planNote || reason || null,
      source: 'manual',
      billing_status: plan === 'free' ? 'free_open' : 'trial',
      locked: false,
      change_reason: planNote || reason || null,
      updated_by: adminUser.id,
      updated_at: new Date().toISOString(),
    })
    if (planError) return NextResponse.json({ error: 'plan_save_failed', details: planError.message }, { status: 500 })

    await admin.from('admin_plan_changes').insert({
      email: targetUser.email.toLowerCase(),
      previous_plan: previousPlan?.plan || null,
      next_plan: plan,
      previous_source: previousPlan?.source || null,
      next_source: 'manual',
      previous_billing_status: previousPlan?.billing_status || null,
      next_billing_status: plan === 'free' ? 'free_open' : 'trial',
      note: planNote || reason || null,
      changed_by: adminUser.id,
    })
  }

  return NextResponse.json({ ok: true, controls: payload })
}
