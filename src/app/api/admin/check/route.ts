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

export async function GET(req: NextRequest) {
  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ isAdmin: false, error: 'Supabase is not configured.' }, { status: 503 })
  }

  const authHeader = req.headers.get('authorization') || ''
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!jwt) return NextResponse.json({ isAdmin: false }, { status: 401 })

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  })

  const { data: userData, error: userError } = await userClient.auth.getUser()
  const email = userData.user?.email?.toLowerCase() || ''
  if (userError || !email) return NextResponse.json({ isAdmin: false }, { status: 401 })
  if (fallbackAdminEmails.has(email)) return NextResponse.json({ isAdmin: true })
  if (!serviceRoleKey) return NextResponse.json({ isAdmin: false })

  const admin = createClient(supabaseUrl, serviceRoleKey)
  const { data } = await admin.from('admin_users').select('email').eq('email', email).maybeSingle()

  return NextResponse.json({ isAdmin: Boolean(data) })
}
