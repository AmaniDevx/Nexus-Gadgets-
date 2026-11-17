'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { ArrowDownRight, ArrowUpRight, Box, Eye, PackageCheck, ShoppingCart } from 'lucide-react'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'

type OrderItem = {
  product_id?: string
  name?: string
  quantity?: number
  unit_price?: number
}

type OrderRecord = {
  id: string
  order_number: string | null
  items: unknown
  total_kes: number | null
  customer_name: string | null
  location: string | null
  status: string | null
  created_at: string
}

type ProductView = { product_id: string | null; product_name: string | null }
type AnalyticsData = { orders: OrderRecord[]; views: ProductView[]; warning: string }
type RangeKey = '7d' | '30d' | 'all'

const orderStatuses = ['Pending WhatsApp', 'Confirmed', 'Dispatched', 'Delivered', 'Cancelled']
const ranges: { key: RangeKey; label: string }[] = [
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: 'all', label: 'All time' },
]

const viewsConfig = { views: { label: 'Views', color: 'var(--chart-1)' } } satisfies ChartConfig
const revenueConfig = { revenue: { label: 'Delivered revenue', color: 'var(--chart-2)' } } satisfies ChartConfig

async function loadAnalytics(): Promise<AnalyticsData> {
  const accessResponse = await fetch('/api/admin/access', { cache: 'no-store' })
  if (!accessResponse.ok) {
    window.location.replace('/admin')
    throw new Error('Admin access required')
  }

  const [ordersResult, viewsResult] = await Promise.all([
    supabase.from('orders').select('id, order_number, items, total_kes, customer_name, location, status, created_at').order('created_at', { ascending: false }),
    supabase.from('product_views').select('product_id, product_name'),
  ])

  return {
    orders: (ordersResult.data || []) as OrderRecord[],
    views: (viewsResult.data || []) as ProductView[],
    warning: ordersResult.error || viewsResult.error ? 'Some analytics data could not be loaded. Check the existing database table permissions and try again.' : '',
  }
}

function orderItems(order: OrderRecord): OrderItem[] {
  return Array.isArray(order.items) ? order.items as OrderItem[] : []
}

function isInRange(dateValue: string, range: RangeKey) {
  if (range === 'all') return true
  const date = new Date(dateValue).getTime()
  const days = range === '7d' ? 7 : 30
  return Number.isFinite(date) && date >= Date.now() - days * 24 * 60 * 60 * 1000
}

function money(value: number) {
  return `KES ${Math.round(value).toLocaleString('en-KE')}`
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
}

function buildRevenueSeries(orders: OrderRecord[], range: RangeKey) {
  const now = new Date()
  const bucketCount = range === '7d' ? 7 : range === '30d' ? 30 : 12
  const buckets = Array.from({ length: bucketCount }, (_, index) => {
    const date = new Date(now)
    if (range === 'all') {
      date.setDate(1)
      date.setMonth(date.getMonth() - (bucketCount - 1 - index))
      return {
        key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
        label: date.toLocaleDateString('en-KE', { month: 'short' }),
        revenue: 0,
      }
    }
    date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() - (bucketCount - 1 - index))
    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
      label: range === '7d' ? date.toLocaleDateString('en-KE', { weekday: 'short' }) : String(date.getDate()),
      revenue: 0,
    }
  })
  const indexByKey = new Map(buckets.map((bucket, index) => [bucket.key, index]))

  for (const order of orders) {
    if (order.status !== 'Delivered' || !order.created_at) continue
    const date = new Date(order.created_at)
    if (!Number.isFinite(date.getTime())) continue
    const key = range === 'all'
      ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    const index = indexByKey.get(key)
    if (index !== undefined) buckets[index].revenue += Number(order.total_kes || 0)
  }

  return buckets
}

