import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from '@/lib/admin-session'

const ORDER_STATUSES = ['Pending WhatsApp', 'Confirmed', 'Dispatched', 'Delivered', 'Cancelled'] as const

function isAdminSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
}

function createSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } },
  )
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } })
}

async function isAdmin() {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value
  return verifyAdminSessionToken(token)
}

export async function GET() {
  if (!await isAdmin()) return jsonError('Admin access is required.', 401)
  if (!isAdminSupabaseConfigured()) {
    return NextResponse.json({
      orders: [],
      views: [],
      warning: 'Analytics requires the server-only SUPABASE_SERVICE_ROLE_KEY environment variable.',
    }, { headers: { 'Cache-Control': 'no-store' } })
  }

  const supabase = createSupabaseClient()
  const [ordersResult, viewsResult] = await Promise.all([
    supabase.from('orders')
      .select('id, order_number, items, total_kes, customer_name, location, status, created_at')
      .order('created_at', { ascending: false }),
    supabase.from('product_views').select('product_id, product_name'),
  ])

  if (ordersResult.error || viewsResult.error) {
    console.error('[admin/analytics] Data read failed:', {
      orders: ordersResult.error?.message,
      views: viewsResult.error?.message,
    })
  }

  return NextResponse.json({
    orders: ordersResult.data || [],
    views: viewsResult.data || [],
    warning: ordersResult.error || viewsResult.error
      ? 'Some analytics data could not be loaded. Check the existing database table permissions and try again.'
      : '',
  }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function PATCH(request: Request) {
  if (!await isAdmin()) return jsonError('Admin access is required.', 401)
  if (!isAdminSupabaseConfigured()) return jsonError('Analytics service access is not configured.', 503)

  let body: { orderId?: unknown; status?: unknown }
  try {
    body = await request.json()
  } catch {
    return jsonError('The order update request is invalid.', 400)
  }
  if (typeof body.orderId !== 'string' || !body.orderId ||
    typeof body.status !== 'string' || !ORDER_STATUSES.includes(body.status as typeof ORDER_STATUSES[number])) {
    return jsonError('Provide a valid order and status.', 400)
  }

  const { error, count } = await createSupabaseClient()
    .from('orders')
    .update({ status: body.status }, { count: 'exact' })
    .eq('id', body.orderId)

  if (error) {
    console.error('[admin/analytics] Order status update failed:', error.message)
    return jsonError('Could not update this order.', 502)
  }
  if (count === 0) return jsonError('Order not found.', 404)

  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
}
