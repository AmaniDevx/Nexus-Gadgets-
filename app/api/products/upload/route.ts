import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from '@/lib/admin-session'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { diagnosticSupabaseFetch, getSupabaseErrorReason } from '@/lib/supabase/network-errors'
import { toProductRow, type Product } from '@/lib/products'

export const runtime = 'nodejs'

const IMAGE_BUCKET = 'nexus-images'
const MAX_IMAGES = 4
const MAX_IMAGE_SIZE = 2 * 1024 * 1024

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } })
}

function createSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
      global: { fetch: diagnosticSupabaseFetch },
    },
  )
}

function isRecord(value: unknown): value is Record<string, string> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) &&
    Object.values(value).every(item => typeof item === 'string'))
}

export async function POST(request: Request) {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value
  if (!await verifyAdminSessionToken(token)) return jsonError('Admin access is required.', 401)
  if (!isSupabaseConfigured) return jsonError('Supabase is not configured for this deployment.', 503)

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return jsonError('The product upload could not be read. Please try again.', 400)
  }

  let product: Product
  try {
    const value = formData.get('product')
    if (typeof value !== 'string') return jsonError('Product details are required.', 400)
    product = JSON.parse(value) as Product
  } catch {
    return jsonError('Product details are invalid.', 400)
  }

  if (!product || typeof product !== 'object' || typeof product.id !== 'string' || !product.id ||
    typeof product.name !== 'string' || !product.name.trim() || product.name.length > 160 ||
    typeof product.category !== 'string' || !product.category.trim() || product.category.length > 80 ||
    !Number.isFinite(product.price) || product.price <= 0 || product.price > 100_000_000 ||
    typeof product.summary !== 'string' || product.summary.length > 4000 || !isRecord(product.specs) ||
    Object.keys(product.specs).length > 100 ||
    (product.brand !== undefined && typeof product.brand !== 'string') ||
    (product.condition !== undefined && typeof product.condition !== 'string')) {
    return jsonError('Provide a valid product name, category, price, description, and specifications.', 400)
  }

  const files = formData.getAll('images')
  if (files.length < 1 || files.length > MAX_IMAGES || files.some(file => !(file instanceof File))) {
    return jsonError(`Choose between 1 and ${MAX_IMAGES} product photos.`, 400)
  }
  const imageFiles = files as File[]
  for (const file of imageFiles) {
    if (file.type !== 'image/webp') return jsonError('Product photos must be optimized WebP images.', 415)
    if (!file.size || file.size > MAX_IMAGE_SIZE) return jsonError('Each optimized photo must be 2 MB or smaller.', 413)
  }

  const supabase = createSupabaseClient()
  const storage = supabase.storage.from(IMAGE_BUCKET)
  const uploadedPaths: string[] = []
  const imageUrls: string[] = []

  try {
    for (const file of imageFiles) {
      const path = `products/${crypto.randomUUID()}.webp`
      const buffer = Buffer.from(await file.arrayBuffer())
      const { data, error } = await storage.upload(path, buffer, {
        contentType: 'image/webp',
        upsert: false,
      })

      if (error) throw error
      if (!data) throw new Error('Supabase returned no upload result.')
      uploadedPaths.push(data.path)

      const { data: publicData } = storage.getPublicUrl(data.path)
      if (!publicData.publicUrl) throw new Error('Supabase did not return a public image URL.')
      imageUrls.push(publicData.publicUrl)
    }

    const productWithImages: Product = {
      ...product,
      image: imageUrls[0],
      images: imageUrls,
    }
    const { error } = await supabase.from('products').insert(toProductRow(productWithImages))
    if (error) throw error

    return NextResponse.json({ ok: true }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (uploadedPaths.length) {
      try {
        const { error: cleanupError } = await storage.remove(uploadedPaths)
        if (cleanupError) {
          console.error('[products/upload] Could not clean up uploaded images', {
            paths: uploadedPaths,
            reason: getSupabaseErrorReason(cleanupError),
          })
        }
      } catch (cleanupError) {
        console.error('[products/upload] Could not clean up uploaded images', {
          paths: uploadedPaths,
          reason: getSupabaseErrorReason(cleanupError),
        })
      }
    }

    const reason = getSupabaseErrorReason(error)
    console.error('[products/upload] Server-side image upload or product insert failed:', reason)
    const status = /row-level security|permission|not authorized|unauthorized/i.test(reason) ? 403 : 502
    return jsonError(reason, status)
  }
}
