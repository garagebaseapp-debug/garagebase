import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

type CheckStatus = 'ok' | 'configured' | 'missing_env' | 'error'

function envConfigured(keys: string[]) {
  return keys.every((key) => Boolean(process.env[key]))
}

function safeError(error: unknown) {
  if (error instanceof Error) return error.message
  return 'Unknown error'
}

export async function GET() {
  const checkedAt = new Date().toISOString()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const hasSupabaseEnv = Boolean(supabaseUrl && supabaseAnonKey)

  let database: { status: CheckStatus; message?: string; responseMs?: number } = {
    status: hasSupabaseEnv ? 'configured' : 'missing_env',
  }

  if (supabaseUrl && supabaseAnonKey) {
    const startedAt = Date.now()
    try {
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
      const { error } = await supabase.from('cars').select('id', { head: true, count: 'exact' }).limit(1)
      database = {
        status: error ? 'error' : 'ok',
        message: error?.message,
        responseMs: Date.now() - startedAt,
      }
    } catch (error) {
      database = {
        status: 'error',
        message: safeError(error),
        responseMs: Date.now() - startedAt,
      }
    }
  }

  const push = {
    status: envConfigured(['VAPID_EMAIL', 'NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY'])
      ? ('configured' as const)
      : ('missing_env' as const),
    hasEmail: Boolean(process.env.VAPID_EMAIL),
    hasPublicKey: Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
    hasPrivateKey: Boolean(process.env.VAPID_PRIVATE_KEY),
  }

  const cron = {
    status: process.env.CRON_SECRET ? ('configured' as const) : ('missing_env' as const),
  }

  const storage = {
    status: hasSupabaseEnv ? ('configured' as const) : ('missing_env' as const),
  }

  const ok = hasSupabaseEnv && database.status !== 'error'

  return NextResponse.json(
    {
      ok,
      service: 'GarageBase',
      checkedAt,
      app: { status: 'ok' },
      database,
      push,
      cron,
      storage,
    },
    { status: ok ? 200 : 503 },
  )
}
