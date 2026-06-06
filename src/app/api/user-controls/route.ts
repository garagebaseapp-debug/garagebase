import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getRequestUser } from '@/lib/server-admin'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const defaultControls = {
  status: 'normal',
  blocked_until: null,
  reason: null,
  feature_limits: {},
}

const missingTable = (error: { code?: string; message?: string }) =>
  error?.code === '42P01' || String(error?.message || '').toLowerCase().includes('user_admin_controls')

export async function GET(request: NextRequest) {
  const auth = await getRequestUser(request)
  if (auth.error) return auth.error
  if (!supabaseUrl || !serviceRoleKey) return NextResponse.json(defaultControls)

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await admin
    .from('user_admin_controls')
    .select('status,blocked_until,reason,feature_limits,updated_at')
    .eq('user_id', auth.user.id)
    .maybeSingle()

  if (error) {
    if (missingTable(error)) return NextResponse.json(defaultControls)
    return NextResponse.json({ error: 'controls_failed', details: error.message }, { status: 500 })
  }

  return NextResponse.json(data || defaultControls)
}
