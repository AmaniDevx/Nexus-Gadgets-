import Link from 'next/link'

export default function ForgotPasswordPage() {
  return <main className="flex min-h-screen items-center justify-center bg-[#F5F5F7] px-5 py-10 text-[#1D1D1F]">
    <section className="w-full max-w-[420px] rounded-3xl bg-white p-7 shadow-[0_8px_36px_rgba(0,0,0,0.08)] md:p-9">
      <Link href="/admin" className="text-sm font-semibold tracking-tight">Nexus Gadgets</Link>
      <p className="mt-8 text-sm font-medium text-[#0071E3]">Admin account</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-[-.04em]">Update password</h1>
      <p className="mt-3 text-sm leading-6 text-[#6E6E73]">Admin credentials are managed as server-only deployment variables. The project owner can update <code className="rounded bg-[#F5F5F7] px-1.5 py-0.5">ADMIN_PASSWORD</code> in Vercel Settings → Vars and redeploy.</p>
      <Link href="/admin" className="mt-6 inline-block text-sm text-[#0071E3] hover:underline">Back to admin sign-in</Link>
    </section>
  </main>
}
