import { getSupabaseClient } from '@/lib/supabase'

export interface PublicReview {
  id: string
  product_id: string
  rating: number
  comment: string | null
  reviewer_name: string
  created_at: string
}

// Ulasan yang tampil publik: dibaca dari view product_reviews_public
// (tanpa nomor telepon/email, nama sudah disamarkan, ulasan yang disembunyikan tidak ikut).
export async function getProductReviews(productId: string) {
  const supabase = getSupabaseClient()
  if (!supabase || !productId) return { data: [] as PublicReview[] }

  const { data, error } = await supabase
    .from('product_reviews_public')
    .select('id,product_id,rating,comment,reviewer_name,created_at')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    console.warn('[reviews:list]', error.message)
    return { data: [] as PublicReview[] }
  }
  return { data: (data ?? []) as PublicReview[] }
}

// Produk di satu pesanan yang sudah diulas oleh pembeli ini (RLS hanya mengizinkan ulasan milik sendiri).
export async function getReviewedProductIds(orderId: string) {
  const supabase = getSupabaseClient()
  if (!supabase || !orderId) return { data: [] as string[] }

  const { data, error } = await supabase.from('reviews').select('product_id').eq('order_id', orderId)
  if (error) {
    console.warn('[reviews:mine]', error.message)
    return { data: [] as string[] }
  }
  return { data: (data ?? []).map((row: { product_id: string }) => String(row.product_id)) }
}

export async function submitReview(input: { orderId: string; productId: string; rating: number; comment: string }) {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase belum dikonfigurasi.')

  const { data, error } = await supabase.functions.invoke('submit-review', {
    body: {
      order_id: input.orderId,
      product_id: input.productId,
      rating: input.rating,
      comment: input.comment,
    },
  })

  if (error) {
    let detail = ''
    try {
      const response = (error as { context?: Response }).context
      if (response && typeof response.clone === 'function') {
        const body = await response.clone().json().catch(() => null) as { message?: string } | null
        if (body?.message) detail = body.message
      }
    } catch {}
    throw new Error(detail || error.message || 'Ulasan gagal dikirim.')
  }

  if (!data?.ok) throw new Error(data?.message || 'Ulasan gagal dikirim.')
  return { ok: true as const }
}
