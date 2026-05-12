import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

type Bucket = {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const clientIp = (request: NextRequest) => {
  const forwarded = request.headers.get('x-forwarded-for') || ''
  return forwarded.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    'unknown'
}

function memoryRateLimit(
  request: NextRequest,
  scope: string,
  maxRequests: number,
  windowMs: number,
) {
  const now = Date.now()
  const key = `${scope}:${clientIp(request)}`
  const current = buckets.get(key)

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return null
  }

  current.count += 1
  if (current.count > maxRequests) {
    return NextResponse.json(
      { error: 'rate_limited', retryAfterSeconds: Math.ceil((current.resetAt - now) / 1000) },
      { status: 429 },
    )
  }

  if (buckets.size > 1000) {
    for (const [bucketKey, bucket] of buckets.entries()) {
      if (bucket.resetAt <= now) buckets.delete(bucketKey)
    }
  }

  return null
}

export async function rateLimit(
  request: NextRequest,
  scope: string,
  maxRequests = 60,
  windowMs = 60_000,
) {
  if (supabaseUrl && serviceRoleKey) {
    try {
      const admin = createClient(supabaseUrl, serviceRoleKey)
      const { data, error } = await admin.rpc('check_rate_limit', {
        p_scope: scope,
        p_identifier: clientIp(request),
        p_limit: maxRequests,
        p_window_seconds: Math.max(1, Math.ceil(windowMs / 1000)),
      })

      if (!error) {
        const result = Array.isArray(data) ? data[0] : data
        if (result?.allowed === false) {
          return NextResponse.json(
            { error: 'rate_limited', retryAfterSeconds: result.retry_after_seconds || Math.ceil(windowMs / 1000) },
            { status: 429 },
          )
        }
        return null
      }
    } catch {
      // Falls back below until the Supabase rate-limit migration is applied.
    }
  }

  return memoryRateLimit(request, scope, maxRequests, windowMs)
}
