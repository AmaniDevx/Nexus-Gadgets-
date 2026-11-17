'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [pending, setPending] = useState<boolean>(false)

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setPending(true)

    try {
      const response = await fetch('/api/admin/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
        cache: 'no-store',
      })

      if (response.status === 401) {
        setError('Invalid email or password.')
        return
      }
      if (response.status === 503) {
        setError('Admin sign-in is not configured for this deployment. Contact the project owner.')
        return
      }
      if (!response.ok) {
        setError('The sign-in request could not be verified. Reload the page and try again.')
        return
      }

      router.replace('/?admin=1')
    } catch {
      setError('Could not reach the sign-in service. Check your connection and try again.')
    } finally {
      setPending(false)
    }
  }

  return <main className="flex min-h-screen items-center justify-center bg-[#F5F5F7] px-5 py-10 text-[#1D1D1F]">
    <section className="w-full max-w-[420px] rounded-3xl bg-white p-7 shadow-[0_8px_36px_rgba(0,0,0,0.08)] md:p-9">
      <Link href="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight"><span className="grid size-7 place-items-center rounded-lg bg-[#1D1D1F] text-xs text-white">N</span>Nexus Gadgets</Link>
      <p className="mt-8 text-sm font-medium text-[#0071E3]">Staff sign-in</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-[-.04em]">Admin access</h1>
      <p className="mt-2 text-sm leading-6 text-[#6E6E73]">Sign in with your authorized staff account to manage the store.</p>
      <form onSubmit={signIn} className="mt-7 flex flex-col gap-4">
        <label className="flex flex-col gap-2 text-sm font-medium">Email<input type="email" autoComplete="username" required disabled={pending} value={email} onChange={event => setEmail(event.target.value)} className="rounded-xl bg-[#F5F5F7] px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-[#0071E3]"/></label>
        <label className="flex flex-col gap-2 text-sm font-medium">Password<input type="password" autoComplete="current-password" required disabled={pending} value={password} onChange={event => setPassword(event.target.value)} className="rounded-xl bg-[#F5F5F7] px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-[#0071E3]"/></label>
        {error&&<p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        <button disabled={pending} className="mt-1 rounded-full bg-[#1D1D1F] px-5 py-3 text-sm font-medium text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60">{pending?'Signing in…':'Sign in'}</button>
      </form>
      <Link href="/admin/forgot-password" className="mt-4 inline-block text-sm text-[#0071E3] hover:underline">Update admin password</Link>
      <Link href="/" className="mt-6 inline-block text-sm text-[#86868B] hover:text-[#1D1D1F]">Return to storefront</Link>
    </section>
  </main>
}
