import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { hasAdminAccess } from '@/lib/admin-access'
import { isSupabaseConfigured } from './config'

const publicAdminPaths = new Set(['/admin/forgot-password'])

function isProtectedAdminRequest(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  return (pathname.startsWith('/admin/') && !publicAdminPaths.has(pathname)) ||
    (pathname === '/' && request.nextUrl.searchParams.get('admin') === '1')
}

function redirectToAdmin(request: NextRequest, response: NextResponse) {
  const url = request.nextUrl.clone()
  url.pathname = '/admin'
  url.search = ''
  const redirect = NextResponse.redirect(url)
  for (const { name, value, ...options } of response.cookies.getAll()) {
    redirect.cookies.set(name, value, options)
  }
  return redirect
}

export async function updateAdminSession(request: NextRequest) {
  const protectedRequest = isProtectedAdminRequest(request)
  if (!isSupabaseConfigured) {
    return protectedRequest ? redirectToAdmin(request, NextResponse.next({ request })) : NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { secure: process.env.NODE_ENV === 'production' },
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
        },
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!protectedRequest) return supabaseResponse

  const authorized = hasAdminAccess(user, process.env.SUPABASE_ADMIN_USER_ID)
  if (authorized) return supabaseResponse

  if (user) await supabase.auth.signOut()
  return redirectToAdmin(request, supabaseResponse)
}
