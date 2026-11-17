import { NextRequest, NextResponse } from 'next/server'
import { hasAdminAccess } from '@/lib/admin-access'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const url = request.nextUrl
  const nextPath = url.searchParams.get('next') === '/admin/reset-password'
    ? '/admin/reset-password'
    : '/admin'
  const supabase = await createSupabaseServerClient()

  if (!supabase) {
    return NextResponse.redirect(new URL('/admin?reason=not-configured', url.origin))
  }

  const code = url.searchParams.get('code')
  if (!code) {
    return NextResponse.redirect(new URL('/admin?reason=recovery-invalid', url.origin))
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return NextResponse.redirect(new URL('/admin?reason=recovery-invalid', url.origin))
  }

  const { data: { user } } = await supabase.auth.getUser()
  const authorized = hasAdminAccess(user, process.env.SUPABASE_ADMIN_USER_ID)
  if (!authorized) {
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL('/admin?reason=not-authorized', url.origin))
  }

  return NextResponse.redirect(new URL(nextPath, url.origin))
}
