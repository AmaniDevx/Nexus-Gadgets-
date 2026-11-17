import { generateText, gateway, Output } from 'ai'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from '@/lib/admin-session'

const specSchema = z.object({
  processor: z.string(),
  ram: z.string(),
  storage: z.string(),
  displayAndFeatures: z.string(),
  graphics: z.string(),
  ports: z.string(),
  battery: z.string(),
  bestSuitedFor: z.array(z.string()),
  summary: z.string(),
})

export async function POST(request: Request) {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value
  if (!await verifyAdminSessionToken(token)) {
    return NextResponse.json({ error: 'Admin access is required.' }, { status: 401 })
  }

  let modelName: string
  try {
    const body: unknown = await request.json()
    modelName = z.object({ modelName: z.string().trim().min(3).max(120) }).parse(body).modelName
  } catch {
    return NextResponse.json({ error: 'Enter a specific model name to generate suggestions.' }, { status: 400 })
  }

  try {
    const { output } = await generateText({
      model: gateway('anthropic/claude-sonnet-5.5'),
      output: Output.object({ schema: specSchema }),
      prompt: `Suggest technical specifications for the exact computer or device model: "${modelName}". Do not invent exact configurations. If RAM, storage, display, ports, or battery vary by SKU or cannot be confidently verified from your knowledge, clearly say "Confirm exact configuration" in that field. Distinguish the processor generation from the processor model. For a non-computer device, adapt relevant technical fields and mark irrelevant fields "Not applicable". Return concise, admin-editable strings. Best-suited-for should contain 3 to 5 short use-case recommendations. These are unverified catalog suggestions and must not be presented as verified facts.`,
    })

    if (!output) return NextResponse.json({ error: 'No specification suggestions were returned. Please try again.' }, { status: 502 })
    return NextResponse.json({ specs: output })
  } catch (error) {
    console.error('[admin/spec-suggestions] Generation failed:', error)
    const message = error instanceof Error ? error.message : ''
    if (/customer_verification_required|valid credit card on file/i.test(message)) {
      return NextResponse.json({ error: 'AI suggestions are locked until a valid payment method is added to the Vercel AI Gateway account. Add one in the Vercel AI Gateway settings, then try again.' }, { status: 503 })
    }
    return NextResponse.json({ error: 'Specification generation is temporarily unavailable. Please try again or enter the details manually.' }, { status: 502 })
  }
}
