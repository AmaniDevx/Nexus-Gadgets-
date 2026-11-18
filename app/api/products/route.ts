import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { diagnosticSupabaseFetch, getSupabaseErrorReason } from '@/lib/supabase/network-errors'
import { mapProductRow, PRODUCT_COLUMNS } from '@/lib/products'

export const dynamic = 'force-dynamic'

function createSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
      global: { fetch: diagnosticSupabaseFetch },
    },
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
    const reason = getSupabaseErrorReason(error)
    console.error('[products] Server catalog fetch failed:', reason)
    return NextResponse.json({ error: reason }, { status: 502, headers: { 'Cache-Control': 'no-store' } })
  }

  return NextResponse.json((data || []).map(row => mapProductRow(row)), {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  })
}
