import { Heart, ShoppingCart, Star } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import type { Product } from '@/types/domain'
import { useWishlistStore } from '@/stores/wishlist.store'
import { useCartStore } from '@/stores/cart.store'
import { formatCurrency } from '@/utils/format'
import type { ProductMetrics } from '@/services/product-metrics.service'

export function ProductCard({ product, metrics }: { product: Product; metrics?: ProductMetrics }) {
  const navigate = useNavigate()
  const wished = useWishlistStore((state) => state.has(product.id))
  const toggleWishlist = useWishlistStore((state) => state.toggle)
  const addToCart = useCartStore((state) => state.add)
  const sold = metrics?.sold ?? product.sold ?? 0
  const rating = metrics?.rating ?? null
  const reviewCount = metrics?.reviewCount ?? 0
  const outOfStock = Number(product.stock ?? 0) <= 0
  const hasVariants = Boolean(product.has_variants && product.variants?.length)

  return (
    <article className="product-card group relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] transition duration-200 hover:-translate-y-1 hover:border-brand/35 hover:shadow-2xl">
      <Link to={`/product/${product.id}`} className="block">
        <div className="relative aspect-[1/0.88] overflow-hidden bg-[var(--surface-2)]">
          <img src={product.image || product.images?.[0] || '/placeholder.svg'} alt={product.title} className="product-image h-full w-full object-contain" />
          {product.category ? <span className="absolute left-3 top-3 rounded-lg border border-white/20 bg-black/50 px-2 py-1 text-[11px] font-bold text-white backdrop-blur-md">{product.category}</span> : null}
        </div>
        <div className="p-3.5 pb-3">
          <h3 className="line-clamp-2 min-h-10 text-[14px] font-semibold leading-5">{product.title}</h3>
          <div className="mt-2.5 flex items-center justify-between gap-2 text-xs">
            {rating ? <span className="inline-flex items-center gap-1 text-amber-500"><Star size={13} fill="currentColor" /><b>{rating.toFixed(1)}</b><span className="text-[var(--muted)]">({reviewCount})</span></span> : <span className="text-[var(--muted)]">Belum ada ulasan</span>}
            <span className="text-[var(--muted)]">Terjual {sold}</span>
          </div>
          <div className="mt-2.5 flex items-end justify-between gap-2">
            <div>
              <strong className="block text-[17px] font-bold text-brand">{hasVariants ? 'Mulai ' : ''}{formatCurrency(product.price)}</strong>
              <p className={`mt-1 text-xs ${outOfStock ? 'font-bold text-red-500' : 'text-[var(--muted)]'}`}>Stok {product.stock}</p>
            </div>
            <button
              type="button"
              disabled={outOfStock}
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                if (outOfStock) return
                if (hasVariants) { navigate(`/product/${product.id}`); return }
                addToCart(product)
              }}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-brand/25 bg-brand/10 text-brand transition hover:bg-brand hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
              aria-label={hasVariants ? "Pilih varian produk" : "Tambah ke keranjang"}
              title={hasVariants ? "Pilih varian" : "Tambah ke keranjang"}
            >
              <ShoppingCart size={16} />
            </button>
          </div>
        </div>
      </Link>

      <button
        onClick={() => void toggleWishlist(product.id)}
        className={`absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full border border-white/20 bg-black/50 text-white backdrop-blur-md transition hover:bg-white hover:text-slate-950 active:scale-90 ${wished ? '!bg-brand !text-white' : ''}`}
        aria-label="Wishlist"
      >
        <Heart size={18} fill={wished ? 'currentColor' : 'none'} />
      </button>
    </article>
  )
}
