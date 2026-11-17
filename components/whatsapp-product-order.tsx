'use client'

import { useState, type FormEvent } from 'react'
import { ArrowUpRight, X } from 'lucide-react'
import { buildWhatsAppUrl, WHATSAPP_BUSINESS_DISPLAY } from '@/lib/whatsapp'

type OrderProduct = {
  name: string
  summary: string
  price: number
  specs: Record<string, string>
}

type WhatsAppProductOrderProps = {
  product: OrderProduct
  onClose: () => void
}

export function WhatsAppProductOrder({ product, onClose }: WhatsAppProductOrderProps) {
  const [customerName, setCustomerName] = useState('')
  const [location, setLocation] = useState('')

  function sendOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const chosenLocation = location.trim()
    if (!chosenLocation) return

    const specs = Object.entries(product.specs).slice(0, 8).map(([label, value]) => `${label}: ${value}`)
    const message = [
      'Hello Nexus Gadgets! I would like to order:',
      `Product: ${product.name}`,
      `Price: KES ${product.price.toLocaleString('en-KE')}`,
      `Summary: ${product.summary}`,
      ...(specs.length ? ['Specs:', ...specs] : []),
      ...(customerName.trim() ? [`Name: ${customerName.trim()}`] : []),
      `Delivery location / pickup: ${chosenLocation}`,
    ].join('\n')

    window.open(buildWhatsAppUrl(message), '_blank', 'noopener,noreferrer')
    onClose()
  }

  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section role="dialog" aria-modal="true" aria-labelledby="whatsapp-order-title" className="max-h-[92vh] w-full max-w-[460px] overflow-y-auto rounded-3xl bg-white p-4 text-[#1D1D1F] shadow-2xl md:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[#168A4A]">WhatsApp Business · {WHATSAPP_BUSINESS_DISPLAY}</p>
          <h2 id="whatsapp-order-title" className="mt-2 text-2xl font-semibold tracking-tight">Where should we deliver?</h2>
          <p className="mt-1.5 text-xs leading-5 text-[#6E6E73]">Product, price, specs, and your location go with the message.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close order form" className="shrink-0 rounded-full bg-[#F5F5F7] p-2 text-[#626267] hover:bg-[#e9e9eb]"><X size={18}/></button>
      </div>

      <div className="mt-3 rounded-2xl bg-[#F5F5F7] p-3">
        <p className="font-medium">{product.name}</p>
        <p className="mt-1 text-sm text-[#6E6E73]">KES {product.price.toLocaleString('en-KE')}</p>
      </div>

      <form onSubmit={sendOrder} className="mt-3 flex flex-col gap-2">
        <label htmlFor="whatsapp-customer-name" className="flex flex-col gap-2 text-sm font-medium">
          <span>Your name <span className="font-normal text-[#86868B]">(optional)</span></span>
          <input id="whatsapp-customer-name" autoComplete="name" maxLength={80} value={customerName} onChange={event => setCustomerName(event.target.value)} placeholder="Name" className="rounded-xl bg-[#F5F5F7] px-4 py-2.5 font-normal outline-none focus:ring-2 focus:ring-[#168A4A]"/>
        </label>
        <label htmlFor="whatsapp-delivery-location" className="flex flex-col gap-2 text-sm font-medium">
          <span>Delivery location or pickup point <span className="text-red-600" aria-hidden="true">*</span></span>
          <input id="whatsapp-delivery-location" autoComplete="street-address" maxLength={160} required value={location} onChange={event => setLocation(event.target.value)} placeholder="e.g. Westlands, Nairobi" className="rounded-xl bg-[#F5F5F7] px-4 py-2.5 font-normal outline-none focus:ring-2 focus:ring-[#168A4A]"/>
        </label>
        <button type="submit" disabled={!location.trim()} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#168A4A] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#11733D] disabled:cursor-not-allowed disabled:opacity-50">Continue to WhatsApp <ArrowUpRight size={16}/></button>
      </form>
    </section>
  </div>
}
