export type Product = {
  id: string
  name: string
  category: string
  brand?: string
  price: number
  condition: string
  summary: string
  image: string
  images?: string[]
  specs: Record<string, string>
  inStock: boolean
  featured?: boolean
}

type ProductRow = {
  id: string | number
  name: string | null
  category: string | null
  price: number | string | null
  processor: string | null
  ram: string | null
  storage: string | null
  features: string | string[] | null
  full_specs: Record<string, unknown> | string | null
  image_url: string | null
  created_at: string | null
}

export const PRODUCT_COLUMNS = 'id,name,category,price,processor,ram,storage,features,full_specs,image_url,created_at'

const metadataKeys = new Set([
  '__nexus_brand',
  '__nexus_condition',
  '__nexus_images',
  '__nexus_in_stock',
  '__nexus_featured',
])

function toRecord(value: ProductRow['full_specs']): Record<string, unknown> {
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : {}
    } catch {
      return {}
    }
  }
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function toText(value: unknown) {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

function findSpec(specs: Record<string, unknown>, pattern: RegExp) {
  const entry = Object.entries(specs).find(([label]) => pattern.test(label))
  return entry ? toText(entry[1]) : ''
}

export function mapProductRow(row: ProductRow): Product {
  const fullSpecs = toRecord(row.full_specs)
  const specs = Object.fromEntries(
    Object.entries(fullSpecs)
      .filter(([key]) => !metadataKeys.has(key))
      .map(([key, value]) => [key, toText(value)])
      .filter(([, value]) => value),
  )
  const image = row.image_url || ''
  const storedImages = fullSpecs.__nexus_images
  const features = Array.isArray(row.features)
    ? row.features.map(toText).filter(Boolean).join(', ')
    : toText(row.features)
  const bestSuitedFor = findSpec(specs, /best suited for|use cases?|recommended use/i)

  if (row.processor && !findSpec(specs, /processor|cpu|chip/i)) specs.Processor = row.processor
  if (row.ram && !findSpec(specs, /ram|memory/i)) specs.RAM = row.ram
  if (row.storage && !findSpec(specs, /storage|ssd/i)) specs.Storage = row.storage
  if (bestSuitedFor && !findSpec(specs, /best suited for|use cases?|recommended use/i)) specs['Best Suited For'] = bestSuitedFor

  return {
    id: String(row.id),
    name: row.name || '',
    category: row.category || 'Accessories',
    brand: toText(fullSpecs.__nexus_brand) || undefined,
    price: Number(row.price || 0),
    condition: toText(fullSpecs.__nexus_condition) || 'Brand New',
    summary: features,
    image,
    images: Array.isArray(storedImages) ? storedImages.map(toText).filter(Boolean) : image ? [image] : [],
    specs,
    inStock: typeof fullSpecs.__nexus_in_stock === 'boolean' ? fullSpecs.__nexus_in_stock : true,
    featured: fullSpecs.__nexus_featured === true,
  }
}

export function toProductRow(product: Product) {
  const fullSpecs = { ...product.specs }
  const processor = findSpec(fullSpecs, /processor|cpu|chip/i)
  const ram = findSpec(fullSpecs, /ram|memory/i)
  const storage = findSpec(fullSpecs, /storage|ssd/i)
  Object.assign(fullSpecs, {
    __nexus_brand: product.brand || null,
    __nexus_condition: product.condition || 'Brand New',
    __nexus_images: product.images?.length ? product.images : [product.image],
    __nexus_in_stock: product.inStock,
    __nexus_featured: Boolean(product.featured),
  })

  return {
    id: product.id,
    name: product.name,
    category: product.category,
    price: product.price,
    processor,
    ram,
    storage,
    features: product.summary,
    full_specs: fullSpecs,
    image_url: product.image,
  }
}

export async function fetchProducts(): Promise<Product[]> {
  const response = await fetch('/api/products', { cache: 'no-store' })
  const result = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(typeof result?.error === 'string' ? result.error : 'Could not load live products.')
  }
  if (!Array.isArray(result)) throw new Error('The product catalog response is invalid.')

  return result as Product[]
}
