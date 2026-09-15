import { getSellerSupabaseClient, getSupabaseClient } from '@/lib/supabase'
import type { Product } from '@/types/domain'

const LOCAL_KEY = 'sanz-products-fallback'

function getLocalProducts(): Product[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '[]') as Product[]
  } catch {
    return []
  }
}

function setLocalProducts(products: Product[]) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(products))
}

function mergeLocalProduct(product: Product) {
  const local = getLocalProducts()
  setLocalProducts([product, ...local.filter((item) => item.id !== product.id)])
}

function normalizeProduct(product: Product): Product {
  const basePrice = Math.max(0, Number(product.price ?? 0))
  const baseWeight = Math.max(0, Number(product.weight ?? 0))
  const variants = Array.isArray(product.variants)
    ? product.variants.map((variant) => ({
        ...variant,
        price: Number(variant?.price ?? 0) > 0 ? Number(variant.price) : basePrice,
        stock: Math.max(0, Number(variant?.stock ?? 0)),
        weight: Number(variant?.weight ?? 0) > 0 ? Number(variant.weight) : baseWeight,
      }))
    : []

  return {
    ...product,
    price: basePrice,
    stock: Math.max(0, Number(product.stock ?? 0)),
    weight: baseWeight,
    variants,
  }
}

function normalizeProducts(products: Product[]) {
  return products.map(normalizeProduct)
}

const demoProducts: Product[] = [
  {
    id: 'demo-mouse-rgb',
    title: 'Mouse Gaming RGB',
    category: 'Gaming',
    price: 149000,
    cost_price: 95000,
    stock: 25,
    weight: 250,
    rack: 'A3',
    supplier: { name: 'Supplier Demo', whatsapp: '08123456789' },
    image: '/placeholder.svg',
    images: ['/placeholder.svg'],
    summary: 'Produk demo fallback lokal.',
    badge: 'Demo',
    status: 'Aktif',
    sold: 0,
  },
]

export async function getProducts() {
  const local = getLocalProducts()
  const supabase = getSupabaseClient()

  if (!supabase) {
    return { data: local.length ? local : demoProducts }
  }

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.warn('[products:supabase]', error.message)
    return { data: local.length ? local : demoProducts }
  }

  const remote = normalizeProducts((data ?? []) as Product[])

  // Database is the source of truth whenever it is reachable.
  if (remote.length) setLocalProducts(remote)

  return { data: remote.length ? remote : demoProducts }
}


export async function getProductsByIdsStrict(ids: string[]) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)))
  if (!uniqueIds.length) return { data: [] as Product[] }

  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase belum dikonfigurasi. Stok tidak dapat diverifikasi.')

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .in('id', uniqueIds)

  if (error) throw new Error(`Gagal memverifikasi stok terbaru: ${error.message}`)
  return { data: normalizeProducts((data ?? []) as Product[]) }
}

export async function getProductById(id: string) {
  const supabase = getSupabaseClient()

  if (supabase) {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (!error && data) {
      const product = normalizeProduct(data as Product)
      mergeLocalProduct(product)
      return { data: product }
    }

    if (error) console.warn('[product:supabase]', error.message)
  }

  const local = getLocalProducts().find((item) => item.id === id)
  const fallback = local ?? demoProducts.find((item) => item.id === id) ?? null
  return { data: fallback ? normalizeProduct(fallback) : null }
}

/**
 * Only send columns that belong to public.products.
 * The old implementation spread the whole client object and also injected
 * derived fields such as rating/review_count. On databases without those
 * columns Supabase rejected the entire upsert, but the error was swallowed,
 * making the Seller UI look as if the stock was saved when it was not.
 */
function toProductWriteRow(product: Product) {
  return {
    id: product.id,
    title: product.title,
    category: product.category || 'Produk',
    price: Number(product.price ?? 0),
    cost_price: Number(product.cost_price ?? 0),
    stock: Math.max(0, Number(product.stock ?? 0)),
    weight: Math.max(0, Number(product.weight ?? 0)),
    rack: product.rack ?? '',
    supplier: product.supplier ?? {},
    image: product.image ?? '',
    images: Array.isArray(product.images) ? product.images : [],
    summary: product.summary ?? '',
    badge: product.badge ?? '',
    status: product.status ?? 'Aktif',
    sold: Math.max(0, Number(product.sold ?? 0)),
    has_variants: Boolean(product.has_variants),
    variants: Array.isArray(product.variants) ? product.variants : [],
    updated_at: new Date().toISOString(),
  }
}

async function requireSellerClient() {
  const supabase = getSellerSupabaseClient()
  if (!supabase) throw new Error('Supabase seller belum dikonfigurasi.')

  const { data, error } = await supabase.auth.getSession()
  if (error) throw new Error(`Sesi seller gagal dibaca: ${error.message}`)
  if (!data.session) throw new Error('Sesi seller sudah berakhir. Silakan login ulang.')

  return supabase
}

export async function saveProduct(product: Product) {
  const supabase = await requireSellerClient()

  const { data, error } = await supabase
    .from('products')
    .upsert(toProductWriteRow(product), { onConflict: 'id' })
    .select('*')
    .single()

  if (error) {
    console.error('[products:save]', error)
    throw new Error(`Produk gagal disimpan ke database: ${error.message}`)
  }

  const saved = normalizeProduct(data as Product)
  mergeLocalProduct(saved)
  return { data: saved }
}

// Kept for compatibility with older callers. Writes are intentionally
// sequential and authenticated with the dedicated seller Supabase client.
export async function saveProducts(products: Product[]) {
  const saved: Product[] = []
  for (const product of products) {
    const result = await saveProduct(product)
    saved.push(result.data)
  }
  return { data: saved }
}

export async function deleteProduct(id: string) {
  const supabase = await requireSellerClient()
  const { error } = await supabase.from('products').delete().eq('id', id)

  if (error) {
    console.error('[products:delete]', error)
    throw new Error(`Produk gagal dihapus dari database: ${error.message}`)
  }

  setLocalProducts(getLocalProducts().filter((product) => product.id !== id))
  return { ok: true }
}
