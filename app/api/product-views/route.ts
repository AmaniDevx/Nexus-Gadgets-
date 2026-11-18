import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isSupabaseConfigured } from '@/lib/supabase/config'

function createSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } },
  )
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured) return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 })

  let productId: unknown
  try {
    productId = (await request.json() as { product_id?: unknown }).product_id
  } catch {
    return NextResponse.json({ error: 'The product view request is invalid.' }, { status: 400 })
  }
  if (typeof productId !== 'string' || !productId || productId.length > 128) {
    return NextResponse.json({ error: 'A valid product id is required.' }, { status: 400 })
  }

  const supabase = createSupabaseClient()
  const { data: product, error: productError } = await supabase
    .from('products')
    .select('name')
    .eq('id', productId)
    .maybeSingle()

  if (productError) {
    console.error('[product-views] Product lookup failed:', productError.message)
    return NextResponse.json({ error: 'Could not record this product view.' }, { status: 502 })
  }
  if (!product) return NextResponse.json({ error: 'Product not found.' }, { status: 404 })

  const { error } = await supabase.from('product_views').insert({
    product_id: productId,
    product_name: product.name,
  })
  if (error) {
    console.error('[product-views] View insert failed:', error.message)
    return NextResponse.json({ error: 'Could not record this product view.' }, { status: 502 })
  }

  return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
}
