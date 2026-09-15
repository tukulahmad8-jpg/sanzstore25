import type { Product } from '@/types/domain'
import { ProductCard } from './ProductCard'

export function FlashSale({ products }: { products: Product[] }) {
  const items = products.filter((product) => product.badge).slice(0, 4)
  if (!items.length) return null

  return (
    <section className="mb-8 rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-soft">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight">Flash Sale</h2>
          <p className="text-[var(--muted)]">Promo aktif hari ini.</p>
        </div>
        <span className="rounded-full bg-brand px-4 py-2 text-sm font-black text-white">02:14:35</span>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((product) => <ProductCard key={product.id} product={product} />)}
      </div>
    </section>
  )
}
