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

  const prompt = `Suggest technical specifications for the exact computer or device model: "${modelName}". Do not invent exact configurations. If RAM, storage, display, ports, or battery vary by SKU or cannot be confidently verified from your knowledge, clearly say "Confirm exact configuration" in that field. Distinguish the processor generation from the processor model. For a non-computer device, adapt relevant technical fields and mark irrelevant fields "Not applicable". Return concise, admin-editable strings. Best-suited-for should contain 3 to 5 short use-case recommendations. These are unverified catalog suggestions and must not be presented as verified facts. Return a JSON object matching this schema: ${JSON.stringify({ processor: 'string', ram: 'string', storage: 'string', displayAndFeatures: 'string', graphics: 'string', ports: 'string', battery: 'string', bestSuitedFor: ['3 to 5 short strings'], summary: 'string' })}`

  try {
    const response = await fetch('https://text.pollinations.ai/openai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai',
        messages: [
          { role: 'system', content: 'You generate cautious product specification suggestions. Return only valid JSON and never claim unverified details are certain.' },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(40_000),
      cache: 'no-store',
    })

    if (response.status === 402 || response.status === 429) {
      const retryAfter = response.headers.get('retry-after')
      return NextResponse.json({
        error: retryAfter
          ? `The free AI service is rate-limited. Please wait ${retryAfter} seconds before trying again.`
          : 'The free AI service is temporarily rate-limited. Please wait before trying again.',
      }, { status: 503 })
    }
    if (!response.ok) {
      console.error('[admin/spec-suggestions] Free AI service returned status:', response.status)
      return NextResponse.json({ error: 'The free AI service is temporarily unavailable. Please try again shortly.' }, { status: 502 })
    }

    const result: unknown = await response.json()
    const content = z.object({
      choices: z.array(z.object({ message: z.object({ content: z.string() }) })).min(1),
    }).parse(result).choices[0].message.content
    const specs = specSchema.parse(JSON.parse(content))
    return NextResponse.json({ specs })
  } catch (error) {
    console.error('[admin/spec-suggestions] Free AI generation failed:', error)
    if (error instanceof Error && error.name === 'TimeoutError') {
      return NextResponse.json({ error: 'The free AI service took too long to respond. Please try again.' }, { status: 504 })
    }
    return NextResponse.json({ error: 'The free AI service could not return valid specification suggestions. Please try again or enter the details manually.' }, { status: 502 })
  }
}
