import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import {
  ADMIN_EMAIL,
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_TTL_SECONDS,
  createAdminSessionToken,
  isAdminSessionConfigured,
} from '@/lib/admin-session'

export const runtime = 'nodejs'

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function passwordMatches(input: string, configured: string, secret: string) {
  const inputDigest = createHmac('sha256', secret).update(input).digest()
  const configuredDigest = createHmac('sha256', secret).update(configured).digest()
  return timingSafeEqual(inputDigest, configuredDigest)
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()
  if (contentType !== 'application/json') return jsonError('invalid_request', 415)

  const sessionSecret = process.env.ADMIN_SESSION_SECRET
  const configuredPassword = process.env.ADMIN_PASSWORD
  if (!configuredPassword || !sessionSecret || !isAdminSessionConfigured(sessionSecret)) {
    return jsonError('admin_auth_not_configured', 503)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError('invalid_request', 400)
  }

  if (!isRecord(body) || typeof body.email !== 'string' || typeof body.password !== 'string' ||
    body.email.length > 254 || body.password.length > 1024) {
    return jsonError('invalid_request', 400)
  }

  const emailMatches = body.email.trim().toLowerCase() === ADMIN_EMAIL
  const passwordIsValid = passwordMatches(body.password, configuredPassword, sessionSecret)
  if (!emailMatches || !passwordIsValid) return jsonError('invalid_credentials', 401)

  try {
    const token = await createAdminSessionToken(sessionSecret)
    const response = NextResponse.json({ authorized: true }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    })
    response.cookies.set(ADMIN_SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: ADMIN_SESSION_TTL_SECONDS,
    })
    return response
  } catch {
    return jsonError('admin_auth_unavailable', 503)
  }
}

export async function DELETE() {
  const response = NextResponse.json({ loggedOut: true }, {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  })
  response.cookies.set(ADMIN_SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
  return response
}
