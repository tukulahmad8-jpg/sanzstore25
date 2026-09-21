import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { Star } from 'lucide-react'
import { Button } from '@/components/common/Button'
import { getReviewedProductIds, submitReview } from '@/services/reviews.service'
import type { Order } from '@/types/domain'

type Row = { id: string; title: string; image: string }
type Draft = { rating: number; comment: string }

const MAX_COMMENT = 500

function uniqueProducts(order: Order): Row[] {
  const seen = new Set<string>()
  const rows: Row[] = []
  for (const item of (order.items || []) as any[]) {
    const id = String(item?.product?.id ?? item?.product_id ?? item?.id ?? '')
    if (!id || seen.has(id)) continue
    seen.add(id)
    rows.push({
      id,
      title: item?.product?.title || item?.title || 'Produk',
      image: item?.product?.image || item?.product?.images?.[0] || '/placeholder.svg',
    })
  }
  return rows
}

// Hanya ditampilkan untuk pesanan berstatus Selesai. Server (Edge Function submit-review)
// tetap memeriksa ulang bahwa pesanan milik pengirim, sudah selesai, dan memuat produknya.
export function OrderReviewSection({ order }: { order: Order }) {
  const products = useMemo(() => uniqueProducts(order), [order])
  const [reviewed, setReviewed] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [busyId, setBusyId] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getReviewedProductIds(order.id).then((result) => {
      if (cancelled) return
      setReviewed(new Set(result.data))
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [order.id])

  function draftOf(id: string): Draft {
    return drafts[id] ?? { rating: 0, comment: '' }
  }

  function update(id: string, patch: Partial<Draft>) {
    setDrafts((current: Record<string, Draft>) => ({ ...current, [id]: { ...draftOf(id), ...patch } }))
    setErrors((current: Record<string, string>) => ({ ...current, [id]: '' }))
  }

  async function submit(productId: string) {
    const draft = draftOf(productId)
    if (draft.rating < 1) {
      setErrors((current: Record<string, string>) => ({ ...current, [productId]: 'Pilih rating 1 sampai 5 bintang.' }))
      return
    }
    setBusyId(productId)
    try {
      await submitReview({ orderId: order.id, productId, rating: draft.rating, comment: draft.comment.trim() })
      setReviewed((current: Set<string>) => new Set(current).add(productId))
    } catch (error) {
      setErrors((current: Record<string, string>) => ({ ...current, [productId]: error instanceof Error ? error.message : 'Ulasan gagal dikirim.' }))
    } finally {
      setBusyId('')
    }
  }

  if (!products.length) return null

  return (
    <section className="order-section" id="ulasan-pesanan">
      <div className="order-section-head"><h2>Beri Ulasan</h2><span>{products.length} produk</span></div>

      {loading ? <p className="text-sm text-[var(--muted)]">Memuat...</p> : (
        <div className="grid gap-4">
          {products.map((product: Row) => {
            const draft = draftOf(product.id)
            const done = reviewed.has(product.id)

            return done ? (
              <div key={product.id} className="flex items-center gap-3 rounded-xl border border-[var(--line)] p-3 text-sm">
                <img src={product.image} alt={product.title} className="h-12 w-12 rounded-lg object-cover" />
                <div>
                  <b>{product.title}</b>
                  <p className="text-[var(--muted)]">Terima kasih, ulasan Anda sudah terkirim.</p>
                </div>
              </div>
            ) : (
              <div key={product.id} className="rounded-xl border border-[var(--line)] p-3">
                <div className="flex items-center gap-3">
                  <img src={product.image} alt={product.title} className="h-12 w-12 rounded-lg object-cover" />
                  <b className="text-sm">{product.title}</b>
                </div>

                <div className="mt-3 flex gap-1" role="radiogroup" aria-label={`Rating untuk ${product.title}`}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={draft.rating === n}
                      aria-label={`${n} bintang`}
                      onClick={() => update(product.id, { rating: n })}
                      className="p-0.5"
                    >
                      <Star size={26} className={n <= draft.rating ? 'text-amber-400' : 'text-[var(--line)]'} fill={n <= draft.rating ? 'currentColor' : 'none'} />
                    </button>
                  ))}
                </div>

                <textarea
                  value={draft.comment}
                  maxLength={MAX_COMMENT}
                  onChange={(event: ChangeEvent<HTMLTextAreaElement>) => update(product.id, { comment: event.target.value })}
                  placeholder="Ceritakan pengalaman Anda dengan produk ini (opsional)"
                  className="mt-3 min-h-[84px] w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 text-sm outline-none focus:border-brand"
                />

                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="text-xs text-[var(--muted)]">{draft.comment.length}/{MAX_COMMENT}</span>
                  <Button type="button" disabled={busyId === product.id} onClick={() => void submit(product.id)}>
                    {busyId === product.id ? 'Mengirim...' : 'Kirim Ulasan'}
                  </Button>
                </div>

                {errors[product.id] ? <p className="mt-2 text-sm text-red-400">{errors[product.id]}</p> : null}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
