import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from '@/lib/notify'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, MapPin, PackageCheck, ShieldCheck, TicketPercent, Truck } from 'lucide-react'
import { Button } from '@/components/common/Button'
import { Card } from '@/components/common/Card'
import { Input } from '@/components/common/Input'
import { getCartLineStock, reconcileCartItems, useCartStore } from '@/stores/cart.store'
import { getProductsByIdsStrict } from '@/services/products.service'
import { createOrder } from '@/services/orders.service'
import { applyVoucher, getVouchers, voucherError, type Voucher } from '@/services/vouchers.service'
import { formatShippingLabel, getShippingRates, type ShippingRate } from '@/services/shipping.service'
import { getAddresses, type BuyerAddress } from '@/services/address.service'
import { formatCurrency } from '@/utils/format'
import { useAuthStore } from '@/stores/auth.store'
import { AuthDropdown } from '@/components/auth/AuthDropdown'

function addressLine(address: BuyerAddress) {
  return [
    address.address,
    address.landmark,
    address.village ? `Kel. ${address.village}` : '',
    address.district ? `Kec. ${address.district}` : '',
    address.city,
    address.province,
    address.postalCode,
  ].filter(Boolean).join(', ')
}

export function CheckoutPage() {
  const userId = useAuthStore((state) => state.user?.id)
  return <CheckoutContent key={userId ?? 'guest'} />
}

