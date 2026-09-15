import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, ShieldCheck, Ticket, Truck } from 'lucide-react'
import { Button } from '@/components/common/Button'
import { getProducts } from '@/services/products.service'
import { getProductMetrics } from '@/services/product-metrics.service'
import { ProductCard } from '../components/ProductCard'
import { EmptyState } from '@/components/common/EmptyState'

export function HomePage() {
  const { data, isLoading } = useQuery({ queryKey: ['products'], queryFn: getProducts, refetchOnMount: 'always', refetchOnWindowFocus: true })
  const { data: metricsData } = useQuery({ queryKey: ['product-metrics'], queryFn: getProductMetrics })
  const products = data?.data ?? []
  const metrics = metricsData?.data ?? {}
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('Semua')
  const [sort, setSort] = useState('terbaru')
  const categories = useMemo(() => ['Semua', ...Array.from(new Set(products.map((item) => item.category).filter(Boolean)))], [products])
  const filtered = useMemo(() => {
    let result = products.filter((product) => {
      const matchQuery = `${product.title} ${product.category}`.toLowerCase().includes(query.toLowerCase())
      const matchCategory = category === 'Semua' || product.category === category
      return matchQuery && matchCategory
    })
    if (sort === 'harga-terendah') result = [...result].sort((a, b) => a.price - b.price)
    if (sort === 'harga-tertinggi') result = [...result].sort((a, b) => b.price - a.price)
    if (sort === 'terlaris') result = [...result].sort((a, b) => (metrics[b.id]?.sold ?? b.sold ?? 0) - (metrics[a.id]?.sold ?? a.sold ?? 0))
    return result
  }, [products, query, category, sort, metrics])

  return (
    <main className="mx-auto max-w-[1440px] px-4 pb-8 pt-5 xl:px-6">
      <section className="buyer-hero relative mb-7 overflow-hidden rounded-[28px] border border-[var(--line)] bg-[var(--surface)] shadow-soft lg:grid lg:grid-cols-[1.15fr_.85fr]">
        <div className="relative z-10 flex min-h-[330px] flex-col justify-center p-7 sm:p-9 lg:p-11">
          <h1 className="max-w-3xl text-[46px] font-bold leading-[1.02] tracking-[-0.025em] sm:text-[58px] lg:text-[66px]">
            Jual Barang<br />
            <span className="text-brand">Termurah</span><br />
            Se-Indonesia
          </h1>
          <div className="mt-6">
            <Button onClick={() => document.getElementById('produk')?.scrollIntoView({ behavior: 'smooth' })} className="h-12 rounded-xl px-5">
              Mulai Belanja
            </Button>
          </div>
        </div>

        <div className="relative z-10 grid content-center gap-3 p-6 pt-0 sm:grid-cols-3 lg:grid-cols-1 lg:p-8">
          {[[Truck, 'Ongkir Otomatis'], [Ticket, 'Voucher Aktif'], [ShieldCheck, 'Pembayaran Aman']].map(([Icon, title]) => (
            <div key={title as string} className="hero-benefit flex items-center gap-4 rounded-2xl border border-[var(--line)] bg-[var(--surface-2)]/85 p-4 backdrop-blur">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand"><Icon size={22} /></span>
              <b className="text-sm sm:text-base">{title as string}</b>
            </div>
          ))}
        </div>
      </section>

      <section id="produk">
        <div className="mb-4 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold tracking-[-0.02em] sm:text-3xl">Semua Produk</h2>
              <span className="hidden h-1.5 w-1.5 rounded-full bg-brand sm:block" />
              <p className="hidden text-sm text-[var(--muted)] sm:block">{filtered.length} produk tersedia</p>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-[minmax(240px,320px)_150px]">
            <label className="flex h-11 items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 transition focus-within:border-brand/60">
              <Search size={17} className="text-[var(--muted)]" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari produk..." className="h-full flex-1 bg-transparent text-sm outline-none" />
            </label>
            <select value={sort} onChange={(event) => setSort(event.target.value)} className="h-11 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-sm font-semibold outline-none">
              <option value="terbaru">Terbaru</option>
              <option value="terlaris">Terlaris</option>
              <option value="harga-terendah">Harga Terendah</option>
              <option value="harga-tertinggi">Harga Tertinggi</option>
            </select>
          </div>
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          {categories.map((item) => (
            <button key={item} onClick={() => setCategory(item)} className={`rounded-full border px-3.5 py-2 text-sm font-semibold transition ${category === item ? 'border-brand bg-brand text-white' : 'border-[var(--line)] bg-[var(--surface)] text-[var(--text)] hover:border-brand/40'}`}>
              {item}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 10 }).map((_, index) => <div key={index} className="h-[390px] animate-pulse rounded-2xl bg-[var(--surface)]" />)}
          </div>
        ) : filtered.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            {filtered.map((product) => <ProductCard key={product.id} product={product} metrics={metrics[product.id]} />)}
          </div>
        ) : <EmptyState title="Produk belum tersedia" description="Produk akan muncul setelah seller menambahkannya." />}
      </section>

    </main>
  )
}
