import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Heart, Share2, ShoppingCart, Star, X } from 'lucide-react'
import { getProductById, getProducts } from '@/services/products.service'
import { Button } from '@/components/common/Button'
import { useCartStore } from '@/stores/cart.store'
import { useWishlistStore } from '@/stores/wishlist.store'
import { useNotificationStore } from '@/stores/notification.store'
import { formatCurrency } from '@/utils/format'
import { ProductCard } from '../components/ProductCard'

type ProductTab = 'description' | 'specs' | 'reviews' | 'shipping'

export function ProductPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data } = useQuery({
    queryKey: ['products'],
    queryFn: getProducts,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })
  const { data: productData, isLoading: productLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => getProductById(id || ''),
    enabled: Boolean(id),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })
  const products = data?.data ?? []
  const product = productData?.data ?? products.find((item) => item.id === id)
  const addItem = useCartStore((state) => state.addItem)
  const buyNowCart = useCartStore((state) => state.buyNow)
  const addWish = useWishlistStore((state) => state.add)
  const removeWish = useWishlistStore((state) => state.remove)
  const wishlistIds = useWishlistStore((state) => state.ids)
  const notify = useNotificationStore((state) => state.show)
  const [imageIndex, setImageIndex] = useState(0)
  const [qty, setQty] = useState(1)
  const [descriptionExpanded, setDescriptionExpanded] = useState(false)
  const [activeTab, setActiveTab] = useState<ProductTab>('description')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [selectedVariantId, setSelectedVariantId] = useState('')
  const images = useMemo(() => product?.images?.length ? product.images : [product?.image ?? '/placeholder.svg'], [product])
  const related = products.filter((item) => item.id !== product?.id && item.category === product?.category).slice(0, 4)

  if (productLoading && !product) return <main className="mx-auto max-w-7xl px-4 py-8">Memuat produk...</main>
  if (!product) return <main className="mx-auto max-w-7xl px-4 py-8">Produk tidak ditemukan.</main>
  const currentProduct = product
  const variants = product.has_variants ? (product.variants ?? []).filter((variant) => variant?.id) : []
  const selectedVariant = variants.find((variant) => variant.id === selectedVariantId)
  const requiresVariant = variants.length > 0
  const selectedVariantPrice = selectedVariant && Number(selectedVariant.price || 0) > 0 ? Number(selectedVariant.price) : Number(product.price || 0)
  const activePrice = selectedVariant ? selectedVariantPrice : Number(product.price || 0)
  const activeStock = selectedVariant?.stock ?? product.stock
  const activeWeight = selectedVariant?.weight ?? product.weight
  const soldOut = activeStock <= 0
  const wished = wishlistIds.includes(product.id)

  function addToCart() {
    if (soldOut || (requiresVariant && !selectedVariant)) {
      if (requiresVariant && !selectedVariant) notify('Pilih varian produk dulu')
      return
    }
    const cartProduct = selectedVariant ? { ...currentProduct, price: selectedVariantPrice, stock: selectedVariant.stock, weight: selectedVariant.weight ?? currentProduct.weight, selected_variant: { ...selectedVariant, price: selectedVariantPrice } } : currentProduct
    addItem(cartProduct, qty)
    notify('Produk masuk keranjang')
  }

  function buyNow() {
    if (soldOut || (requiresVariant && !selectedVariant)) {
      if (requiresVariant && !selectedVariant) notify('Pilih varian produk dulu')
      return
    }
    const cartProduct = selectedVariant ? { ...currentProduct, price: selectedVariantPrice, stock: selectedVariant.stock, weight: selectedVariant.weight ?? currentProduct.weight, selected_variant: { ...selectedVariant, price: selectedVariantPrice } } : currentProduct
    buyNowCart(cartProduct, qty)
    navigate('/checkout')
  }

  function changePreview(step: number) {
    if (images.length <= 1) return
    setImageIndex((current) => (current + step + images.length) % images.length)
  }

  function handleWishlist() {
    if (wished) {
      removeWish(currentProduct.id)
      notify('Produk dihapus dari wishlist')
      return
    }

    addWish(currentProduct.id)
    notify('Produk disimpan ke wishlist')
  }

  async function handleShare() {
    try {
      await navigator.clipboard?.writeText(window.location.href)
      notify('Link produk disalin')
    } catch {
      notify('Gagal menyalin link produk')
    }
  }

  return (
    <main className="mx-auto max-w-[1320px] px-4 py-7 xl:px-6">
      <nav className="mb-5 flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
        <Link to="/" className="hover:text-brand">Beranda</Link><span>/</span>
        <Link to="/" className="hover:text-brand">{product.category}</Link><span>/</span>
        <span className="max-w-[520px] truncate text-[var(--text)]">{product.title}</span>
      </nav>

      <section className="overflow-hidden rounded-[22px] border border-[var(--line)] bg-[var(--surface)] shadow-soft">
        <div className="grid items-start lg:grid-cols-[minmax(420px,560px)_minmax(0,1fr)]">
          <div className="border-b border-[var(--line)] p-5 lg:border-b-0 lg:border-r sm:p-6">
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="group relative flex w-full items-center justify-center overflow-hidden rounded-2xl bg-[var(--surface-2)] p-2 text-left"
              aria-label="Perbesar foto produk"
            >
              <img src={images[imageIndex]} alt={product.title} className="block h-auto max-h-[520px] w-auto max-w-full object-contain transition duration-200 group-hover:scale-[1.01]" />
              <span className="pointer-events-none absolute bottom-3 right-3 rounded-lg bg-black/55 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 backdrop-blur transition group-hover:opacity-100">Klik untuk memperbesar</span>
            </button>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {images.map((image, index) => (
                <button
                  type="button"
                  key={`${image}-${index}`}
                  onClick={() => setImageIndex(index)}
                  className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border bg-[var(--surface-2)] transition ${index === imageIndex ? 'border-brand ring-1 ring-brand' : 'border-[var(--line)] hover:border-brand/50'}`}
                >
                  <img src={image} alt={`Foto ${index + 1}`} className="h-full w-full object-contain" />
                </button>
              ))}
            </div>
          </div>

          <div className="p-5 sm:p-7 lg:p-8">
            <span className="inline-flex rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">{product.category}</span>
            <h1 className="mt-3 text-[28px] font-semibold leading-[1.2] tracking-[-0.018em] sm:text-[34px]">{product.title}</h1>

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--line)] pb-4 text-sm text-[var(--muted)]">
              <span className="inline-flex items-center gap-1 text-amber-500"><Star size={16} fill="currentColor" /> 5.0</span>
              <span>Terjual {product.sold}</span>
              <span>Stok {activeStock}</span>
              <span>Berat {activeWeight}g</span>
            </div>

            <strong className="mt-6 block text-[34px] font-semibold text-brand sm:text-[40px]">{formatCurrency(activePrice)}</strong>

            {soldOut ? <div className="mt-4 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 font-semibold text-red-500">Stok Habis</div> : null}

            {requiresVariant ? (
              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between gap-3"><span className="font-semibold">Pilih Varian</span>{selectedVariant ? <span className="text-xs text-[var(--muted)]">Stok {selectedVariant.stock}</span> : <span className="text-xs font-semibold text-brand">Wajib dipilih</span>}</div>
                <div className="flex flex-wrap gap-2">
                  {variants.map((variant) => { const active = variant.id === selectedVariantId; const disabled = variant.stock <= 0; return (
                    <button key={variant.id} type="button" disabled={disabled} onClick={() => { setSelectedVariantId(variant.id); setQty(1) }} className={`variant-choice ${active ? 'is-selected' : ''} ${disabled ? 'is-disabled' : ''}`}>
                      <span>{variant.name}</span><small>{disabled ? 'Habis' : formatCurrency(Number(variant.price || 0) > 0 ? Number(variant.price) : Number(product.price || 0))}</small>
                    </button>
                  )})}
                </div>
              </div>
            ) : null}

            <div className="mt-6 flex items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-4 py-3">
              <span className="font-semibold">Jumlah</span>
              <div className="flex items-center gap-3">
                <button type="button" disabled={soldOut} onClick={() => setQty((v) => Math.max(1, v - 1))} className="h-9 w-9 rounded-lg border border-[var(--line)] transition hover:border-brand disabled:opacity-40">−</button>
                <b className="min-w-5 text-center">{qty}</b>
                <button type="button" disabled={soldOut || qty >= activeStock} onClick={() => setQty((v) => Math.min(activeStock, v + 1))} className="h-9 w-9 rounded-lg border border-[var(--line)] transition hover:border-brand disabled:opacity-40">+</button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Button variant="outline" disabled={soldOut || (requiresVariant && !selectedVariant)} onClick={addToCart} className="h-12"><ShoppingCart size={18}/> Keranjang</Button>
              <Button disabled={soldOut || (requiresVariant && !selectedVariant)} onClick={buyNow} className="h-12">{soldOut ? 'Stok Habis' : 'Beli Sekarang'}</Button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[var(--line)] pt-3">
              <button type="button" onClick={handleWishlist} aria-pressed={wished}
                className={`relative z-10 inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl font-semibold transition hover:bg-brand/10 ${wished ? 'text-brand' : 'text-[var(--text)]'}`}>
                <Heart size={18} fill={wished ? 'currentColor' : 'none'} /> {wished ? 'Tersimpan' : 'Wishlist'}
              </button>
              <button type="button" onClick={handleShare} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl font-semibold transition hover:bg-[var(--surface-2)]">
                <Share2 size={18}/> Bagikan
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-[var(--line)]">
          <div>
            <article className="p-5 sm:p-7">
              <div className="flex gap-1 overflow-x-auto border-b border-[var(--line)]">
                {[
                  ['description', 'Deskripsi'],
                  ['specs', 'Spesifikasi'],
                  ['reviews', 'Ulasan'],
                  ['shipping', 'Pengiriman & Pengembalian'],
                ].map(([key, label]) => (
                  <button
                    type="button"
                    key={key}
                    onClick={() => setActiveTab(key as ProductTab)}
                    className={`shrink-0 border-b-2 px-4 py-3 text-sm font-semibold transition ${activeTab === key ? 'border-brand text-brand' : 'border-transparent text-[var(--muted)] hover:text-[var(--text)]'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {activeTab === 'description' ? (
                <div className="pt-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Informasi Produk</p>
                  <h2 className="mt-1 text-xl font-semibold sm:text-2xl">Deskripsi Produk</h2>
                  <div className={`relative mt-5 overflow-hidden ${descriptionExpanded ? '' : 'max-h-[280px]'}`}>
                    <div className="whitespace-pre-line text-[15px] leading-7 text-[var(--muted)]">{product.summary || 'Belum ada deskripsi produk.'}</div>
                    {!descriptionExpanded && product.summary && product.summary.length > 650 ? <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[var(--surface)] to-transparent" /> : null}
                  </div>
                  {product.summary && product.summary.length > 650 ? (
                    <button type="button" onClick={() => setDescriptionExpanded((value) => !value)} className="mt-4 text-sm font-semibold text-brand hover:underline">
                      {descriptionExpanded ? 'Tampilkan lebih sedikit' : 'Lihat deskripsi selengkapnya'}
                    </button>
                  ) : null}
                </div>
              ) : null}

              {activeTab === 'specs' ? (
                <div className="pt-5">
                  <h2 className="text-xl font-semibold">Spesifikasi</h2>
                  <dl className="mt-4 divide-y divide-[var(--line)] rounded-xl border border-[var(--line)]">
                    {[
                      ['Kategori', product.category],
                      ['Kondisi', 'Baru'],
                      ['Berat', `${product.weight}g`],
                      ['Stok', String(activeStock)],
                      ['Terjual', String(product.sold)],
                      ...(requiresVariant ? [['Varian', variants.map((variant) => variant.name + ' (' + variant.stock + ')').join(', ')]] : []),
                    ].map(([label, value]) => <div key={label} className="grid grid-cols-[140px_1fr] gap-4 px-4 py-3 text-sm"><dt className="text-[var(--muted)]">{label}</dt><dd className="font-medium">{value}</dd></div>)}
                  </dl>
                </div>
              ) : null}

              {activeTab === 'reviews' ? (
                <div className="pt-5">
                  <h2 className="text-xl font-semibold">Ulasan Produk</h2>
                  <div className="mt-4 rounded-xl border border-dashed border-[var(--line)] p-8 text-center text-sm text-[var(--muted)]">Belum ada ulasan untuk produk ini.</div>
                </div>
              ) : null}

              {activeTab === 'shipping' ? (
                <div className="pt-5">
                  <h2 className="text-xl font-semibold">Pengiriman & Pengembalian</h2>
                  <div className="mt-4 grid gap-3 text-sm leading-6 text-[var(--muted)]">
                    <p><b className="text-[var(--text)]">Pilihan kurir:</b> tersedia dan dihitung otomatis saat checkout berdasarkan alamat tujuan.</p>
                    <p><b className="text-[var(--text)]">Estimasi:</b> mengikuti layanan kurir yang dipilih.</p>
                    <p><b className="text-[var(--text)]">Pengembalian:</b> hubungi toko apabila barang yang diterima tidak sesuai atau mengalami kendala.</p>
                  </div>
                </div>
              ) : null}
            </article>

            <div className="grid gap-3 border-t border-[var(--line)] px-5 py-5 sm:grid-cols-3 sm:px-7">
              <div className="rounded-xl bg-[var(--surface-2)] px-4 py-3">
                <b className="text-sm">100% Original</b>
              </div>
              <div className="rounded-xl bg-[var(--surface-2)] px-4 py-3">
                <b className="text-sm">Pengiriman Aman</b>
              </div>
              <div className="rounded-xl bg-[var(--surface-2)] px-4 py-3">
                <b className="text-sm">Pembayaran Aman</b>
              </div>
            </div>
          </div>
        </div>
      </section>

      {related.length ? (
        <section className="mt-8">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-2xl font-semibold">Produk Terkait</h2>
            <Link to="/" className="text-sm font-semibold text-brand hover:underline">Lihat Semua</Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{related.map((item) => <ProductCard key={item.id} product={item} />)}</div>
        </section>
      ) : null}

      {previewOpen ? (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/75 p-4 backdrop-blur-sm" onClick={() => setPreviewOpen(false)}>
          <div className="relative max-h-[92vh] w-full max-w-5xl rounded-2xl bg-[var(--surface)] p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <button type="button" onClick={() => setPreviewOpen(false)} className="absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-full bg-black/60 text-white"><X size={20}/></button>
            <div className="relative grid max-h-[82vh] place-items-center overflow-hidden rounded-xl bg-[var(--surface-2)]">
              <img src={images[imageIndex]} alt={product.title} className="max-h-[82vh] w-full object-contain" />
              {images.length > 1 ? <>
                <button type="button" onClick={() => changePreview(-1)} className="absolute left-4 grid h-11 w-11 place-items-center rounded-full bg-black/55 text-white"><ChevronLeft/></button>
                <button type="button" onClick={() => changePreview(1)} className="absolute right-4 grid h-11 w-11 place-items-center rounded-full bg-black/55 text-white"><ChevronRight/></button>
              </> : null}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
