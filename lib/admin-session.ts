export const ADMIN_SESSION_COOKIE = 'nexus_admin'
export const ADMIN_EMAIL = 'lewalucas86@gmail.com'
export const ADMIN_SESSION_TTL_SECONDS = 8 * 60 * 60

const encoder = new TextEncoder()

function encodeBase64Url(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function decodeBase64Url(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')

  try {
    const binary = atob(padded)
    return Uint8Array.from(binary, (character) => character.charCodeAt(0))
  } catch {
    return null
  }
}

async function importSessionKey(secret: string) {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

export function isAdminSessionConfigured(secret = process.env.ADMIN_SESSION_SECRET) {
  return Boolean(secret && encoder.encode(secret).length >= 24)
}

export async function createAdminSessionToken(secret: string, now = Date.now()) {
  const issuedAt = Math.floor(now / 1000)
  const payload = encodeBase64Url(encoder.encode(JSON.stringify({
    sub: ADMIN_EMAIL,
    iat: issuedAt,
    exp: issuedAt + ADMIN_SESSION_TTL_SECONDS,
  })))
  const key = await importSessionKey(secret)
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  return `${payload}.${encodeBase64Url(new Uint8Array(signature))}`
}

export async function verifyAdminSessionToken(token: string | undefined, secret = process.env.ADMIN_SESSION_SECRET, now = Date.now()) {
  if (!token || token.length > 2048 || !isAdminSessionConfigured(secret)) return false

  const [encodedPayload, encodedSignature, extra] = token.split('.')
  if (!encodedPayload || !encodedSignature || extra !== undefined) return false

  const payloadBytes = decodeBase64Url(encodedPayload)
  const signatureBytes = decodeBase64Url(encodedSignature)
  if (!payloadBytes || !signatureBytes) return false

  try {
    const key = await importSessionKey(secret!)
    const signatureIsValid = await crypto.subtle.verify('HMAC', key, signatureBytes, encoder.encode(encodedPayload))
    if (!signatureIsValid) return false

    const payload: unknown = JSON.parse(new TextDecoder().decode(payloadBytes))
    if (!payload || typeof payload !== 'object') return false

    const session = payload as { sub?: unknown; iat?: unknown; exp?: unknown }
    const nowSeconds = Math.floor(now / 1000)
    return session.sub === ADMIN_EMAIL &&
      Number.isSafeInteger(session.iat) &&
      Number.isSafeInteger(session.exp) &&
      (session.iat as number) <= nowSeconds + 60 &&
      (session.exp as number) > nowSeconds &&
      (session.exp as number) > (session.iat as number) &&
      (session.exp as number) <= (session.iat as number) + ADMIN_SESSION_TTL_SECONDS
  } catch {
    return false
  }
}
