import { NextRequest, NextResponse } from 'next/server'
import { getRequestUser, isAdminEmail } from '@/lib/server-admin'

export async function GET(req: NextRequest) {
  const auth = await getRequestUser(req)
  if (auth.error) return auth.error
  return NextResponse.json({ isAdmin: await isAdminEmail(auth.email) })
}
