import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, Clipboard, Clock3, ExternalLink, Info, MapPin, PackageCheck, PackageSearch, Printer, Truck, Upload, WalletCards, X } from 'lucide-react'
import { Button } from '@/components/common/Button'
import { loadSellerOrderList } from '@/services/order-query.service'
import { cancelSellerOrder, completeSellerRefund, processSellerOrder } from '@/services/orders.service'
import { bulkRecoverBiteshipShipments, createBiteshipShipment, refreshBiteshipShipment } from '@/services/biteship-order.service'
import { formatShippingLabel } from '@/services/shipping.service'
import { getSellerSupabaseClient } from '@/lib/supabase'
import type { Order } from '@/types/domain'

function rupiah(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}


function normalizedOrderStatus(order: any) {
  return String(order?.status || '').trim().toLowerCase()
}

function refundData(order: any): Record<string, any> {
  const raw = order?.refund
  if (raw && typeof raw === 'object') return raw as Record<string, any>
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw)
      return parsed && typeof parsed === 'object' ? parsed as Record<string, any> : {}
    } catch {
      return {}
    }
  }
  return {}
}

function isRefundOrFinalOrder(order: any) {
  const status = normalizedOrderStatus(order)
  const refundStatus = String(refundData(order).status || '').trim().toLowerCase()
  return (
    ['refund', 'dibatalkan', 'selesai', 'cancelled', 'canceled'].includes(status) ||
    ['pending', 'completed', 'refunded'].includes(refundStatus) ||
    Boolean(order?.cancelled_at)
  )
}

function statusLabel(order: any) {
  const refundStatus = String(refundData(order).status || '').trim().toLowerCase()
  if (order.payment_status === 'cancelled' || normalizedOrderStatus(order) === 'dibatalkan') return 'Dibatalkan'
  if (normalizedOrderStatus(order) === 'selesai') return 'Selesai'
  if (normalizedOrderStatus(order) === 'refund' || ['pending', 'completed', 'refunded'].includes(refundStatus)) return 'Refund'
  if (order.status === 'Dikirim') return 'Dikirim'
  if (['Packing', 'Diproses', 'Dikemas'].includes(order.status)) return 'Diproses'
  if (order.payment_status === 'paid' || order.status === 'Dibayar') return 'Sudah Bayar'
  if (order.payment_status === 'expired' || normalizedOrderStatus(order) === 'kedaluwarsa') return 'Kedaluwarsa'
  return 'Menunggu Bayar'
}

function courierName(order: any) {
  return formatShippingLabel(
    order.shipping?.courier || order.shipping?.company || order.shipping?.courier_name,
    order.shipping?.service || order.shipping?.type || order.courier_service,
  )
}

function trackingUrl(courier: string) {
  const name = courier.toLowerCase()

  if (name.includes('jne')) return 'https://www.jne.co.id/tracking-package'
  if (name.includes('j&t') || name.includes('jnt')) return 'https://jet.co.id/track'
  if (name.includes('anteraja')) return 'https://anteraja.id/tracking'
  if (name.includes('sicepat')) return 'https://www.sicepat.com/'

  return 'https://www.google.com/search?q=cek+resi+pengiriman'
}

function customerAddress(order: any) {
  const customer = order.customer || {}

  return [
    customer.address,
    customer.landmark,
    customer.village,
    customer.district,
    customer.cityName || customer.city,
    customer.province,
    customer.postalCode,
  ].filter(Boolean).join(', ')
}

