'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function requestReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    setError('')
    if (!isSupabaseConfigured) {
      setError('Password recovery is unavailable because Supabase is not configured for this deployment.')
      return
    }

    setPending(true)
    const redirectTo = new URL('/auth/callback?next=/admin/reset-password', window.location.origin).toString()
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    setPending(false)

    if (resetError) {
      setError(resetError.status === 429
        ? 'Too many requests. Wait a moment before trying again.'
        : 'We could not send the recovery email. Please try again later.')
      return
    }

    setMessage('If an account matches that email, a password reset link will be sent.')
  }

  return <main className="flex min-h-screen items-center justify-center bg-[#F5F5F7] px-5 py-10 text-[#1D1D1F]">
    <section className="w-full max-w-[420px] rounded-3xl bg-white p-7 shadow-[0_8px_36px_rgba(0,0,0,0.08)] md:p-9">
      <Link href="/admin" className="text-sm font-semibold tracking-tight">Nexus Gadgets</Link>
      <p className="mt-8 text-sm font-medium text-[#0071E3]">Account recovery</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-[-.04em]">Reset password</h1>
      <p className="mt-2 text-sm leading-6 text-[#6E6E73]">Enter your staff account email and we&apos;ll send a secure reset link.</p>
      {!isSupabaseConfigured&&<p role="status" className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">Password recovery is unavailable because Supabase is not configured for this deployment.</p>}
      <form onSubmit={requestReset} className="mt-7 flex flex-col gap-4">
        <label className="flex flex-col gap-2 text-sm font-medium">Email<input type="email" autoComplete="username" required disabled={!isSupabaseConfigured||pending} value={email} onChange={event => setEmail(event.target.value)} className="rounded-xl bg-[#F5F5F7] px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-[#0071E3]"/></label>
        {error&&<p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        {message&&<p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p>}
        <button disabled={pending||!isSupabaseConfigured} className="rounded-full bg-[#1D1D1F] px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60">{pending?'Sending…':isSupabaseConfigured?'Send reset link':'Recovery unavailable'}</button>
      </form>
      <Link href="/admin" className="mt-6 inline-block text-sm text-[#86868B] hover:text-[#1D1D1F]">Back to admin sign-in</Link>
    </section>
  </main>
}
