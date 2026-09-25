import { useEffect, useMemo, useState } from 'react'
import { Star, MessageSquareText } from 'lucide-react'
import { Card } from '@/components/common/Card'
import { getSellerSupabaseClient } from '@/lib/supabase'

type ReviewRow = {
  id: string
  product_id: string | null
  order_id: string | null
  customer_phone: string | null
  rating: number | null
  comment: string | null
  created_at: string
  images: string[] | null
  products?: { title: string | null; image: string | null } | null
  orders?: { customer: Record<string, unknown> | null } | null
}

// Menyamarkan nama pembeli untuk privasi -- tampilkan nama depan + inisial huruf
// pertama kata berikutnya, mis. "Ikhsan Wahyudi" -> "Ikhsan W."
function maskName(rawName: unknown, phone: string | null) {
  const name = String(rawName || '').trim()
  if (!name) {
    const digits = String(phone || '').replace(/\D/g, '')
    return digits ? `Pembeli •${digits.slice(-4)}` : 'Pembeli'
  }
  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0]
  return `${parts[0]} ${parts[1][0].toUpperCase()}.`
}

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return value
  }
}

function StarRow({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${value} dari 5 bintang`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={15} className={n <= value ? 'fill-amber-400 text-amber-400' : 'text-[var(--muted)]'} />
      ))}
    </div>
  )
}

export function SellerReviewsPage() {
  const [reviews, setReviews] = useState<ReviewRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [ratingFilter, setRatingFilter] = useState<number | 'all'>('all')

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError('')
      const supabase = getSellerSupabaseClient()
      if (!supabase) {
        setError('Koneksi Supabase belum siap.')
        setLoading(false)
        return
      }
      const { data, error: fetchError } = await supabase
        .from('reviews')
        .select('id,product_id,order_id,customer_phone,rating,comment,created_at,images,products(title,image),orders(customer)')
        .order('created_at', { ascending: false })
        .limit(200)
      if (!active) return
      if (fetchError) {
        setError(fetchError.message)
      } else {
        setReviews((data || []) as unknown as ReviewRow[])
      }
      setLoading(false)
    }
    load()
    return () => { active = false }
  }, [])

  const average = useMemo(() => {
    if (reviews.length === 0) return 0
    const sum = reviews.reduce((acc, r) => acc + (r.rating || 0), 0)
    return sum / reviews.length
  }, [reviews])

  const filtered = useMemo(() => {
    if (ratingFilter === 'all') return reviews
    return reviews.filter((r) => r.rating === ratingFilter)
  }, [reviews, ratingFilter])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black">Ulasan</h1>
        <p className="text-sm text-[var(--muted)]">Semua ulasan pembeli untuk produk kamu.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="p-4">
          <div className="text-xs text-[var(--muted)]">Rating rata-rata</div>
          <div className="mt-1 text-2xl font-black">{average.toFixed(1)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-[var(--muted)]">Total ulasan</div>
          <div className="mt-1 text-2xl font-black">{reviews.length}</div>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setRatingFilter('all')}
          className={`rounded-full border px-3 py-1.5 text-sm ${ratingFilter === 'all' ? 'border-brand bg-brand text-white' : 'border-[var(--border)]'}`}
        >
          Semua
        </button>
        {[5, 4, 3, 2, 1].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRatingFilter(n)}
            className={`rounded-full border px-3 py-1.5 text-sm ${ratingFilter === n ? 'border-brand bg-brand text-white' : 'border-[var(--border)]'}`}
          >
            {n} <Star size={12} className="mb-0.5 inline fill-current" />
          </button>
        ))}
      </div>

      {loading && <Card className="p-6 text-center text-sm text-[var(--muted)]">Memuat ulasan...</Card>}
      {error && <Card className="p-6 text-center text-sm text-red-500">{error}</Card>}

      {!loading && !error && filtered.length === 0 && (
        <Card className="flex flex-col items-center gap-2 p-10 text-center text-[var(--muted)]">
          <MessageSquareText size={28} />
          <p>Belum ada ulasan untuk filter ini.</p>
        </Card>
      )}

      <div className="space-y-3">
        {filtered.map((review) => (
          <Card key={review.id} className="flex gap-4 p-4">
            {review.products?.image && (
              <img
                src={review.products.image}
                alt={review.products?.title || 'Produk'}
                className="h-16 w-16 shrink-0 rounded-lg object-cover"
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{review.products?.title || 'Produk'}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {maskName(review.orders?.customer?.name, review.customer_phone)} • {formatDate(review.created_at)}
                    {review.order_id ? ` • ${review.order_id}` : ''}
                  </p>
                </div>
                <StarRow value={review.rating || 0} />
              </div>
              {review.comment && <p className="mt-2 text-sm">{review.comment}</p>}
              {Array.isArray(review.images) && review.images.length > 0 && (
                <div className="mt-2 flex gap-2">
                  {review.images.slice(0, 4).map((src, i) => (
                    <img key={i} src={src} alt="" className="h-14 w-14 rounded-md object-cover" />
                  ))}
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
