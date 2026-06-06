import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

type CheckStatus = 'ok' | 'configured' | 'missing_env' | 'error'
type SchemaStatus = CheckStatus | 'missing_table'

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
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const hasSupabaseEnv = Boolean(supabaseUrl && supabaseAnonKey)

  let database: { status: CheckStatus; message?: string; responseMs?: number } = {
    status: hasSupabaseEnv ? 'configured' : 'missing_env',
  }
  let schema: { status: SchemaStatus; missingTables: string[]; missingColumns: string[]; message?: string; responseMs?: number } = {
    status: hasSupabaseEnv ? 'configured' : 'missing_env',
    missingTables: [],
    missingColumns: [],
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

  const schemaSupabaseKey = supabaseServiceRoleKey || supabaseAnonKey
  if (supabaseUrl && schemaSupabaseKey) {
    const startedAt = Date.now()
    const schemaClient = createClient(supabaseUrl, schemaSupabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const requiredTables = [
      'cars',
      'reminders',
      'fuel_logs',
      'service_logs',
      'expenses',
      'tire_sets',
      'tire_mounts',
      'vehicle_mileage_events',
      'tire_tread_measurements',
    ]
    const requiredColumnChecks = [
      { table: 'reminders', columns: 'id,status,completed_at,completed_note' },
    ]
    const missingTables: string[] = []
    const missingColumns: string[] = []
    let schemaMessage: string | undefined

    for (const table of requiredTables) {
      const { error } = await schemaClient.from(table).select('id', { head: true }).limit(1)
      if (error) {
        if (error.code === 'PGRST205' || error.message?.includes(`'public.${table}'`) || error.message?.includes(table)) {
          missingTables.push(table)
        } else {
          schemaMessage = error.message
          break
        }
      }
    }

    if (!schemaMessage) {
      for (const check of requiredColumnChecks) {
        const { error } = await schemaClient.from(check.table).select(check.columns, { head: true }).limit(1)
        if (error) {
          const message = error.message || ''
          if (error.code === 'PGRST204' || message.includes('column') || message.includes(check.columns)) {
            missingColumns.push(`${check.table}.${check.columns}`)
          } else {
            schemaMessage = message
            break
          }
        }
      }
    }

    schema = {
      status: schemaMessage ? 'error' : missingTables.length || missingColumns.length ? 'missing_table' : 'ok',
      missingTables,
      missingColumns,
      message: schemaMessage,
      responseMs: Date.now() - startedAt,
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

  const ok = hasSupabaseEnv && database.status !== 'error' && schema.status !== 'error' && schema.status !== 'missing_table'

  return NextResponse.json(
    {
      ok,
      service: 'GarageBase',
      checkedAt,
      app: { status: 'ok' },
      database,
      schema,
      push,
      cron,
      storage,
    },
    { status: ok ? 200 : 503 },
  )
}
