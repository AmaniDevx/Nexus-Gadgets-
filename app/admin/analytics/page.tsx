'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const statuses = ['Pending WhatsApp', 'Confirmed', 'Dispatched', 'Delivered', 'Cancelled']

export default function AnalyticsPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [views, setViews] = useState<any[]>([])
  const [message, setMessage] = useState('')
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    let active = true
    async function loadAdminData() {
      const accessResponse = await fetch('/api/admin/access', { cache: 'no-store' })
      if (!active) return
      if (!accessResponse.ok) {
        window.location.replace('/admin')
        return
      }
      setAuthorized(true)
      const [orderResult, viewResult] = await Promise.all([
        supabase.from('orders').select('id, order_number, items, total_kes, customer_name, location, status, created_at').order('created_at', { ascending: false }),
        supabase.from('product_views').select('product_id, product_name'),
      ])
      if (!active) return
      if (orderResult.error || viewResult.error) setMessage('Analytics tables are not available yet. Existing storefront features remain usable.')
      setOrders(orderResult.data || [])
      const counts = new Map<string, { name: string; count: number }>()
      for (const view of viewResult.data || []) {
        const item = counts.get(view.product_id) || { name: view.product_name || 'Product', count: 0 }
        item.count += 1
        counts.set(view.product_id, item)
      }
      setViews([...counts.entries()].map(([id, item]) => ({ id, ...item })).sort((a, b) => b.count - a.count))
    }
    void loadAdminData()
    return () => { active = false }
  }, [])

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('orders').update({ status }).eq('id', id)
    if (!error) setOrders(current => current.map(order => order.id === id ? { ...order, status } : order))
  }

  if (!authorized) return <main className="grid min-h-screen place-items-center bg-[#F5F5F7] px-5 text-sm text-[#626267]">Checking admin access…</main>

  return <main className="min-h-screen bg-[#F5F5F7] px-5 py-8 text-[#1D1D1F] md:px-8">
    <div className="mx-auto max-w-[1100px]">
      <div className="flex items-center justify-between gap-4">
        <a href="/" className="text-sm text-[#0071E3]">← Storefront</a>
        <button onClick={() => { void supabase.auth.signOut().finally(() => window.location.replace('/admin')) }} className="rounded-full bg-white px-4 py-2 text-sm font-medium text-[#1D1D1F] shadow-sm">Sign out</button>
      </div>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Analytics &amp; Orders</h1>
      {message && <p role="status" className="mt-4 rounded-xl bg-white p-4 text-sm text-[#626267]">{message}</p>}
      <section className="mt-8 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold">Most viewed products</h2>
        <div className="mt-4 divide-y divide-black/5">{views.length ? views.map((view, index) => <div key={view.id} className="flex items-center justify-between py-3 text-sm"><span>{index + 1}. {view.name}</span><span className="tabular-nums text-[#86868B]">{view.count} views</span></div>) : <p className="py-5 text-sm text-[#86868B]">No view data available.</p>}</div>
      </section>
      <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold">Live orders</h2>
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="text-xs text-[#86868B]"><tr><th className="py-3">Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th></tr></thead><tbody className="divide-y divide-black/5">{orders.map(order => <tr key={order.id}><td className="py-3 font-medium">{order.order_number}</td><td>{order.customer_name || '—'}<div className="text-xs text-[#86868B]">{order.location || ''}</div></td><td>{Array.isArray(order.items) ? order.items.map((item: any) => `${item.name} ×${item.quantity}`).join(', ') : '—'}</td><td>KES {Number(order.total_kes || 0).toLocaleString('en-KE')}</td><td><select aria-label={`Status for ${order.order_number}`} value={order.status || statuses[0]} onChange={event => void updateStatus(order.id, event.target.value)} className="rounded-lg bg-[#F5F5F7] px-2 py-1.5">{statuses.map(status => <option key={status}>{status}</option>)}</select></td></tr>)}</tbody></table>{!orders.length && <p className="py-5 text-sm text-[#86868B]">No orders yet.</p>}</div>
      </section>
    </div>
  </main>
}
