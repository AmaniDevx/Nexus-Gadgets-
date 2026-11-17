import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from '@/lib/admin-session'
import { isSupabaseConfigured } from '@/lib/supabase/config'

const MAX_IMAGE_SIZE = 15 * 1024 * 1024
const BUCKET_NAME = 'nexus-images'

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
      const message = error?.message.toLowerCase() || ''
      if (/bucket.*not found|not found.*bucket/.test(message)) {
        return jsonError(`The ${BUCKET_NAME} storage bucket was not found.`, 503)
      }
      if (/row-level security|permission|not authorized|unauthorized/.test(message)) {
        return jsonError(`Storage denied this upload. Check the ${BUCKET_NAME} bucket upload policy.`, 403)
      }
      console.error('[admin/product-images] Storage upload failed:', error?.message || 'No upload result')
      return jsonError('Storage could not save this image. Please try again.', 502)
    }

    const { data: publicData } = storage.getPublicUrl(data.path)
    return NextResponse.json(
      { image: publicData.publicUrl },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    console.error('[admin/product-images] Storage request failed:', error instanceof Error ? error.message : 'Unknown error')
    return jsonError('The image storage service could not be reached. Please try again.', 502)
  }
}