export function SellerOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false)
  const [refundConfirmOpen, setRefundConfirmOpen] = useState(false)
  const [refundReference, setRefundReference] = useState('')
  const [refundNote, setRefundNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info')
  const [statusFilter, setStatusFilter] = useState('Semua')
  const recoveryFileRef = useRef<HTMLInputElement | null>(null)

  async function refresh(silent = false) {
    if (!silent) setLoading(true)
    await loadSellerOrderList()
      .then((res) => {
        const next = (res.data || []) as Order[]
        setOrders(next)
        setSelectedOrder((current: any) => current ? (next.find((item) => item.id === current.id) || current) : current)
      })
      .finally(() => { if (!silent) setLoading(false) })
  }

  useEffect(() => {
    void refresh()
    const supabase = getSellerSupabaseClient()
    const channel = supabase ? supabase.channel('seller-orders-live').on('postgres_changes', {
      event: '*', schema: 'public', table: 'orders',
    }, () => { void refresh(true) }).subscribe() : null
    const intervalId = window.setInterval(() => { void refresh(true) }, 10000)
    const handleFocus = () => void refresh(true)
    window.addEventListener('focus', handleFocus)
    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', handleFocus)
      if (supabase && channel) void supabase.removeChannel(channel)
    }
  }, [])

  async function processOrder(order: any) {
    if (isRefundOrFinalOrder(order)) { setMessageType('error'); setMessage('Pesanan refund/final tidak dapat diproses kembali.'); return }
    setSaving(true)
    setMessage('')
    setMessageType('info')

    try {
      const result = await processSellerOrder(order.id)
      const processedOrder = result.order as any
      await refresh()

      if (selectedOrder?.id === order.id) {
        setSelectedOrder(processedOrder || { ...selectedOrder, status: 'Packing' })
      }
      setMessageType('success')
      setMessage('Pesanan dipindahkan ke tahap proses.')
    } catch (error) {
      setMessageType('error')
      setMessage(error instanceof Error ? error.message : 'Pesanan gagal diproses.')
    } finally {
      setSaving(false)
    }
  }

  async function submitSellerCancellation(order: any) {
    if (cancelReason.trim().length < 5) {
      setMessageType('error'); setMessage('Alasan pembatalan minimal 5 karakter.'); return
    }
    setSaving(true); setMessage(''); setMessageType('info')
    try {
      const result = await cancelSellerOrder(order.id, cancelReason.trim())
      setMessageType(result.action === 'shipment_cancel_pending' ? 'info' : 'success'); setMessage(result.message)
      setCancelConfirmOpen(false); setCancelReason('')
      setSelectedOrder(result.order as any)
      await refresh()
    } catch (error) {
      setMessageType('error'); setMessage(error instanceof Error ? error.message : 'Pesanan gagal dibatalkan.')
    } finally { setSaving(false) }
  }

  async function submitRefundCompletion(order: any) {
    const dest=(order as any).refund?.destination
    if (!dest?.provider || !dest?.account_number || !dest?.account_name) { setMessageType('error'); setMessage('Buyer belum mengisi rekening/e-wallet tujuan refund.'); return }
    if (refundReference.trim().length < 3) { setMessageType('error'); setMessage('Isi referensi transfer setelah dana benar-benar dikirim.'); return }
    setSaving(true); setMessage(''); setMessageType('info')
    try {
      const result = await completeSellerRefund(order.id, refundReference.trim(), refundNote.trim())
      setMessageType('success'); setMessage(result.message)
      setRefundConfirmOpen(false); setRefundReference(''); setRefundNote('')
      setSelectedOrder(result.order as any)
      await refresh()
    } catch (error) {
      setMessageType('error'); setMessage(error instanceof Error ? error.message : 'Refund gagal diselesaikan.')
    } finally { setSaving(false) }
  }

  async function createShipment(order: any) {
    if (isRefundOrFinalOrder(order)) { setMessageType('error'); setMessage('Pesanan refund/final tidak dapat dibuatkan pengiriman.'); return }
    setSaving(true)
    setMessage('')
    setMessageType('info')

    try {
      const result = await createBiteshipShipment(order.id, 'pickup')
      let updated = result.order as any
      let finalMessage = result.message || 'Pengiriman berhasil dibuat.'

      // Biteship kadang membuat order lebih dulu dan menerbitkan waybill beberapa saat kemudian.
      // Coba ambil resi sekali lagi otomatis agar seller tidak perlu menekan tombol manual.
      if (updated?.biteship_order_id && !updated?.resi) {
        await new Promise((resolve) => window.setTimeout(resolve, 1400))
        try {
          const synced = await refreshBiteshipShipment(order.id)
          updated = (synced.order as any) || updated
          finalMessage = updated?.resi
            ? `Pengiriman dibuat. Resi ${updated.resi} berhasil disinkronkan.`
            : 'Pengiriman dibuat. Resi sedang diproses kurir dan akan disinkronkan otomatis.'
        } catch {
          finalMessage = 'Pengiriman dibuat. Resi sedang diproses kurir; gunakan Ambil Resi bila belum muncul.'
        }
      }

      setMessageType('success')
      setMessage(finalMessage)
      await refresh()
      if (selectedOrder?.id === order.id && updated) setSelectedOrder(updated)
    } catch (error) {
      setMessageType('error')
      setMessage(error instanceof Error ? error.message : 'Pengiriman gagal dibuat.')
    } finally {
      setSaving(false)
    }
  }

  async function syncShipment(order: any) {
    setSaving(true)
    setMessage('')
    setMessageType('info')
    try {
      const result = await refreshBiteshipShipment(order.id)
      const updated = result.order as any
      setMessageType('success')
      setMessage(result.message || 'Status pengiriman diperbarui.')
      await refresh()
      if (selectedOrder?.id === order.id && updated) setSelectedOrder(updated)
    } catch (error) {
      setMessageType('error')
      setMessage(error instanceof Error ? error.message : 'Status pengiriman gagal diperbarui.')
    } finally {
      setSaving(false)
    }
  }


  async function recoverBiteshipCsv(file: File) {
    setSaving(true)
    setMessage('')
    setMessageType('info')
    try {
      if (!file.name.toLowerCase().endsWith('.csv')) {
        throw new Error('Gunakan export Biteship berformat CSV.')
      }
      const csvText = await file.text()
      const result = await bulkRecoverBiteshipShipments(csvText) as any
      const summary = result.summary || {}
      setMessageType('success')
      setMessage(`${result.message || 'Sinkronisasi selesai.'} Cocok: ${summary.matched ?? 0}, dilewati: ${summary.skipped ?? 0}, error: ${summary.errors ?? 0}.`)
      await refresh()
    } catch (error) {
      setMessageType('error')
      setMessage(error instanceof Error ? error.message : 'Bulk recovery Biteship gagal.')
    } finally {
      setSaving(false)
      if (recoveryFileRef.current) recoveryFileRef.current.value = ''
    }
  }

  function printLabel(order: any) {
    if (!order.resi) {
      setMessageType('info')
      setMessage('Resi belum tersedia. Coba sinkronkan status beberapa saat lagi.')
      return
    }
    const customer = order.customer || {}
    const items = (order.items || []).map((item: any) => `${item.product?.title || item.title || 'Produk'} x${item.qty || item.quantity || 1}`).join('<br>')
    const popup = window.open('', '_blank', 'width=760,height=900')
    if (!popup) return
    popup.document.write(`<!doctype html><html><head><title>Label ${order.resi}</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}.label{border:2px solid #111;padding:20px;max-width:680px}.row{display:flex;justify-content:space-between;gap:20px;border-bottom:1px solid #bbb;padding:12px 0}.resi{font-size:30px;font-weight:900;letter-spacing:2px}.small{font-size:13px;color:#444}h1,h2,p{margin:0 0 8px}@media print{button{display:none}}</style></head><body><div class="label"><div class="row"><div><h1>SanzStore25</h1><p>${courierName(order) || '-'}</p></div><div><p class="small">NOMOR RESI</p><div class="resi">${order.resi}</div></div></div><div class="row"><div><p class="small">PENERIMA</p><h2>${customer.name || '-'}</h2><p>${customer.phone || order.buyer_phone || '-'}</p><p>${customerAddress(order)}</p></div></div><div class="row"><div><p class="small">ISI PAKET</p><p>${items}</p></div><div><p class="small">ORDER</p><b>${order.id}</b></div></div></div><button onclick="window.print()">Cetak</button></body></html>`)
    popup.document.close()
    popup.focus()
  }

  async function copyResi(order: any) {
    if (!order.resi) return

    try {
      await navigator.clipboard.writeText(order.resi)
      setMessageType('success')
      setMessage('Nomor resi berhasil disalin.')
    } catch {
      setMessageType('info')
      setMessage(`Nomor resi: ${order.resi}`)
    }
  }

  function openTracking(order: any) {
    if (!order.resi) {
      setMessageType('info')
      setMessage('Nomor resi belum tersedia.')
      return
    }

    const url = order.biteship_tracking_url || trackingUrl(courierName(order))
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const waitingPaymentCount = orders.filter((order: any) => statusLabel(order) === 'Menunggu Bayar').length
  const paidCount = orders.filter((order: any) => order.payment_status === 'paid').length
  const shippingCount = orders.filter((order: any) => order.status === 'Dikirim').length
  const completedCount = orders.filter((order: any) => order.status === 'Selesai').length

  const filteredOrders = useMemo(() => {
    if (statusFilter === 'Semua') return orders
    return orders.filter((order: any) => statusLabel(order) === statusFilter)
  }, [orders, statusFilter])

  const orderFilters = ['Semua', 'Menunggu Bayar', 'Sudah Bayar', 'Diproses', 'Dikirim', 'Refund', 'Selesai', 'Kedaluwarsa']

  if (loading) {
    return <main className="seller-page"><p className="seller-loading-text">Memuat pesanan seller...</p></main>
  }

  return (
    <main className="seller-page seller-orders-page">
      <div className="seller-page-heading">
        <div>
          <span className="seller-eyebrow">MANAJEMEN ORDER</span>
          <h1>Pesanan Masuk</h1>
        </div>
        <div>
          <input
            ref={recoveryFileRef}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void recoverBiteshipCsv(file)
            }}
          />
          <Button type="button" variant="outline" disabled={saving} onClick={() => recoveryFileRef.current?.click()}>
            <Upload size={16} /> Sinkronkan Export Biteship
          </Button>
        </div>
      </div>

      <div className="seller-order-stats">
        <div><span className="seller-order-stat-icon pending"><Clock3 size={18} /></span><p>Menunggu Bayar</p><b>{waitingPaymentCount}</b></div>
        <div><span className="seller-order-stat-icon paid"><WalletCards size={18} /></span><p>Sudah Bayar</p><b>{paidCount}</b></div>
        <div><span className="seller-order-stat-icon shipping"><Truck size={18} /></span><p>Dikirim</p><b>{shippingCount}</b></div>
        <div><span className="seller-order-stat-icon done"><CheckCircle2 size={18} /></span><p>Selesai</p><b>{completedCount}</b></div>
      </div>

      <div className="seller-order-filterbar">
        <div className="seller-order-filter-tabs">
          {orderFilters.map((filter) => (
            <button
              type="button"
              key={filter}
              className={statusFilter === filter ? 'active' : ''}
              onClick={() => setStatusFilter(filter)}
            >
              {filter}
            </button>
          ))}
        </div>
        <span>{filteredOrders.length} pesanan</span>
      </div>

      {message ? (
        <div className={`seller-notice is-${messageType}`} role={messageType === 'error' ? 'alert' : 'status'}>
          <span className="seller-notice-icon" aria-hidden="true">
            {messageType === 'error' ? <AlertCircle size={18} /> : messageType === 'success' ? <CheckCircle2 size={18} /> : <Info size={18} />}
          </span>
          <span className="seller-notice-copy">
            <b>{messageType === 'error' ? 'Tindakan belum berhasil' : messageType === 'success' ? 'Berhasil' : 'Informasi'}</b>
            <small>{message}</small>
          </span>
          <button type="button" onClick={() => setMessage('')} aria-label="Tutup notifikasi"><X size={16} /></button>
        </div>
      ) : null}

      {!filteredOrders.length ? (
        <div className="seller-empty-state"><PackageCheck size={30} /><b>Tidak ada pesanan</b><span>{statusFilter === 'Semua' ? 'Pesanan baru akan muncul di halaman ini.' : `Belum ada pesanan dengan status ${statusFilter}.`}</span></div>
      ) : null}

      <div className="seller-order-list">
        {filteredOrders.map((order: any) => {
          const paid =
            order.payment_status === 'paid' ||
            order.status === 'Dibayar' ||
            order.status === 'Packing' ||
            order.status === 'Diproses' ||
            order.status === 'Dikemas' ||
            order.status === 'Dikirim' ||
            order.status === 'Selesai'

          const cancelled = order.payment_status === 'cancelled' || order.status === 'Dibatalkan'
          const displayStatus = statusLabel(order)
          const finalOrRefund = isRefundOrFinalOrder(order) || ['Refund', 'Dibatalkan', 'Selesai', 'Kedaluwarsa'].includes(displayStatus)
          // V44: Refund is always view-only in Seller UI. The active Refund tab also forces view-only.
          const viewOnlyOrder = statusFilter === 'Refund' || displayStatus === 'Refund' || finalOrRefund
          const fulfillmentEligible = !viewOnlyOrder && ['Sudah Bayar', 'Diproses'].includes(displayStatus)
          const shipmentCreating = order.shipment_status === 'creating' || Boolean(order.shipment_claim_token)
          const visibleItems = (order.items || []).slice(0, 3)
          const moreItems = Math.max((order.items || []).length - visibleItems.length, 0)

          return (
            <article className="seller-order-card" data-order-status={displayStatus.toLowerCase()} data-view-only={viewOnlyOrder ? "true" : "false"} key={order.id}>
              <div className="seller-order-header">
                <div className="min-w-0">
                  <div className="seller-order-id-row"><strong>{order.id}</strong><span className={`seller-order-status status-${(displayStatus === 'Kedaluwarsa' ? 'Dibatalkan' : displayStatus).toLowerCase().split(' ').join('-')}`}>{displayStatus}</span></div>
                  <p>Buyer: <b>{order.customer?.name || order.buyer_phone || '-'}</b></p>
                </div>
                <div className="seller-order-total"><span>Total pesanan</span><strong>{rupiah(order.total)}</strong></div>
              </div>

              <div className="seller-order-body">
                <div className="seller-order-items">
                  {visibleItems.map((item: any, index: number) => (
                    <div key={`${order.id}-${index}`} className="seller-order-item">
                      <img src={item.product?.image || item.product_image || item.image || '/placeholder.svg'} alt={item.product?.title || item.product_name || item.title || 'Produk'} />
                      <div className="min-w-0 flex-1">
                        <b className="line-clamp-1">{item.product?.title || item.product_name || item.title || 'Produk'}</b>
                        <span>Qty {item.qty || item.quantity || 1}</span>
                      </div>
                    </div>
                  ))}
                  {moreItems ? <span className="seller-more-items">+{moreItems} produk lainnya</span> : null}
                </div>

                <div className="seller-order-side">
                  <div className="seller-order-shipping-mini">
                    <span>Pengiriman</span>
                    <b>{courierName(order) || 'Belum dipilih'}</b>
                    <small>{order.resi ? `Resi ${order.resi}` : order.biteship_order_id ? 'Menunggu resi kurir' : 'Resi belum dibuat'}</small>
                  </div>
                  <div className="seller-order-actions" data-view-only={viewOnlyOrder ? "true" : "false"}>
                    {viewOnlyOrder ? (
                      <Button type="button" variant="outline" onClick={() => setSelectedOrder(order)}>Detail</Button>
                    ) : (
                      <>
                        {fulfillmentEligible && paid && !cancelled && displayStatus === 'Sudah Bayar' ? (
                          <Button type="button" className="seller-action-process" disabled={saving} onClick={() => void processOrder(order)}>Proses</Button>
                        ) : null}

                        {fulfillmentEligible && paid && !cancelled && !shipmentCreating && !order.resi && !order.biteship_order_id && displayStatus === 'Diproses' ? (
                          <Button type="button" className="seller-action-shipment" variant="outline" disabled={saving} onClick={() => void createShipment(order)}><Truck size={16} /> Buat Pengiriman</Button>
                        ) : null}

                        {fulfillmentEligible && order.biteship_order_id && !order.resi ? (
                          <Button type="button" className="seller-action-sync" variant="outline" disabled={saving} onClick={() => void syncShipment(order)}><PackageSearch size={16} /> Ambil Resi</Button>
                        ) : null}

                        {order.resi ? (
                          <Button type="button" variant="outline" onClick={() => openTracking(order)}><PackageSearch size={16} /> Lacak</Button>
                        ) : null}

                        <Button type="button" variant="outline" onClick={() => setSelectedOrder(order)}>Detail</Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </article>
          )
        })}
      </div>

      {selectedOrder ? (
        <div className="seller-modal-backdrop fixed inset-0 z-50 overflow-y-auto p-4">
          <div className="seller-order-modal mx-auto max-w-5xl rounded-3xl border p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] pb-4">
              <div>
                <p className="font-bold text-brand">Detail Pesanan Seller</p>
                <h2 className="text-2xl font-black">{selectedOrder.id}</h2>
                <p className="mt-1 text-sm text-[var(--seller-muted)]">
                  Status: {statusLabel(selectedOrder)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="grid h-10 w-10 place-items-center rounded-full border border-[var(--line)]"
                aria-label="Tutup detail"
              >
                <X size={18} />
              </button>
            </div>

            <div className="seller-order-modal-grid mt-5 grid gap-5 lg:grid-cols-[1fr_330px]">
              <section className="grid gap-4">
                <div className="rounded-2xl border border-[var(--line)] p-4">
                  <h3 className="font-black">Buyer</h3>
                  <p className="mt-2">{selectedOrder.customer?.name || '-'}</p>
                  <p className="text-sm text-[var(--seller-muted)]">
                    {selectedOrder.buyer_email || selectedOrder.customer?.email || '-'}
                  </p>
                  <p className="text-sm text-[var(--seller-muted)]">
                    {selectedOrder.buyer_phone || selectedOrder.customer?.phone || '-'}
                  </p>
                </div>

                <div className="rounded-2xl border border-[var(--line)] p-4">
                  <div className="flex items-center gap-2">
                    <MapPin size={18} className="text-brand" />
                    <h3 className="font-black">Alamat Pengiriman</h3>
                  </div>
                  <p className="mt-3 leading-relaxed">
                    {customerAddress(selectedOrder) || 'Alamat belum tersedia.'}
                  </p>
                </div>

                <div className="rounded-2xl border border-[var(--line)] p-4">
                  <h3 className="font-black">Produk</h3>
                  <div className="mt-3 grid gap-3">
                    {(selectedOrder.items || []).map((item: any, index: number) => (
                      <div
                        key={`${selectedOrder.id}-detail-${index}`}
                        className="flex gap-3 rounded-xl border border-[var(--line)] p-3"
                      >
                        <img
                          src={
                            item.product?.image ||
                            item.product_image ||
                            item.image ||
                            '/placeholder.svg'
                          }
                          alt={item.product?.title || item.title || 'Produk'}
                          className="h-16 w-16 rounded-xl object-cover"
                        />

                        <div className="min-w-0 flex-1">
                          <b>
                            {item.product?.title ||
                              item.product_name ||
                              item.title ||
                              'Produk'}
                          </b>

                          <p className="text-sm text-[var(--seller-muted)]">
                            Qty {item.qty || item.quantity || 1}
                          </p>

                          <p className="font-bold text-brand">
                            {rupiah(
                              Number(item.product?.price || item.price || 0)
                            )}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedOrder.notes ? (
                  <div className="rounded-2xl border border-[var(--line)] p-4">
                    <h3 className="font-black">Catatan Buyer</h3>
                    <p className="mt-2">{selectedOrder.notes}</p>
                  </div>
                ) : null}
              </section>

              <aside className="h-max rounded-2xl border border-[var(--line)] p-4">
                <h3 className="text-xl font-black">Ringkasan</h3>

                <div className="mt-4 grid gap-3">
                  <div className="flex justify-between gap-3">
                    <span>Subtotal</span>
                    <b>{rupiah(selectedOrder.subtotal || 0)}</b>
                  </div>

                  <div className="flex justify-between gap-3">
                    <span>Ongkir</span>
                    <b>
                      {rupiah(
                        Number(
                          selectedOrder.shipping_cost ||
                          selectedOrder.shipping?.cost ||
                          selectedOrder.shipping?.price ||
                          0
                        )
                      )}
                    </b>
                  </div>

                  {Number(selectedOrder.shipping_discount || selectedOrder.free_shipping_discount || 0) > 0 ? (
                    <div className="flex justify-between gap-3 text-emerald-500">
                      <span>Potongan Ongkir</span>
                      <b>-{rupiah(Number(selectedOrder.shipping_discount || selectedOrder.free_shipping_discount || 0))}</b>
                    </div>
                  ) : null}

                  {Number(selectedOrder.discount || selectedOrder.voucher_discount || 0) > 0 ? (
                    <div className="flex justify-between gap-3 text-emerald-500">
                      <span>{selectedOrder.voucher?.type === 'shipping' ? 'Voucher Ongkir' : 'Voucher Belanja'}</span>
                      <b>-{rupiah(Number(selectedOrder.discount || selectedOrder.voucher_discount || 0))}</b>
                    </div>
                  ) : null}

                  <div className="flex justify-between gap-3 border-t border-[var(--line)] pt-3 text-lg">
                    <span>Total</span>
                    <b className="text-brand">{rupiah(selectedOrder.total)}</b>
                  </div>
                </div>

                <div className="mt-5 rounded-xl bg-brand/10 p-3">
                  <p className="text-sm text-[var(--seller-muted)]">Kurir</p>
                  <b>{courierName(selectedOrder) || 'Belum tersedia'}</b>

                  <p className="mt-3 text-sm text-[var(--seller-muted)]">Nomor Resi</p>
                  <b>{selectedOrder.resi || 'Belum tersedia'}</b>
                </div>

                {!(isRefundOrFinalOrder(selectedOrder) || ['Refund', 'Dibatalkan', 'Selesai', 'Kedaluwarsa'].includes(statusLabel(selectedOrder))) ? (
                  <div className="mt-4 grid gap-2" data-final-refund="false">
                    {statusLabel(selectedOrder) === 'Sudah Bayar' && selectedOrder.payment_status === 'paid' ? (
                      <Button type="button" className="seller-action-process" disabled={saving} onClick={() => void processOrder(selectedOrder)}>
                        Proses Pesanan
                      </Button>
                    ) : null}

                    {statusLabel(selectedOrder) === 'Diproses' && selectedOrder.payment_status === 'paid' &&
                    !selectedOrder.resi && !selectedOrder.biteship_order_id &&
                    selectedOrder.shipment_status !== 'creating' && !selectedOrder.shipment_claim_token ? (
                      <Button type="button" className="seller-action-shipment" variant="outline" disabled={saving} onClick={() => void createShipment(selectedOrder)}>
                        <Truck size={17} /> Buat Pengiriman
                      </Button>
                    ) : null}

                    {['Sudah Bayar', 'Diproses'].includes(statusLabel(selectedOrder)) && selectedOrder.biteship_order_id && !selectedOrder.resi ? (
                      <Button type="button" className="seller-action-sync" variant="outline" disabled={saving} onClick={() => void syncShipment(selectedOrder)}>
                        <PackageSearch size={17} /> Ambil Resi dari Biteship
                      </Button>
                    ) : null}

                    {selectedOrder.resi ? (
                      <>
                        <Button type="button" variant="outline" onClick={() => openTracking(selectedOrder)}>
                          <ExternalLink size={17} /> Buka Pelacakan Kurir
                        </Button>
                        <Button type="button" variant="outline" onClick={() => void copyResi(selectedOrder)}>
                          <Clipboard size={17} /> Salin Nomor Resi
                        </Button>
                        <Button type="button" variant="outline" onClick={() => printLabel(selectedOrder)}>
                          <Printer size={17} /> Cetak Label
                        </Button>
                        <Button type="button" className="seller-action-sync" variant="outline" disabled={saving} onClick={() => void syncShipment(selectedOrder)}>
                          <PackageSearch size={17} /> Sinkronkan Status
                        </Button>
                      </>
                    ) : null}
                  </div>
                ) : null}

                {selectedOrder.shipment_cancel_requested_at && !selectedOrder.shipment_cancel_confirmed_at ? (
                  <p className="mt-3 text-sm" role="status">Pembatalan pengiriman menunggu konfirmasi Biteship. Refund belum dapat diselesaikan.</p>
                ) : null}
                {(['Sudah Bayar', 'Diproses', 'Dikirim'].includes(statusLabel(selectedOrder)) ||
                  (['Refund', 'Dibatalkan'].includes(statusLabel(selectedOrder)) && selectedOrder.biteship_order_id)) &&
                !selectedOrder.shipment_cancel_confirmed_at && selectedOrder.shipment_status !== 'creating' && !selectedOrder.shipment_claim_token ? (
                  <Button type="button" className="mt-3 seller-action-cancel" variant="outline" disabled={saving} onClick={() => { setCancelReason(selectedOrder.shipment_cancel_reason || ''); setCancelConfirmOpen(true) }}>
                    <X size={17} /> {selectedOrder.shipment_cancel_requested_at ? 'Periksa Pembatalan' : selectedOrder.biteship_order_id ? 'Batalkan Pengiriman & Pesanan' : 'Batalkan Pesanan'}
                  </Button>
                ) : null}

                {statusLabel(selectedOrder) === 'Refund' ? (
                  String((selectedOrder as any).refund?.status || '').toLowerCase() === 'completed' ? (
                    <div className="mt-3 rounded-xl border border-emerald-400/40 bg-emerald-400/10 p-3 text-sm">
                      <b>Dana sudah dikembalikan.</b>
                      <div className="mt-1 text-xs text-[var(--seller-muted)]">Metode: transfer manual{(selectedOrder as any).refund?.reference ? ` • Ref: ${(selectedOrder as any).refund.reference}` : ''}</div>
                    </div>
                  ) : (
                    <div className="mt-3 rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-sm">
                      <b>Refund menunggu diproses.</b> Dana buyer belum dianggap dikembalikan.
                      {(selectedOrder as any).refund?.destination ? <div className="mt-3 rounded-xl border border-white/10 bg-black/10 p-3"><div className="text-xs font-bold uppercase tracking-wider text-[var(--seller-muted)]">Tujuan refund buyer</div><div className="mt-2 font-black">{(selectedOrder as any).refund.destination.provider} • {(selectedOrder as any).refund.destination.account_number}</div><div className="mt-1 text-xs text-[var(--seller-muted)]">a.n. {(selectedOrder as any).refund.destination.account_name} • {(selectedOrder as any).refund.destination.type === 'ewallet' ? 'E-Wallet' : 'Bank'}</div></div> : <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-xs text-amber-200">Buyer belum mengisi rekening/e-wallet tujuan refund. Minta buyer membuka detail pesanan dan mengisi data refund di sana.</div>}
                      <Button type="button" className="mt-3 w-full" disabled={saving || !(selectedOrder as any).refund?.destination || (Boolean(selectedOrder.biteship_order_id || selectedOrder.resi) && !selectedOrder.shipment_cancel_confirmed_at)} onClick={() => { setRefundReference(''); setRefundNote(''); setRefundConfirmOpen(true) }}>
                        <WalletCards size={17} /> Tandai Dana Dikembalikan
                      </Button>
                    </div>
                  )
                ) : null}

                {selectedOrder.resi ? (
                  <p className="mt-3 text-xs leading-relaxed text-[var(--seller-muted)]">
                    Nomor resi akan disalin atau dibuka di halaman pelacakan resmi kurir.
                  </p>
                ) : null}
              </aside>
            </div>
          </div>
        </div>
      ) : null}

      {selectedOrder && refundConfirmOpen ? (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-2xl">
            <h3 className="text-xl font-black">Konfirmasi Refund Manual</h3>
            <p className="mt-2 text-sm text-[var(--seller-muted)]">Transfer manual ke rekening buyer, lalu isi referensi transfer.</p>{(selectedOrder as any).refund?.destination ? <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3 text-sm"><div className="text-xs uppercase tracking-wider text-[var(--seller-muted)]">Transfer ke</div><b className="mt-1 block">{(selectedOrder as any).refund.destination.provider} • {(selectedOrder as any).refund.destination.account_number}</b><span className="text-xs text-[var(--seller-muted)]">a.n. {(selectedOrder as any).refund.destination.account_name} • Nominal {rupiah(Number(selectedOrder.total||0))}</span></div> : null}
            <input value={refundReference} onChange={(e) => setRefundReference(e.target.value)} placeholder="Referensi transfer / nomor transaksi (wajib)" className="mt-4 w-full rounded-xl border border-[var(--line)] bg-transparent p-3 outline-none" />
            <textarea value={refundNote} onChange={(e) => setRefundNote(e.target.value)} rows={3} placeholder="Catatan refund (opsional)" className="mt-3 w-full rounded-xl border border-[var(--line)] bg-transparent p-3 outline-none" />
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" disabled={saving} onClick={() => setRefundConfirmOpen(false)}>Kembali</Button>
              <Button type="button" disabled={saving || refundReference.trim().length < 3} onClick={() => void submitRefundCompletion(selectedOrder)}>Dana Sudah Ditransfer</Button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedOrder && cancelConfirmOpen ? (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-2xl">
            <h3 className="text-xl font-black">Batalkan Pesanan</h3>
            <p className="mt-2 text-sm text-[var(--seller-muted)]">{selectedOrder.payment_status === 'paid' ? 'Pesanan sudah dibayar. Sistem akan mengubahnya menjadi Refund Menunggu, bukan menganggap dana sudah dikembalikan.' : 'Pesanan belum dibayar. Pembatalan akan melepas reservasi stok.'}</p>
            <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={4} placeholder="Tulis alasan pembatalan..." className="mt-4 w-full rounded-xl border border-[var(--line)] bg-transparent p-3 outline-none" />
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" disabled={saving} onClick={() => setCancelConfirmOpen(false)}>Kembali</Button>
              <Button type="button" disabled={saving || cancelReason.trim().length < 5} onClick={() => void submitSellerCancellation(selectedOrder)}>Konfirmasi Pembatalan</Button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}

export default SellerOrdersPage
