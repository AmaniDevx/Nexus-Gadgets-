import { NextResponse, type NextRequest } from 'next/server'
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from '@/lib/admin-session'

export async function GET(request: NextRequest) {
  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value
  const authorized = await verifyAdminSessionToken(token)

  return NextResponse.json({ authorized }, {
    status: authorized ? 200 : 401,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  })
}
