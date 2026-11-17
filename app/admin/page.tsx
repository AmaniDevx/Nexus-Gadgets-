'use client'

import { useState, type FormEvent } from 'react'
import type { AuthError } from '@supabase/supabase-js'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { APPROVED_ADMIN_EMAIL } from '@/lib/admin-access'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

function getSignInErrorMessage(error: AuthError) {
  if (error.status === 429) return 'Too many sign-in attempts. Wait a moment and try again.'
  if (error.code === 'email_not_confirmed') return 'Confirm your email address before signing in.'
  if (error.code === 'invalid_credentials') return 'Invalid email or password.'
  if (error.name === 'AuthRetryableFetchError' || error.status === 0) {
    return 'Unable to connect to Supabase. Check your connection and try again.'
  }
  return 'Supabase could not complete sign-in. Please try again.'
}

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [pending, setPending] = useState<boolean>(false)

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (!isSupabaseConfigured) {
      setError('Admin sign-in is unavailable because Supabase is not configured for this deployment.')
      return
    }

    setPending(true)
    let sessionEstablished = false
    let authorized = false

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (authError) {
        setError(getSignInErrorMessage(authError))
        return
      }
      if (!data.user || !data.session) {
        setError('Supabase did not establish a session. Confirm your email and try again.')
        return
      }

      sessionEstablished = true
      if (data.user.email?.trim().toLowerCase() !== APPROVED_ADMIN_EMAIL) {
        setError('This account is not authorized to access the admin area.')
        return
      }

      const accessResponse = await fetch(
        `/api/admin/access?userId=${encodeURIComponent(data.user.id)}`,
        { cache: 'no-store' },
      )

      if (accessResponse.status === 503) {
        setError('Admin authentication is unavailable. Please try again later.')
        return
      }
      if (accessResponse.status === 401) {
        setError('Your session could not be verified. Please sign in again.')
        return
      }
      if (!accessResponse.ok) {
        setError('This account is not authorized to access the admin area.')
        return
      }

      authorized = true
      router.replace('/?admin=1')
    } catch (error: unknown) {
      setError(error instanceof TypeError || (error instanceof Error && error.name === 'AuthRetryableFetchError')
        ? 'Unable to connect to Supabase. Check your connection and try again.'
        : 'Sign-in failed unexpectedly. Please try again.')
    } finally {
      if (sessionEstablished && !authorized) {
        await supabase.auth.signOut().catch(() => undefined)
      }
      setPending(false)
    }
  }

  return <main className="flex min-h-screen items-center justify-center bg-[#F5F5F7] px-5 py-10 text-[#1D1D1F]">
    <section className="w-full max-w-[420px] rounded-3xl bg-white p-7 shadow-[0_8px_36px_rgba(0,0,0,0.08)] md:p-9">
      <Link href="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight"><span className="grid size-7 place-items-center rounded-lg bg-[#1D1D1F] text-xs text-white">N</span>Nexus Gadgets</Link>
      <p className="mt-8 text-sm font-medium text-[#0071E3]">Staff sign-in</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-[-.04em]">Admin access</h1>
      <p className="mt-2 text-sm leading-6 text-[#6E6E73]">Sign in with your authorized staff account to manage the store.</p>
      {!isSupabaseConfigured&&<p role="status" className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">Admin sign-in is unavailable because Supabase is not configured for this deployment.</p>}
      <form onSubmit={signIn} className="mt-7 flex flex-col gap-4">
        <label className="flex flex-col gap-2 text-sm font-medium">Email<input type="email" autoComplete="username" required disabled={!isSupabaseConfigured} value={email} onChange={event => setEmail(event.target.value)} className="rounded-xl bg-[#F5F5F7] px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-[#0071E3]"/></label>
        <label className="flex flex-col gap-2 text-sm font-medium">Password<input type="password" autoComplete="current-password" required disabled={!isSupabaseConfigured} value={password} onChange={event => setPassword(event.target.value)} className="rounded-xl bg-[#F5F5F7] px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-[#0071E3]"/></label>
        {error&&<p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        <button disabled={pending||!isSupabaseConfigured} className="mt-1 rounded-full bg-[#1D1D1F] px-5 py-3 text-sm font-medium text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60">{pending?'Signing in…':isSupabaseConfigured?'Sign in':'Sign-in unavailable'}</button>
      </form>
      <Link href="/admin/forgot-password" className="mt-4 inline-block text-sm text-[#0071E3] hover:underline">Forgot your password?</Link>
      <Link href="/" className="mt-6 inline-block text-sm text-[#86868B] hover:text-[#1D1D1F]">Return to storefront</Link>
    </section>
  </main>
}
