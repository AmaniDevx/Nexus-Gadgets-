import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { mapProductRow, PRODUCT_COLUMNS } from '@/lib/products'

export const dynamic = 'force-dynamic'

function getErrorReason(error: unknown) {
  if (!error || typeof error !== 'object') return 'Unknown Supabase catalog error.'

  const err = error as { cause?: unknown; message?: unknown }
  if (err.cause && typeof err.cause === 'object') {
    const cause = err.cause as { message?: unknown; code?: unknown }
    if (typeof cause.message === 'string' && cause.message) return cause.message
    if (typeof cause.code === 'string' && cause.code) return cause.code
  }
  return typeof err.message === 'string' && err.message ? err.message : 'Unknown Supabase catalog error.'
}

function createSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } },
  )
}

export async function GET() {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: 'Supabase is not configured for this deployment.' }, { status: 503 })
  }

  const { data, error } = await createSupabaseClient()
    .from('products')
    .select(PRODUCT_COLUMNS)
    .order('created_at', { ascending: false })

  if (error) {
    const reason = getErrorReason(error)
    console.error('[products] Server catalog fetch failed:', reason)
    return NextResponse.json({ error: reason }, { status: 502, headers: { 'Cache-Control': 'no-store' } })
  }

  return NextResponse.json((data || []).map(row => mapProductRow(row)), {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  })
}