export default function AdminAnalyticsDashboard() {
  const [range, setRange] = useState<RangeKey>('30d')
  const [notice, setNotice] = useState('')
  const [savingOrderId, setSavingOrderId] = useState<string | null>(null)
  const { data, error, isLoading, mutate } = useSWR<AnalyticsData>('nexus-admin-analytics', loadAnalytics, {
    refreshInterval: 30_000,
    revalidateOnFocus: true,
  })

  const orders = data?.orders || []
  const views = data?.views || []
  const rangeOrders = useMemo(() => orders.filter(order => isInRange(order.created_at, range)), [orders, range])
  const deliveredOrders = useMemo(() => rangeOrders.filter(order => order.status === 'Delivered'), [rangeOrders])
  const soldItems = useMemo(() => deliveredOrders.flatMap(order => orderItems(order).map(item => ({
    order,
    productId: item.product_id || item.name || 'product',
    name: item.name || 'Product',
    quantity: Math.max(0, Math.floor(Number(item.quantity) || 0)),
    unitPrice: Number(item.unit_price) || 0,
  })).filter(item => item.quantity > 0)), [deliveredOrders])
  const soldProducts = useMemo(() => {
    const totals = new Map<string, { id: string; name: string; quantity: number; revenue: number }>()
    for (const item of soldItems) {
      const current = totals.get(item.productId) || { id: item.productId, name: item.name, quantity: 0, revenue: 0 }
      current.quantity += item.quantity
      current.revenue += item.unitPrice * item.quantity
      totals.set(item.productId, current)
    }
    return [...totals.values()].sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
  }, [soldItems])
  const topViewed = useMemo(() => {
    const counts = new Map<string, { id: string; name: string; views: number }>()
    for (const view of views) {
      const id = view.product_id || view.product_name || 'product'
      const current = counts.get(id) || { id, name: view.product_name || 'Product', views: 0 }
      current.views += 1
      counts.set(id, current)
    }
    return [...counts.values()].sort((a, b) => b.views - a.views).slice(0, 7)
  }, [views])
  const revenueSeries = useMemo(() => buildRevenueSeries(orders, range), [orders, range])
  const deliveredRevenue = deliveredOrders.reduce((sum, order) => sum + Number(order.total_kes || 0), 0)
  const unitsSold = soldItems.reduce((sum, item) => sum + item.quantity, 0)
  const pendingOrders = rangeOrders.filter(order => order.status === 'Pending WhatsApp').length
  const nonCancelledOrders = rangeOrders.filter(order => order.status !== 'Cancelled').length
  const deliveredRate = nonCancelledOrders ? Math.round(deliveredOrders.length / nonCancelledOrders * 100) : 0

  const recommendation = pendingOrders > 0
    ? `Follow up on ${pendingOrders} WhatsApp ${pendingOrders === 1 ? 'order' : 'orders'} awaiting confirmation. Update the status as each order progresses.`
    : soldProducts.length > 0
      ? `Keep an eye on ${soldProducts[0].name}, your leading delivered product with ${soldProducts[0].quantity} ${soldProducts[0].quantity === 1 ? 'unit' : 'units'} sold in this period.`
      : topViewed.length > 0
        ? `${topViewed[0].name} is attracting the most attention. Feature it in your next campaign, then mark confirmed deliveries so it appears in the sales record.`
        : 'Product views and orders will surface here as customers browse the store and place orders.'

  async function updateStatus(orderId: string, status: string) {
    setNotice('')
    setSavingOrderId(orderId)
    const { error: updateError } = await supabase.from('orders').update({ status }).eq('id', orderId)
    if (updateError) {
      setNotice('Could not update this order. Please try again.')
    } else {
      await mutate(current => current ? { ...current, orders: current.orders.map(order => order.id === orderId ? { ...order, status } : order) } : current, { revalidate: false })
    }
    setSavingOrderId(null)
  }

  if (isLoading) return <main className="grid min-h-screen place-items-center bg-[#F5F5F7] px-5 text-sm text-[#626267]" role="status">Loading store analytics…</main>
  if (error && !data) return <main className="grid min-h-screen place-items-center bg-[#F5F5F7] px-5 text-center text-sm text-[#626267]"><div><p>Analytics could not be loaded.</p><button type="button" onClick={() => void mutate()} className="mt-3 rounded-full bg-[#1D1D1F] px-4 py-2 text-white">Try again</button></div></main>

  return <main className="min-h-screen bg-[#F5F5F7] px-4 py-6 text-[#1D1D1F] sm:px-6 md:px-8 md:py-8">
    <div className="mx-auto max-w-[1180px]">
      <div className="flex items-center justify-between gap-4">
        <a href="/" className="text-sm font-medium text-[#0071E3]">← Storefront</a>
        <button type="button" onClick={() => { void fetch('/api/admin/session', { method: 'DELETE' }).catch(() => undefined).finally(() => window.location.replace('/admin')) }} className="rounded-full bg-white px-4 py-2 text-sm font-medium shadow-sm">Sign out</button>
      </div>

      <header className="mt-7 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#86868B]">Nexus Gadgets · Store report</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Analytics &amp; Orders</h1>
          <p className="mt-2 text-sm text-[#626267]">Views, fulfilled sales, and customer orders in one place.</p>
        </div>
        <div className="flex w-fit rounded-full bg-white p-1 shadow-sm" aria-label="Analytics date range">
          {ranges.map(option => <button key={option.key} type="button" aria-pressed={range === option.key} onClick={() => setRange(option.key)} className={`rounded-full px-3.5 py-2 text-xs font-medium transition ${range === option.key ? 'bg-[#1D1D1F] text-white' : 'text-[#626267] hover:bg-[#F5F5F7]'}`}>{option.label}</button>)}
        </div>
      </header>

      {(data?.warning || notice || error) && <p role="status" className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{notice || data?.warning || 'Refresh failed. Showing the last successfully loaded report.'}</p>}

      <section aria-label="Store performance summary" className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Product views" value={views.length.toLocaleString('en-KE')} detail="All-time product interest" icon={<Eye size={17}/>} />
        <MetricCard label="Orders" value={rangeOrders.length.toLocaleString('en-KE')} detail={`${pendingOrders} awaiting WhatsApp follow-up`} icon={<ShoppingCart size={17}/>} />
        <MetricCard label="Delivered revenue" value={money(deliveredRevenue)} detail="Delivered orders only" icon={<ArrowUpRight size={17}/>} />
        <MetricCard label="Products sold" value={unitsSold.toLocaleString('en-KE')} detail={`${deliveredRate}% of non-cancelled orders delivered`} icon={<PackageCheck size={17}/>} />
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div><CardTitle className="text-lg">Delivered revenue</CardTitle><CardDescription className="mt-1">{range === 'all' ? 'Monthly totals · last 12 months' : `Daily totals · ${range === '7d' ? 'last 7 days' : 'last 30 days'}`}</CardDescription></div>
            <span className="rounded-full bg-[#F5F5F7] px-3 py-1.5 text-xs font-medium text-[#626267]">{deliveredOrders.length} delivered</span>
          </CardHeader>
          <CardContent>
            {deliveredRevenue > 0 ? <ChartContainer config={revenueConfig} className="h-[230px] w-full">
              <BarChart accessibilityLayer data={revenueSeries} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} interval={range === '30d' ? 4 : 0} />
                <ChartTooltip content={<ChartTooltipContent formatter={value => money(Number(value))}/>} />
                <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[5, 5, 0, 0]} maxBarSize={30} />
              </BarChart>
            </ChartContainer> : <EmptyPanel icon={<Box size={20}/>} title="No delivered sales in this period" detail="Orders only count as sales after their status is marked Delivered." />}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Most viewed products</CardTitle>
            <CardDescription>All-time interest · ranked by recorded views</CardDescription>
          </CardHeader>
          <CardContent>
            {topViewed.length ? <ChartContainer config={viewsConfig} className="h-[230px] w-full">
              <BarChart accessibilityLayer data={topViewed} layout="vertical" margin={{ top: 2, right: 12, bottom: 2, left: 2 }}>
                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" width={116} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                <ChartTooltip content={<ChartTooltipContent formatter={value => `${Number(value).toLocaleString('en-KE')} views`}/>} />
                <Bar dataKey="views" fill="var(--color-views)" radius={[0, 5, 5, 0]} maxBarSize={24} />
              </BarChart>
            </ChartContainer> : <EmptyPanel icon={<Eye size={20}/>} title="No product views yet" detail="Recorded product detail views will appear here." />}
          </CardContent>
        </Card>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardHeader><CardTitle className="text-lg">What to do next</CardTitle><CardDescription>A simple recommendation based on this report</CardDescription></CardHeader>
          <CardContent><div className="flex gap-3 rounded-xl bg-[#F5F5F7] p-4"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-[#0071E3]"><ArrowDownRight size={17}/></span><p className="text-sm leading-6 text-[#3A3A3C]">{recommendation}</p></div></CardContent>
        </Card>
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardHeader><CardTitle className="text-lg">Best-selling products</CardTitle><CardDescription>Based on delivered order items · selected period</CardDescription></CardHeader>
          <CardContent>
            {soldProducts.length ? <div className="divide-y divide-black/5">{soldProducts.slice(0, 5).map((product, index) => <div key={product.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#F5F5F7] text-xs font-semibold text-[#626267]">{index + 1}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{product.name}</p><p className="mt-0.5 text-xs text-[#86868B]">{product.quantity} sold</p></div><span className="text-sm font-semibold tabular-nums">{money(product.revenue)}</span></div>)}</div> : <p className="py-2 text-sm text-[#86868B]">Delivered product records will appear here.</p>}
          </CardContent>
        </Card>
      </section>

      <section className="mt-4 grid gap-4">
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardHeader><CardTitle className="text-lg">Products sold</CardTitle><CardDescription>Item-level sales record · only orders marked Delivered · {range === 'all' ? 'all time' : range === '7d' ? 'last 7 days' : 'last 30 days'}</CardDescription></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="text-xs text-[#86868B]"><tr><th className="pb-3 pr-4 font-medium">Date</th><th className="pb-3 pr-4 font-medium">Order</th><th className="pb-3 pr-4 font-medium">Product</th><th className="pb-3 pr-4 text-right font-medium">Qty</th><th className="pb-3 pr-4 text-right font-medium">Unit price</th><th className="pb-3 text-right font-medium">Line total</th></tr></thead>
                <tbody className="divide-y divide-black/5">{soldItems.slice(0, 30).map((item, index) => <tr key={`${item.order.id}-${item.productId}-${index}`}><td className="py-3 pr-4 text-[#626267]">{formatDate(item.order.created_at)}</td><td className="py-3 pr-4 font-medium">{item.order.order_number || '—'}</td><td className="py-3 pr-4">{item.name}</td><td className="py-3 pr-4 text-right tabular-nums">{item.quantity}</td><td className="py-3 pr-4 text-right tabular-nums">{money(item.unitPrice)}</td><td className="py-3 text-right font-medium tabular-nums">{money(item.unitPrice * item.quantity)}</td></tr>)}</tbody>
              </table>
              {!soldItems.length && <p className="py-5 text-center text-sm text-[#86868B]">No delivered product sales in this period yet.</p>}
              {soldItems.length > 30 && <p className="pt-3 text-xs text-[#86868B]">Showing the 30 most recent item records. The totals above include all delivered orders in the selected period.</p>}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="mt-4">
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between gap-4"><div><CardTitle className="text-lg">Orders</CardTitle><CardDescription>Recent customer orders · refreshes automatically</CardDescription></div><span className="rounded-full bg-[#F5F5F7] px-3 py-1.5 text-xs font-medium text-[#626267]">{rangeOrders.length} total</span></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] text-left text-sm">
                <thead className="text-xs text-[#86868B]"><tr><th className="pb-3 pr-4 font-medium">Order</th><th className="pb-3 pr-4 font-medium">Customer</th><th className="pb-3 pr-4 font-medium">Items</th><th className="pb-3 pr-4 text-right font-medium">Total</th><th className="pb-3 text-right font-medium">Status</th></tr></thead>
                <tbody className="divide-y divide-black/5">{rangeOrders.map(order => <tr key={order.id}>
                  <td className="py-3 pr-4"><span className="font-medium">{order.order_number || '—'}</span><span className="mt-1 block text-xs text-[#86868B]">{formatDate(order.created_at)}</span></td>
                  <td className="py-3 pr-4">{order.customer_name || '—'}<span className="mt-1 block max-w-[180px] truncate text-xs text-[#86868B]">{order.location || ''}</span></td>
                  <td className="max-w-[280px] py-3 pr-4 text-[#626267]">{orderItems(order).map((item, index) => `${item.name || 'Product'} ×${Number(item.quantity) || 0}`).join(', ') || '—'}</td>
                  <td className="py-3 pr-4 text-right tabular-nums">{money(Number(order.total_kes || 0))}</td>
                  <td className="py-3 text-right"><select aria-label={`Status for ${order.order_number || 'order'}`} disabled={savingOrderId === order.id} value={order.status || orderStatuses[0]} onChange={event => void updateStatus(order.id, event.target.value)} className="max-w-[165px] rounded-lg bg-[#F5F5F7] px-2 py-2 text-xs outline-none focus:ring-2 focus:ring-[#0071E3] disabled:opacity-60">{orderStatuses.map(status => <option key={status}>{status}</option>)}</select></td>
                </tr>)}</tbody>
              </table>
              {!rangeOrders.length && <p className="py-5 text-center text-sm text-[#86868B]">No orders in this period.</p>}
            </div>
          </CardContent>
        </Card>
      </section>
      <p className="mt-5 text-center text-xs text-[#86868B]">Sales totals use Delivered orders only. Pending WhatsApp orders are not counted as completed sales.</p>
    </div>
  </main>
}

function MetricCard({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: React.ReactNode }) {
  return <Card className="rounded-2xl border-0 shadow-sm"><CardHeader className="flex flex-row items-center justify-between gap-4 pb-2"><CardDescription>{label}</CardDescription><span className="grid size-8 place-items-center rounded-full bg-[#F5F5F7] text-[#626267]">{icon}</span></CardHeader><CardContent><p className="text-2xl font-semibold tracking-tight tabular-nums">{value}</p><p className="mt-1 text-xs text-[#86868B]">{detail}</p></CardContent></Card>
}

function EmptyPanel({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  return <div className="flex min-h-[230px] flex-col items-center justify-center text-center"><span className="grid size-10 place-items-center rounded-full bg-[#F5F5F7] text-[#86868B]">{icon}</span><p className="mt-3 text-sm font-medium">{title}</p><p className="mt-1 max-w-[280px] text-xs leading-5 text-[#86868B]">{detail}</p></div>
}
