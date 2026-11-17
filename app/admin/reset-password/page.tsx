'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { hasAdminAccess } from '@/lib/admin-access'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [complete, setComplete] = useState(false)

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (password.length < 12) {
      setError('Use a password with at least 12 characters.')
      return
    }
    if (password !== confirmation) {
      setError('The passwords do not match.')
      return
    }

    setPending(true)
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !hasAdminAccess(authData.user)) {
      setError('This recovery link is invalid or expired. Request a new reset link.')
      setPending(false)
      return
    }

    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError(updateError.status === 429
        ? 'Too many requests. Wait a moment before trying again.'
        : 'The password could not be updated. Request a new reset link and try again.')
      setPending(false)
      return
    }

    await supabase.auth.signOut()
    setComplete(true)
    setPending(false)
  }

  return <main className="flex min-h-screen items-center justify-center bg-[#F5F5F7] px-5 py-10 text-[#1D1D1F]">
    <section className="w-full max-w-[420px] rounded-3xl bg-white p-7 shadow-[0_8px_36px_rgba(0,0,0,0.08)] md:p-9">
      <Link href="/admin" className="text-sm font-semibold tracking-tight">Nexus Gadgets</Link>
      <p className="mt-8 text-sm font-medium text-[#0071E3]">Account recovery</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-[-.04em]">Choose a new password</h1>
      {complete ? <div className="mt-5"><p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Your password has been updated. Sign in with your new password.</p><Link href="/admin" className="mt-5 inline-block text-sm text-[#0071E3]">Go to admin sign-in</Link></div> : <form onSubmit={updatePassword} className="mt-7 flex flex-col gap-4">
        <label className="flex flex-col gap-2 text-sm font-medium">New password<input type="password" autoComplete="new-password" minLength={12} required disabled={pending} value={password} onChange={event => setPassword(event.target.value)} className="rounded-xl bg-[#F5F5F7] px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-[#0071E3]"/></label>
        <label className="flex flex-col gap-2 text-sm font-medium">Confirm new password<input type="password" autoComplete="new-password" minLength={12} required disabled={pending} value={confirmation} onChange={event => setConfirmation(event.target.value)} className="rounded-xl bg-[#F5F5F7] px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-[#0071E3]"/></label>
        {error&&<p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        <button disabled={pending} className="rounded-full bg-[#1D1D1F] px-5 py-3 text-sm font-medium text-white disabled:cursor-wait disabled:opacity-60">{pending?'Updating…':'Update password'}</button>
      </form>}
    </section>
  </main>
}
