import { getSupabaseClient } from '@/lib/supabase'

export interface ProductMetrics {
  rating: number | null
  reviewCount: number
  sold: number
}

export async function getProductMetrics() {
  const supabase = getSupabaseClient()
  const metrics: Record<string, ProductMetrics & { ratingTotal?: number }> = {}

  if (!supabase) return { data: {} as Record<string, ProductMetrics> }

  const { data: reviews } = await supabase.from('reviews').select('product_id,rating')
  if (Array.isArray(reviews)) {
    for (const review of reviews) {
      const id = review.product_id
      if (!metrics[id]) metrics[id] = { rating: null, reviewCount: 0, sold: 0, ratingTotal: 0 }
      metrics[id].reviewCount += 1
      metrics[id].ratingTotal = (metrics[id].ratingTotal || 0) + Number(review.rating || 0)
    }
  }

  const { data: orders } = await supabase.from('orders').select('status,items')
  if (Array.isArray(orders)) {
    for (const order of orders) {
      if (order.status !== 'Selesai') continue
      const items = Array.isArray(order.items) ? order.items : []
      for (const item of items) {
        const id = item.product?.id || item.product_id || item.id
        if (!id) continue
        if (!metrics[id]) metrics[id] = { rating: null, reviewCount: 0, sold: 0, ratingTotal: 0 }
        metrics[id].sold += Number(item.qty || 0)
      }
    }
  }

  for (const id of Object.keys(metrics)) {
    const item = metrics[id]
    item.rating = item.reviewCount ? (item.ratingTotal || 0) / item.reviewCount : null
    delete item.ratingTotal
  }

  return { data: metrics as Record<string, ProductMetrics> }
}
