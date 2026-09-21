import { Star } from 'lucide-react'
import type { PublicReview } from '@/services/reviews.service'

export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  const rounded = Math.round(value)
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value.toFixed(1)} dari 5 bintang`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size} className={n <= rounded ? 'text-amber-400' : 'text-[var(--line)]'} fill={n <= rounded ? 'currentColor' : 'none'} />
      ))}
    </span>
  )
}

export function ReviewList({ reviews, loading }: { reviews: PublicReview[]; loading: boolean }) {
  if (loading) return <p className="mt-4 text-sm text-[var(--muted)]">Memuat ulasan...</p>

  if (!reviews.length) {
    return <div className="mt-4 rounded-xl border border-dashed border-[var(--line)] p-8 text-center text-sm text-[var(--muted)]">Belum ada ulasan untuk produk ini.</div>
  }

  const average = reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length

  return (
    <div className="mt-4">
      <div className="flex items-center gap-3">
        <strong className="text-3xl">{average.toFixed(1)}</strong>
        <div>
          <Stars value={average} size={18} />
          <p className="mt-1 text-xs text-[var(--muted)]">{reviews.length} ulasan</p>
        </div>
      </div>

      <ul className="mt-5 grid gap-4">
        {reviews.map((review) => (
          <li key={review.id} className="rounded-xl border border-[var(--line)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Stars value={Number(review.rating || 0)} size={14} />
                <b className="text-sm">{review.reviewer_name || 'Pembeli'}</b>
              </div>
              <span className="text-xs text-[var(--muted)]">
                {review.created_at ? new Date(review.created_at).toLocaleDateString('id-ID', { dateStyle: 'medium' }) : ''}
              </span>
            </div>
            {review.comment ? <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{review.comment}</p> : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
