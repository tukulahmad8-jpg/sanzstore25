import { getSupabaseClient } from '@/lib/supabase'

export interface ProductMetrics {
  rating: number | null
  reviewCount: number
  sold: number
}

// Statistik (terjual, rating, jumlah ulasan) dibaca dari view agregat product_stats.
// Jangan baca tabel orders/reviews langsung dari halaman publik: RLS hanya menampilkan
// data milik pengunjung itu sendiri, sehingga angkanya salah untuk semua orang.
export async function getProductMetrics() {
  const supabase = getSupabaseClient()
  const metrics: Record<string, ProductMetrics> = {}

  if (!supabase) return { data: metrics }

  const { data, error } = await supabase
    .from('product_stats')
    .select('product_id,sold,rating,review_count')

  if (error) {
    // Kartu produk tetap tampil memakai angka bawaan produk.
    console.warn('[product-metrics]', error.message)
    return { data: metrics }
  }

  for (const row of data ?? []) {
    const id = String(row.product_id ?? '')
    if (!id) continue
    metrics[id] = {
      rating: row.rating === null || row.rating === undefined ? null : Number(row.rating),
      reviewCount: Number(row.review_count || 0),
      sold: Number(row.sold || 0),
    }
  }

  return { data: metrics }
}
