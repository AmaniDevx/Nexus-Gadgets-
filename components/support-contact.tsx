'use client'

import { useState, type FormEvent } from 'react'
import { ArrowUpRight, MessageCircle, Phone, X } from 'lucide-react'
import { buildWhatsAppUrl, WHATSAPP_BUSINESS_DISPLAY } from '@/lib/whatsapp'

export function SupportContact() {
  const [open, setOpen] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [message, setMessage] = useState('')

  function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = message.trim()
    if (!text) return
    const composedMessage = [
      'Hello Nexus Gadgets Support,',
      ...(customerName.trim() ? [`My name is ${customerName.trim()}.`] : []),
      '',
      text,
    ].join('\n')
    window.open(buildWhatsAppUrl(composedMessage), '_blank', 'noopener,noreferrer')
    setOpen(false)
    setMessage('')
  }

  return <>
    <section aria-labelledby="support-contact-heading" className="flex flex-col gap-4 rounded-2xl bg-[#F5F5F7] p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-semibold" id="support-contact-heading">Need a hand choosing?</p>
        <p className="mt-1 text-sm text-[#6E6E73]">Talk with our team about products, delivery, or after-sales support.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <a href="tel:+254702813154" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium transition hover:bg-[#e9e9eb]"><Phone size={15}/> Call {WHATSAPP_BUSINESS_DISPLAY}</a>
        <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#168A4A] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#11733D]"><MessageCircle size={16}/> Message support</button>
      </div>
    </section>

    {open && <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 p-0 motion-overlay sm:items-center sm:p-4" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false) }}>
      <section role="dialog" aria-modal="true" aria-labelledby="support-dialog-title" className="motion-panel max-h-[92dvh] w-full max-w-[480px] overflow-y-auto rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-[#1D1D1F] shadow-2xl sm:rounded-3xl sm:p-7">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[#168A4A]">Nexus Gadgets · WhatsApp Business</p>
            <h2 id="support-dialog-title" className="mt-1 text-2xl font-semibold tracking-tight">How can we help?</h2>
            <p className="mt-1 text-sm text-[#6E6E73]">To: {WHATSAPP_BUSINESS_DISPLAY}</p>
          </div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close support message" className="rounded-full bg-[#F5F5F7] p-2"><X size={18}/></button>
        </header>
        <form onSubmit={sendMessage} className="mt-5 flex flex-col gap-4">
          <label htmlFor="support-name" className="flex flex-col gap-2 text-sm font-medium"><span>Your name <span className="font-normal text-[#86868B]">(optional)</span></span>
            <input id="support-name" autoComplete="name" maxLength={80} value={customerName} onChange={event => setCustomerName(event.target.value)} placeholder="Name" className="min-h-12 rounded-xl bg-[#F5F5F7] px-4 font-normal outline-none focus:ring-2 focus:ring-[#168A4A]" />
          </label>
          <label htmlFor="support-message" className="flex flex-col gap-2 text-sm font-medium">Your message
            <textarea id="support-message" required maxLength={1500} rows={4} value={message} onChange={event => setMessage(event.target.value)} placeholder="Tell us what you need help with…" className="resize-y rounded-xl bg-[#F5F5F7] px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-[#168A4A]" />
          </label>
          <button type="submit" disabled={!message.trim()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#168A4A] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#11733D] disabled:cursor-not-allowed disabled:opacity-50">Continue to WhatsApp <ArrowUpRight size={16}/></button>
          <p className="text-center text-xs leading-5 text-[#86868B]">WhatsApp will open with your message ready. Tap Send there to deliver it.</p>
        </form>
      </section>
    </div>}
  </>
}
