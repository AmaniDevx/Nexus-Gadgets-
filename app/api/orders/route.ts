import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isSupabaseConfigured } from '@/lib/supabase/config'

const MAX_ORDER_QUANTITY = 50

type SubmittedItem = {
  product_id?: unknown
  quantity?: unknown
}

function createSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } },
  )
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured) return jsonError('Supabase is not configured.', 503)

  let body: {
    order_number?: unknown
    items?: unknown
    customer_name?: unknown
    location?: unknown
  }
  try {
    body = await request.json()
  } catch {
    return jsonError('The order request is invalid.', 400)
  }

  if (typeof body.order_number !== 'string' || !/^NX-[A-Za-z0-9-]{4,40}$/.test(body.order_number) ||
    typeof body.location !== 'string' || !body.location.trim() || body.location.length > 160 ||
    (body.customer_name !== undefined && body.customer_name !== null &&
      (typeof body.customer_name !== 'string' || body.customer_name.length > 80)) ||
    !Array.isArray(body.items) || !body.items.length || body.items.length > 50) {
    return jsonError('Provide an order number, delivery location, and at least one product.', 400)
  }

  const quantities = new Map<string, number>()
  for (const item of body.items as SubmittedItem[]) {
    if (typeof item.product_id !== 'string' || !item.product_id || item.product_id.length > 128 ||
      !Number.isSafeInteger(item.quantity) || Number(item.quantity) < 1 || Number(item.quantity) > MAX_ORDER_QUANTITY) {
      return jsonError('One or more order items are invalid.', 400)
    }
    const quantity = (quantities.get(item.product_id) || 0) + Number(item.quantity)
    if (quantity > MAX_ORDER_QUANTITY) return jsonError('The quantity for a product exceeds the order limit.', 400)
    quantities.set(item.product_id, quantity)
  }
  if ([...quantities.values()].reduce((sum, quantity) => sum + quantity, 0) > 100) {
    return jsonError('The order exceeds the item limit.', 400)
  }

  const supabase = createSupabaseClient()
  const ids = [...quantities.keys()]
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, name, price')
    .in('id', ids)

  if (productsError) {
    console.error('[orders] Product price lookup failed:', productsError.message)
    return jsonError('Could not verify current product prices.', 502)
  }

  const productsById = new Map((products || []).map(product => [String(product.id), product]))
  if (productsById.size !== ids.length) return jsonError('One or more products are no longer available.', 409)

  const items = ids.map(id => {
    const product = productsById.get(id)!
    return {
      product_id: id,
      name: product.name,
      quantity: quantities.get(id)!,
      unit_price: Number(product.price),
    }
  })
  const totalKes = items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0)
  if (!Number.isFinite(totalKes) || totalKes <= 0) return jsonError('The order total is invalid.', 400)

  const { error } = await supabase.from('orders').insert({
    order_number: body.order_number,
    items,
    total_kes: totalKes,
    customer_name: typeof body.customer_name === 'string' && body.customer_name.trim() ? body.customer_name.trim() : null,
    location: body.location.trim(),
    status: 'Pending WhatsApp',
  })

  if (error) {
    console.error('[orders] Order insert failed:', error.message)
    return jsonError('The order could not be saved.', 502)
  }

  return NextResponse.json({ ok: true }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
}
