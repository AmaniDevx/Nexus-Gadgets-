import { NextResponse } from 'next/server'
import { hasAdminAccess } from '@/lib/admin-access'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createSupabaseServerClient()
  if (!supabase) {
    return NextResponse.json({ authorized: false }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return NextResponse.json({ authorized: false }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  }

  const authorized = hasAdminAccess(user, process.env.SUPABASE_ADMIN_USER_ID)
  return NextResponse.json({ authorized }, {
    status: authorized ? 200 : 403,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  })
}
