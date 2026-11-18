import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from '@/lib/admin-session'
import { isSupabaseConfigured } from '@/lib/supabase/config'

const MAX_IMAGE_SIZE = 15 * 1024 * 1024
const BUCKET_NAME = 'nexus-images' as const

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value
  if (!await verifyAdminSessionToken(token)) {
    return jsonError('Admin access is required.', 401)
  }

  if (!isSupabaseConfigured) {
    return jsonError('Image storage is not configured for this deployment.', 503)
  }

  let file: File
  try {
    const formData = await request.formData()
    const candidate = formData.get('file')
    if (!(candidate instanceof File)) {
      return jsonError('Choose an image file and try again.', 400)
    }
    file = candidate
  } catch {
    return jsonError('The image upload could not be read. Please choose the file again.', 400)
  }

  if (!file.type.toLowerCase().startsWith('image/')) {
    return jsonError('Choose a file recognized by your browser as an image.', 415)
  }
  if (file.size === 0) {
    return jsonError('The selected image is empty.', 400)
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return jsonError('Each image must be 15 MB or smaller.', 413)
  }

  const extension = file.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12) || 'image'
  const path = `products/${crypto.randomUUID()}.${extension}`
  const storage = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } },
  ).storage.from(BUCKET_NAME)

  try {
    const { data, error } = await storage.upload(path, file, {
      contentType: file.type,
      upsert: false,
    })

    if (error || !data) {
      const reason = error?.message || 'Supabase returned no upload result'
      const message = reason.toLowerCase()
      console.error('[admin/product-images] Storage upload failed', {
        bucket: BUCKET_NAME,
        path,
        statusCode: error?.statusCode,
        error,
      })
      if (/bucket.*not found|not found.*bucket/.test(message)) {
        return jsonError(`The ${BUCKET_NAME} storage bucket was not found: ${reason}`, 503)
      }
      if (/row-level security|permission|not authorized|unauthorized/.test(message)) {
        return jsonError(`Storage denied this upload to ${BUCKET_NAME}: ${reason}`, 403)
      }
      return jsonError(`Supabase Storage upload failed: ${reason}`, error?.statusCode === '403' ? 403 : 502)
    }

    const { data: publicData } = storage.getPublicUrl(data.path)
    if (!publicData.publicUrl) {
      console.error('[admin/product-images] Public URL generation returned an empty URL', {
        bucket: BUCKET_NAME,
        path: data.path,
      })
      return jsonError('The image uploaded, but Supabase did not return a public URL.', 502)
    }
    return NextResponse.json(
      { image: publicData.publicUrl },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown Supabase Storage error'
    console.error('[admin/product-images] Storage request failed', { bucket: BUCKET_NAME, path, reason, error })
    return jsonError(`Supabase Storage request failed: ${reason}`, 502)
  }
}
