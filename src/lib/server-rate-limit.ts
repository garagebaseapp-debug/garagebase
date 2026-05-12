import { NextRequest, NextResponse } from 'next/server'

type Bucket = {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

const clientIp = (request: NextRequest) => {
  const forwarded = request.headers.get('x-forwarded-for') || ''
  return forwarded.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    'unknown'
}

export function rateLimit(
  request: NextRequest,
  scope: string,
  maxRequests = 60,
  windowMs = 60_000,
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