function CheckoutContent() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const items = useCartStore((state) => state.items)
  const clear = useCartStore((state) => state.clear)
  const syncProducts = useCartStore((state) => state.syncProducts)
  const [inventoryChecking, setInventoryChecking] = useState(true)
  const [inventoryError, setInventoryError] = useState('')

  const validItems = useMemo(() => items.filter((item) =>
    item?.product?.id
    && typeof item.product.price === 'number'
    && item.qty > 0
    && item.selected
    && String(item.product.status || '').toLowerCase() === 'aktif'
    && getCartLineStock(item.product) > 0
    && item.qty <= getCartLineStock(item.product)
  ), [items])

  const subtotal = validItems.reduce((sum, item) => sum + item.product.price * item.qty, 0)
  const totalWeight = validItems.reduce((sum, item) => sum + (item.product.weight || 1000) * item.qty, 0)

  const [addresses, setAddresses] = useState<BuyerAddress[]>([])
  const [addressLoadError, setAddressLoadError] = useState('')
  const [addressesLoading, setAddressesLoading] = useState(true)
  const [selectedAddressId, setSelectedAddressId] = useState('')
  const selectedAddress = addresses.find((item) => item.id === selectedAddressId) ?? addresses.find((item) => item.isMain) ?? addresses[0]

  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [voucherCode, setVoucherCode] = useState('')
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null)
  const [rates, setRates] = useState<ShippingRate[]>([])
  const [rateSelection, setRateSelection] = useState<{ key: string; rate: ShippingRate } | null>(null)
  const shippingRequestKey = JSON.stringify({
    destinationPostalCode: selectedAddress?.postalCode || '',
    items: validItems,
  })
  const selectedRate = rateSelection?.key === shippingRequestKey ? rateSelection.rate : null
  const setSelectedRate = (rate: ShippingRate | null) => setRateSelection(rate ? { key: shippingRequestKey, rate } : null)
  const [shippingLoading, setShippingLoading] = useState(false)
  const [shippingError, setShippingError] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const submitBusy = useRef(false)
  const [voucherMessage, setVoucherMessage] = useState('')
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    async function refreshInventory() {
      const currentItems = useCartStore.getState().items
      const ids = currentItems.map((item) => item.product.id).filter(Boolean)
      if (!ids.length) { setInventoryChecking(false); return }
      setInventoryChecking(true)
      try {
        const result = await getProductsByIdsStrict(ids)
        syncProducts(result.data)
        setInventoryError('')
      } catch (error) {
        setInventoryError(error instanceof Error ? error.message : 'Stok terbaru gagal diperiksa.')
      } finally {
        setInventoryChecking(false)
      }
    }

    void refreshInventory()
    const onFocus = () => void refreshInventory()
    window.addEventListener('focus', onFocus)

    getVouchers().then((result) => setVouchers(result.data))
    getAddresses().then((result) => {
      setAddresses(result.data)
      const main = result.data.find((item) => item.isMain) ?? result.data[0]
      if (main) setSelectedAddressId(main.id)
    }).catch((error) => setAddressLoadError(error.message)).finally(() => setAddressesLoading(false))

    return () => window.removeEventListener('focus', onFocus)
  }, [syncProducts])

  useEffect(() => {
    let cancelled = false
    const request = JSON.parse(shippingRequestKey) as Parameters<typeof getShippingRates>[0]
    setRates([])
    setRateSelection(null)
    setShippingError('')
    if (!request.destinationPostalCode || !request.items?.length) {
      setShippingLoading(false)
      return
    }
    setShippingLoading(true)
    async function run() {
      try {
        const result = await getShippingRates(request)
        if (cancelled) return
        setRates(result)
        setRateSelection(result[0] ? { key: shippingRequestKey, rate: result[0] } : null)
      } catch (error) {
        if (cancelled) return
        setRates([])
        setRateSelection(null)
        console.error('Shipping rate error:', error)
        setShippingError('Opsi pengiriman belum tersedia. Coba lagi.')
      } finally {
        if (!cancelled) setShippingLoading(false)
      }
    }
    const timeout = window.setTimeout(run, 500)
    return () => { cancelled = true; window.clearTimeout(timeout) }
  }, [shippingRequestKey])

  const shippingCost = selectedRate?.cost ?? 0
  const freeShippingDiscount = subtotal >= 100000 ? Math.min(shippingCost, 10000) : 0
  const voucher = useMemo(() => vouchers.find((item) => item.code.toUpperCase() === voucherCode.toUpperCase()), [vouchers, voucherCode])
  const voucherDiscount = applyVoucher(selectedVoucher, subtotal, shippingCost)
  const discount = voucherDiscount + freeShippingDiscount
  const total = Math.max(0, subtotal + shippingCost - discount)

  if (!user) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <Card className="text-center">
          <h1 className="text-3xl font-bold">Masuk untuk Checkout</h1>
          <p className="mt-2 text-[var(--muted)]">Keranjang tetap aman. Silakan login atau daftar dulu.</p>
          <div className="mt-5 inline-flex"><AuthDropdown /></div>
        </Card>
      </main>
    )
  }

  if (!validItems.length) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <Card className="text-center">
          <h1 className="text-3xl font-bold">Keranjang kosong</h1>
          <p className="mt-2 text-[var(--muted)]">Tambahkan produk terlebih dahulu sebelum checkout.</p>
          <Button className="mt-5" onClick={() => navigate('/')}>Belanja Sekarang</Button>
        </Card>
      </main>
    )
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (submitBusy.current) return
    const buyer = user
    if (!buyer) {
      toast('Silakan login kembali sebelum checkout.', 'error')
      return
    }
    if (!selectedAddress) {
      toast('Tambahkan alamat pengiriman dulu.', 'error')
      return
    }
    if (!selectedAddress.postalCode) {
      toast('Alamat belum punya kode pos. Klik Ubah lalu isi kode pos.', 'error')
      return
    }
    if (shippingLoading || !selectedRate) {
      toast('Pilih opsi pengiriman dulu.', 'error')
      return
    }

    submitBusy.current = true
    setSubmitting(true)
    setSubmitError('')

    let checkoutItems = validItems
    try {
      const currentItems = useCartStore.getState().items.filter((item) => item.selected)
      const result = await getProductsByIdsStrict(currentItems.map((item) => item.product.id))
      const reconciled = reconcileCartItems(currentItems, result.data)
      syncProducts(result.data)

      const unavailable = reconciled.filter((item) =>
        !item.selected
        || String(item.product.status || '').toLowerCase() !== 'aktif'
        || getCartLineStock(item.product) <= 0
        || item.qty > getCartLineStock(item.product)
      )
      if (unavailable.length) {
        setSubmitError('Stok keranjang berubah. Produk yang habis atau qty yang melebihi stok sudah diperbarui. Silakan cek keranjang kembali.')
        setSubmitting(false)
        submitBusy.current = false
        return
      }
      checkoutItems = reconciled
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Stok terbaru gagal diverifikasi. Coba lagi.')
      setSubmitting(false)
      submitBusy.current = false
      return
    }

    const verifiedSubtotal = checkoutItems.reduce((sum, item) => sum + item.product.price * item.qty, 0)
    const orderId = `INV-${Date.now()}`
    const paymentExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    const orderPayload = {
      id: orderId,
      user_id: buyer.id,
      buyer_id: buyer.id,
      buyer_email: buyer.email || '',
      buyer_phone: selectedAddress.phone || buyer.phone || '',
      seller_id: 'sanzstore25',
      payment_status: 'pending',
      payment_expires_at: paymentExpiresAt,
      shipment_status: 'pending',
      customer: {
        name: selectedAddress.recipient,
        phone: selectedAddress.phone,
        province: selectedAddress.province,
        cityName: selectedAddress.city,
        city: selectedAddress.city,
        district: selectedAddress.district,
        village: selectedAddress.village,
        postalCode: selectedAddress.postalCode,
        address: selectedAddress.address,
        landmark: selectedAddress.landmark,
        email: user?.email || '',
      },
      items: checkoutItems,
      subtotal: verifiedSubtotal,
      shipping_cost: shippingCost,
      discount,
      total,
      status: 'Belum Bayar' as const,
      payment: {
        provider: 'pakasir',
        status: 'pending',
      },
      shipping: { ...selectedRate },
      voucher: selectedVoucher ? { ...selectedVoucher } : {},
      resi: '',
      notes: note,
    }

    try {
      const created = await createOrder(orderPayload as any)
      localStorage.setItem('ss25_buyer_phone', selectedAddress.phone || '')
      localStorage.setItem('ss25_buyer_id', buyer.id)
      localStorage.setItem('ss25_checkout_customer', JSON.stringify(orderPayload.customer))
      clear()
      const serverTotal = Number(created.data?.total ?? total)
      navigate(`/payment/${orderId}?amount=${serverTotal}&name=${encodeURIComponent(selectedAddress.recipient)}&invoice=${orderId}`)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Pesanan gagal disimpan.')
      setSubmitting(false)
      submitBusy.current = false
    }
  }

  return (
    <main className="checkout-polish mx-auto max-w-[1320px] px-4 py-7 xl:px-6">
      <form onSubmit={handleSubmit}>
        {inventoryError ? <div className="mb-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 font-semibold text-amber-500">{inventoryError} Checkout dinonaktifkan sampai stok berhasil diverifikasi.</div> : null}
        {submitError ? <div className="mb-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 font-semibold text-red-500">{submitError}</div> : null}

        <div className="checkout-page-head mb-6">
          <Link to="/cart" className="checkout-back-link"><ArrowLeft size={15}/> <span>Kembali ke Keranjang</span></Link>
          <div className="checkout-title-row">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">Penyelesaian Pesanan</p>
              <h1 className="mt-1 text-3xl font-semibold">Checkout</h1>
            </div>
          </div>
        </div>

        <div className="grid gap-5">
          <div className="grid gap-5">
            <section className="overflow-hidden rounded-[22px] border border-[var(--line)] bg-[var(--surface)] shadow-soft">
              <div className="flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6">
                <div className="flex min-w-0 gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand"><MapPin size={20}/></div>
                  <div>
                    <h2 className="font-semibold">Alamat Pengiriman</h2>
                    {addressesLoading ? <p>Memuat alamat...</p> : addressLoadError ? <p role="alert" className="text-red-500">{addressLoadError} <button type="button" onClick={() => window.location.reload()}>Muat ulang</button></p> : selectedAddress ? <>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm"><b>{selectedAddress.recipient}</b><span className="text-[var(--muted)]">{selectedAddress.phone}</span>{selectedAddress.isMain ? <span className="rounded-md border border-brand/35 bg-brand/5 px-2 py-0.5 text-[11px] font-semibold text-brand">Utama</span> : null}</div>
                      <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--muted)]">{addressLine(selectedAddress)}</p>
                    </> : <p className="mt-2 text-sm text-[var(--muted)]">Belum ada alamat. Tambahkan alamat dulu.</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {addresses.length > 1 ? <select value={selectedAddress?.id ?? ''} onChange={(e)=>setSelectedAddressId(e.target.value)} className="h-10 max-w-[210px] rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 text-sm outline-none">{addresses.map((a)=><option key={a.id} value={a.id}>{a.label} - {a.recipient}</option>)}</select> : null}
                  <Link to="/account?tab=address" className="rounded-lg px-3 py-2 text-sm font-semibold text-brand hover:bg-brand/10">Ubah</Link>
                </div>
              </div>
            </section>

            <section className="overflow-hidden rounded-[22px] border border-[var(--line)] bg-[var(--surface)] shadow-soft">
              <div className="flex items-center gap-3 border-b border-[var(--line)] px-5 py-4 sm:px-6">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand/10 text-brand"><PackageCheck size={19}/></div>
                <div><h2 className="font-semibold">Produk Dipesan</h2><p className="text-xs text-[var(--muted)]">{validItems.length} produk dalam pesanan</p></div>
              </div>
              <div className="divide-y divide-[var(--line)]">{validItems.map((item)=><div key={item.product.id} className="grid gap-3 p-5 sm:grid-cols-[76px_minmax(0,1fr)_auto] sm:items-center sm:px-6">
                <div className="grid h-[76px] w-[76px] place-items-center overflow-hidden rounded-xl bg-[var(--surface-2)] ring-1 ring-[var(--line)]"><img src={item.product.image || item.product.images?.[0] || '/placeholder.svg'} alt={item.product.title} className="h-full w-full object-contain"/></div>
                <div className="min-w-0"><b className="line-clamp-2 text-sm leading-6">{item.product.title}</b>{item.product.selected_variant ? <p className="mt-1 text-xs font-semibold text-brand">Varian: {item.product.selected_variant.name}</p> : null}<p className="mt-1 text-xs text-[var(--muted)]">{item.qty} × {formatCurrency(item.product.price)}</p></div>
                <b className="text-sm">{formatCurrency(item.product.price*item.qty)}</b>
              </div>)}</div>
            </section>

            <section className="grid gap-5 lg:grid-cols-[1.25fr_.75fr]">
              <div className="rounded-[22px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-soft sm:p-6">
                <div className="mb-4 flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-brand/10 text-brand"><Truck size={19}/></div><div><h2 className="font-semibold">Opsi Pengiriman</h2></div></div>
                {!selectedAddress ? <p className="text-sm text-[var(--muted)]">Tambahkan alamat dulu.</p> : !selectedAddress.postalCode ? <p className="text-sm text-[var(--muted)]">Alamat belum punya kode pos.</p> : shippingLoading ? <p className="text-sm font-semibold text-brand">Menghitung ongkir...</p> : shippingError ? <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-500">{shippingError}</div> : rates.length ? <div className="grid gap-2">{rates.map((rate,index)=>{const active=selectedRate===rate;return <label key={`${rate.courier}-${rate.service}-${index}`} className={`shipping-option flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3.5 transition ${active?'is-selected':'border-[var(--line)]'}`}><span className="shipping-option-copy"><b className="text-sm">{formatShippingLabel(rate.courier,rate.service)}</b><p className="mt-0.5 text-xs text-[var(--muted)]">{rate.description} • {rate.etd}</p></span><span className="shipping-option-side"><b className="text-sm text-brand">{formatCurrency(rate.cost)}</b>{active?<span className="shipping-selected-badge">Dipilih</span>:null}</span><input type="radio" className="sr-only" checked={active} onChange={()=>setSelectedRate(rate)}/></label>})}</div> : <p className="text-sm text-[var(--muted)]">Ongkir belum tersedia untuk tujuan ini.</p>}
              </div>

              <div className="rounded-[22px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-soft sm:p-6">
                <label className="mb-2 block text-sm font-semibold">Pesan untuk seller</label>
                <textarea value={note} onChange={(e)=>setNote(e.target.value)} placeholder="Opsional, tinggalkan pesan untuk seller" className="min-h-[122px] w-full resize-none rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3 text-sm outline-none focus:border-brand"/>
              </div>
            </section>

            <section className="rounded-[22px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-soft sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-brand/10 text-brand"><TicketPercent size={19}/></div><div><h2 className="font-semibold">Voucher Toko</h2></div></div>
                <div className="flex w-full gap-2 sm:w-auto"><Input placeholder="Kode voucher" value={voucherCode} onChange={(e)=>setVoucherCode(e.target.value)}/><Button type="button" onClick={()=>{ const message = voucherError(voucher, subtotal); setVoucherMessage(message); setSelectedVoucher(message ? null : voucher ?? null) }}>Pakai</Button></div>
              </div>
              {voucherMessage ? <p role="alert" className="mt-3 text-sm text-red-500">{voucherMessage}</p> : null}
              {selectedVoucher && !voucherError(selectedVoucher, subtotal) ? <p className="mt-3 text-sm font-semibold text-emerald-600">Voucher {selectedVoucher.code} berhasil dipakai.</p> : null}
            </section>
          </div>

          <aside className="w-full">
            <section className="checkout-summary-card rounded-[22px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-soft sm:p-6">
              <div className="checkout-summary-head">
                <div>
                  <p className="checkout-summary-eyebrow">FINAL CHECKOUT</p>
                  <h2 className="text-xl font-semibold">Ringkasan Pembayaran</h2>
                </div>
                <span className="checkout-summary-items">{validItems.length} produk</span>
              </div>
              <div className="checkout-summary-grid">
                <div className="checkout-cost-list">
                  <div><span>Subtotal Produk</span><b>{formatCurrency(subtotal)}</b></div>
                  <div><span>Ongkir</span><b>{selectedRate ? formatCurrency(shippingCost) : 'Belum dihitung'}</b></div>
                  <div className="is-discount"><span>Potongan Ongkir</span><b>-{formatCurrency(freeShippingDiscount)}</b></div>
                  <div><span>{selectedVoucher?.type === 'shipping' ? 'Voucher Ongkir' : 'Voucher Belanja'}</span><b>-{formatCurrency(voucherDiscount)}</b></div>
                  {subtotal < 100000 ? <p className="checkout-shipping-hint">Belanja lagi {formatCurrency(100000-subtotal)} untuk gratis ongkir maks. Rp10.000.</p> : null}
                </div>
                <div className="checkout-final-box">
                  <div className="checkout-grand-total"><span>Total Pesanan</span><b>{formatCurrency(total)}</b></div>
                  <div className="checkout-safe-note"><ShieldCheck size={17} className="shrink-0 text-emerald-500"/><span>Pembayaran aman dan detail pesanan dapat dipantau dari akun Anda.</span></div>
                  <Button className="checkout-submit h-12 w-full" disabled={inventoryChecking || Boolean(inventoryError) || !selectedAddress || shippingLoading || !selectedRate || submitting}>{inventoryChecking ? 'Memeriksa stok...' : submitting ? 'Memproses...' : 'Buat Pesanan'}</Button>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </form>
    </main>
  )
}
