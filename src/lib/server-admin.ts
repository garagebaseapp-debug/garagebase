import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const fallbackAdminsFromEnv = new Set(
  (process.env.GARAGEBASE_FALLBACK_ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
)
const allowFallbackAdmins = process.env.NODE_ENV !== 'production' || process.env.GARAGEBASE_ALLOW_FALLBACK_ADMINS === 'true'

const fallbackAllows = (email: string) => allowFallbackAdmins && fallbackAdminsFromEnv.has(email)

type AdminErrorResult = { error: NextResponse; user?: never; email?: never; admin?: never }
type RequestUserResult = AdminErrorResult | { error?: undefined; user: User; email: string }
type RequireAdminResult = AdminErrorResult | { error?: undefined; admin: SupabaseClient; user: User; email: string }

export async function getRequestUser(request: NextRequest): Promise<RequestUserResult> {
  if (!supabaseUrl || !anonKey) {
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
  if (userError || !user || !email) {
    return { error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }
  }

  return { user, email }
}

export async function isAdminEmail(email: string) {
  const normalizedEmail = email.toLowerCase()
  if (!serviceRoleKey || !supabaseUrl) return fallbackAllows(normalizedEmail)

  const admin = createClient(supabaseUrl, serviceRoleKey)
  const { data } = await admin
    .from('admin_users')
    .select('email')
    .eq('email', normalizedEmail)
    .maybeSingle()

  return Boolean(data) || fallbackAllows(normalizedEmail)
}

export async function requireAdmin(request: NextRequest): Promise<RequireAdminResult> {
  const auth = await getRequestUser(request)
  if (auth.error) return auth
  if (!supabaseUrl || !serviceRoleKey) {
    return { error: NextResponse.json({ error: 'missing_server_config' }, { status: 500 }) }
  }

  const isAdmin = await isAdminEmail(auth.email)
  if (!isAdmin) return { error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) }

  return {
    admin: createClient(supabaseUrl, serviceRoleKey),
    user: auth.user,
    email: auth.email,
  }
}
