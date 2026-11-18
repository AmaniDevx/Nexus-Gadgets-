type ErrorDetails = {
  cause?: unknown
  originalError?: unknown
  message?: unknown
  code?: unknown
}

function findErrorReason(error: unknown, seen = new Set<object>()): string | undefined {
  if (!error || typeof error !== 'object' || seen.has(error)) return undefined
  seen.add(error)

  const details = error as ErrorDetails
  for (const nested of [details.cause, details.originalError]) {
    const reason = findErrorReason(nested, seen)
    if (reason && reason.toLowerCase() !== 'fetch failed') return reason
  }

  if (typeof details.message === 'string' && details.message && details.message.toLowerCase() !== 'fetch failed') {
    return details.message
  }
  if (typeof details.code === 'string' && details.code) return details.code
  if (typeof details.message === 'string' && details.message) return details.message
  return undefined
}

export function getSupabaseErrorReason(error: unknown) {
  return findErrorReason(error) || 'Supabase request failed.'
}

export async function diagnosticSupabaseFetch(input: RequestInfo | URL, init?: RequestInit) {
  try {
    return await fetch(input, init)
  } catch (error) {
    const reason = getSupabaseErrorReason(error)
    console.error('[supabase] Outbound request failed:', reason)
    throw new Error(reason, { cause: error })
  }
}
