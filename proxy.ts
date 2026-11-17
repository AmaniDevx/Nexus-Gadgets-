import { NextResponse, type NextRequest } from 'next/server'
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from '@/lib/admin-session'

function requiresAdminSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname.replace(/\/+$/, '') || '/'
  if (pathname === '/' && request.nextUrl.searchParams.get('admin') === '1') return true
  return pathname.startsWith('/admin/') && pathname !== '/admin/forgot-password'
}

export async function proxy(request: NextRequest) {
  if (!requiresAdminSession(request)) return NextResponse.next({ request })

  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value
  if (await verifyAdminSessionToken(token)) return NextResponse.next({ request })

  const response = NextResponse.redirect(new URL('/admin', request.url))
  if (token) {
    response.cookies.set(ADMIN_SESSION_COOKIE, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    })
  }
  return response
}

export const config = {
  matcher: ['/', '/admin/:path*'],
}
