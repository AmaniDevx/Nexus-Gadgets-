import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from '@/lib/admin-session'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { toProductRow, type Product } from '@/lib/products'

const IMAGE_BUCKET = 'nexus-images'
const uploadedPathPattern = /^products\/[a-f0-9-]+\.[a-z0-9]{1,12}$/i

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } })
}

async function isAdmin() {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value
  return verifyAdminSessionToken(token)
}

function createSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } },
  )
}

type ProductInput = { error: string } | { product: Product; uploadedImagePaths: string[] }

async function readProduct(request: Request): Promise<ProductInput> {
  try {
    const body = await request.json() as { product?: Product; uploadedImagePaths?: unknown }
    const product = body.product
    if (!product || typeof product !== 'object' || typeof product.id !== 'string' ||
      !product.id || typeof product.name !== 'string' || !product.name.trim() ||
      typeof product.category !== 'string' || !product.category.trim() ||
      !Number.isFinite(product.price) || product.price <= 0 || product.price > 100_000_000 ||
      typeof product.summary !== 'string' || product.summary.length > 4000 ||
      !product.specs || typeof product.specs !== 'object' || Array.isArray(product.specs) ||
      Object.keys(product.specs).length > 100 ||
      (product.images !== undefined && (!Array.isArray(product.images) || product.images.some(image => typeof image !== 'string'))) ||
      typeof product.image !== 'string' || !product.image.trim() || product.image.length > 2048) {
      return { error: 'Provide a product name, category, positive price, and image URL.' as const }
    }
    let imageUrl: URL
    try {
      imageUrl = new URL(product.image)
    } catch {
      return { error: 'The product image must be a valid HTTP or HTTPS URL.' as const }
    }
    if (imageUrl.protocol !== 'https:' && imageUrl.protocol !== 'http:') {
      return { error: 'The product image must use HTTP or HTTPS.' as const }
    }
    const uploadedImagePaths = Array.isArray(body.uploadedImagePaths)
      ? body.uploadedImagePaths.filter((path): path is string => typeof path === 'string' && uploadedPathPattern.test(path))
      : []
    return { product, uploadedImagePaths }
  } catch {
    return { error: 'The product request body is invalid.' as const }
  }
}

async function removeUnreferencedUploads(paths: string[]) {
  if (!paths.length) return
  const { error } = await createSupabaseClient().storage.from(IMAGE_BUCKET).remove(paths)
  if (error) {
    console.error('[admin/products] Could not clean up unreferenced product images', {
      bucket: IMAGE_BUCKET,
      paths,
      reason: error.message,
    })
  }
}

export async function POST(request: Request) {
  if (!await isAdmin()) return jsonError('Admin access is required.', 401)
  if (!isSupabaseConfigured) return jsonError('Supabase is not configured for this deployment.', 503)

  const input = await readProduct(request)
  if ('error' in input) return jsonError(input.error, 400)

  const { error } = await createSupabaseClient().from('products').insert(toProductRow(input.product))
  if (error) {
    console.error('[admin/products] Product insert failed', { id: input.product.id, reason: error.message, code: error.code })
    await removeUnreferencedUploads(input.uploadedImagePaths)
    return jsonError(`Could not save product to public.products: ${error.message}`, error.code === '42501' ? 403 : 502)
  }

  const referencedPaths = new Set<string>()
  const expectedOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin
  for (const image of [input.product.image, ...(input.product.images || [])]) {
    try {
      const imageUrl = new URL(image)
      const marker = `/storage/v1/object/public/${IMAGE_BUCKET}/`
      if (imageUrl.origin === expectedOrigin && imageUrl.pathname.includes(marker)) {
        referencedPaths.add(decodeURIComponent(imageUrl.pathname.split(marker).pop() || ''))
      }
    } catch {
      continue
    }
  }
  const unusedPaths = input.uploadedImagePaths.filter(path => !referencedPaths.has(path))
  await removeUnreferencedUploads(unusedPaths)

  return NextResponse.json({ ok: true }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
}

export async function PATCH(request: Request) {
  if (!await isAdmin()) return jsonError('Admin access is required.', 401)
  if (!isSupabaseConfigured) return jsonError('Supabase is not configured for this deployment.', 503)

  const input = await readProduct(request)
  if ('error' in input) return jsonError(input.error, 400)
  const { id, ...values } = toProductRow(input.product)
  const { error, count } = await createSupabaseClient()
    .from('products')
    .update(values, { count: 'exact' })
    .eq('id', id)

  if (error) {
    console.error('[admin/products] Product update failed', { id, reason: error.message, code: error.code })
    return jsonError(`Could not update public.products: ${error.message}`, error.code === '42501' ? 403 : 502)
  }
  if (count === 0) return jsonError('No product row changed. It may be missing or blocked by the current Supabase RLS policy.', 403)

  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function DELETE(request: Request) {
  if (!await isAdmin()) return jsonError('Admin access is required.', 401)
  if (!isSupabaseConfigured) return jsonError('Supabase is not configured for this deployment.', 503)

  let id: unknown
  try {
    id = (await request.json() as { id?: unknown }).id
  } catch {
    return jsonError('The product delete request is invalid.', 400)
  }
  if (typeof id !== 'string' || !id) return jsonError('A product id is required.', 400)

  const { error, count } = await createSupabaseClient()
    .from('products')
    .delete({ count: 'exact' })
    .eq('id', id)

  if (error) {
    console.error('[admin/products] Product delete failed', { id, reason: error.message, code: error.code })
    return jsonError(`Could not delete from public.products: ${error.message}`, error.code === '42501' ? 403 : 502)
  }
  if (count === 0) return jsonError('No product row changed. It may be missing or blocked by the current Supabase RLS policy.', 403)

  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
}
