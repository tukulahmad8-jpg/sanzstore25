import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ShoppingBag, Trash2 } from 'lucide-react'
import { Button } from '@/components/common/Button'
import { Card } from '@/components/common/Card'
import { cartItemKey, getCartLineStock, useCartStore } from '@/stores/cart.store'
import { getProductsByIdsStrict } from '@/services/products.service'
import { formatCurrency } from '@/utils/format'
import { confirmAction } from '@/lib/notify'

export function CartPage() {
  const navigate = useNavigate()
  const items = useCartStore((state) => state.items)
  const increase = useCartStore((state) => state.increase)
  const decrease = useCartStore((state) => state.decrease)
  const updateNote = useCartStore((state) => state.updateNote)
  const toggleSelect = useCartStore((state) => state.toggleSelect)
  const selectAll = useCartStore((state) => state.selectAll)
  const unselectAll = useCartStore((state) => state.unselectAll)
  const remove = useCartStore((state) => state.remove)
  const removeSelected = useCartStore((state) => state.removeSelected)
  const clear = useCartStore((state) => state.clear)
  const syncProducts = useCartStore((state) => state.syncProducts)
  const [stockChecking, setStockChecking] = useState(true)
  const [stockError, setStockError] = useState('')

  const refreshStock = useCallback(async () => {
    const ids = useCartStore.getState().items.map((item) => item.product.id).filter(Boolean)
    if (!ids.length) { setStockChecking(false); return }
    setStockChecking(true)
    try {
      const result = await getProductsByIdsStrict(ids)
      syncProducts(result.data)
      setStockError('')
    } catch (error) {
      setStockError(error instanceof Error ? error.message : 'Stok terbaru gagal diperiksa.')
    } finally {
      setStockChecking(false)
    }
  }, [syncProducts])

  useEffect(() => {
    void refreshStock()
    const onFocus = () => void refreshStock()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refreshStock])

  const validItems = items.filter((item) => item?.product?.id && typeof item.product.price === 'number' && item.qty > 0)
  const availableItems = validItems.filter((item) => getCartLineStock(item.product) > 0 && String(item.product.status || '').toLowerCase() === 'aktif')
  const selectedItems = availableItems.filter((item) => item.selected && item.qty <= getCartLineStock(item.product))
  const subtotal = selectedItems.reduce((sum, item) => sum + item.product.price * item.qty, 0)
  const allSelected = availableItems.length > 0 && selectedItems.length === availableItems.length

  if (!validItems.length) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12">
        <Card className="text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand/10 text-brand"><ShoppingBag /></div>
          <h1 className="mt-4 text-3xl font-semibold">Keranjang kosong</h1>
          <p className="mt-2 text-[var(--muted)]">Tambahkan produk terlebih dahulu sebelum checkout.</p>
          <Link to="/" className="mt-5 inline-block"><Button>Belanja Sekarang</Button></Link>
        </Card>
      </main>
    )
  }

  return (
    <main className="cart-polish mx-auto max-w-[1320px] px-4 py-7 xl:px-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link to="/" className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-[var(--muted)] hover:text-brand"><ArrowLeft size={16}/> Lanjut belanja</Link>
          <h1 className="text-3xl font-semibold">Keranjang Belanja</h1>
        </div>
      </div>

      <div className="grid gap-5">
        {stockError ? <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-500">{stockError} Checkout dinonaktifkan sampai stok berhasil diverifikasi.</div> : null}
        <section className="overflow-hidden rounded-[22px] border border-[var(--line)] bg-[var(--surface)] shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
            <label className="inline-flex items-center gap-3 font-semibold">
              <input type="checkbox" checked={allSelected} onChange={allSelected ? unselectAll : selectAll} className="h-5 w-5 accent-brand" />
              Pilih semua
            </label>
            <div className="flex items-center gap-2 text-sm">
              <button type="button" onClick={async () => (await confirmAction('Hapus produk yang dipilih?', { confirmText: 'Hapus', danger: true })) && removeSelected()} disabled={!selectedItems.length} className="rounded-lg px-3 py-2 font-semibold text-red-500 hover:bg-red-500/10 disabled:opacity-40">Hapus dipilih</button>
              <button type="button" onClick={async () => (await confirmAction('Hapus semua isi keranjang?', { confirmText: 'Kosongkan', danger: true })) && clear()} className="rounded-lg px-3 py-2 font-semibold text-[var(--muted)] hover:bg-[var(--surface-2)]">Kosongkan</button>
            </div>
          </div>

          <div className="divide-y divide-[var(--line)]">
            {validItems.map((item) => {
              const lineKey = cartItemKey(item)
              const lineStock = getCartLineStock(item.product)
              const soldOut = lineStock <= 0
              return (
                <article key={lineKey} className={`cart-product-row p-5 ${item.selected && !soldOut ? 'is-selected' : ''}`}>
                  <div className="grid gap-4 sm:grid-cols-[24px_96px_minmax(0,1fr)_auto] sm:items-start">
                    <input type="checkbox" checked={Boolean(item.selected) && !soldOut} disabled={soldOut} onChange={() => toggleSelect(lineKey)} className="mt-2 h-5 w-5 accent-brand" />
                    <Link to={`/product/${item.product.id}`} className="grid h-24 w-24 place-items-center overflow-hidden rounded-xl bg-[var(--surface-2)] ring-1 ring-[var(--line)]">
                      <img src={item.product.image || item.product.images?.[0] || '/placeholder.svg'} alt={item.product.title} className="h-full w-full object-contain" />
                    </Link>
                    <div className="min-w-0">
                      <Link to={`/product/${item.product.id}`} className="line-clamp-2 font-semibold leading-6 hover:text-brand">{item.product.title}</Link>
                      <p className="mt-1 text-lg font-semibold text-brand">{formatCurrency(item.product.price)}</p>
                      {item.product.selected_variant ? <div className="mt-2 inline-flex rounded-lg border border-brand/20 bg-brand/5 px-2.5 py-1 text-xs font-semibold text-brand">Varian: {item.product.selected_variant.name}</div> : null}
                      {soldOut ? <p className="mt-1 text-sm font-semibold text-red-500">Stok habis — tidak dapat di-checkout</p> : <p className="mt-1 text-xs text-[var(--muted)]">Stok tersedia: {lineStock}</p>}

                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <div className="qty-control inline-flex items-center rounded-xl border border-[var(--line)] bg-[var(--surface-2)]">
                          <button type="button" onClick={() => decrease(lineKey)} className="grid h-9 w-9 place-items-center text-lg">−</button>
                          <b className="min-w-10 text-center text-sm">{item.qty}</b>
                          <button type="button" disabled={soldOut || item.qty >= lineStock} onClick={() => increase(lineKey)} className="grid h-9 w-9 place-items-center text-lg disabled:opacity-30">+</button>
                        </div>
                        <input value={item.note ?? ''} onChange={(event) => updateNote(lineKey, event.target.value)} placeholder="Catatan untuk seller (opsional)" className="h-10 min-w-[220px] flex-1 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 text-sm outline-none focus:border-brand" />
                      </div>
                    </div>
                    <div className="flex min-w-[150px] flex-col items-end gap-3">
                      <strong className="text-lg">{formatCurrency(item.product.price * item.qty)}</strong>
                      <button type="button" onClick={async () => (await confirmAction('Hapus produk ini dari keranjang?', { confirmText: 'Hapus', danger: true })) && remove(lineKey)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-500 hover:underline"><Trash2 size={15}/> Hapus</button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        <aside className="w-full">
          <Card className="cart-summary-card rounded-[22px]">
            <div className="cart-summary-head">
              <div>
                <p className="cart-summary-eyebrow">RINGKASAN</p>
                <h2 className="text-xl font-semibold">Ringkasan Belanja</h2>
              </div>
              <div className="cart-summary-count"><span>Produk dipilih</span><b>{selectedItems.length}</b></div>
            </div>
            <div className="cart-summary-main">
              <div className="cart-summary-total">
                <span>Subtotal</span>
                <b>{formatCurrency(subtotal)}</b>
              </div>
              <Button className="cart-summary-cta h-12" disabled={stockChecking || Boolean(stockError) || !selectedItems.length} onClick={() => navigate('/checkout')}>{stockChecking ? 'Cek stok...' : 'Checkout'}</Button>
            </div>
            {!selectedItems.length ? <p className="mt-3 text-center text-xs text-[var(--muted)]">Pilih minimal satu produk untuk checkout.</p> : null}
          </Card>
        </aside>
      </div>
    </main>
  )
}
