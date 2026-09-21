import { useEffect, useMemo, useRef, useState } from 'react'
import { confirmAction } from '@/lib/notify'
import { Clock3, ReceiptText, ShieldCheck } from 'lucide-react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/common/Button'
import { Card } from '@/components/common/Card'
import { checkPayment, createPayment } from '@/services/payment.service'
import { cancelBuyerOrder, getOrderById } from '@/services/orders.service'
import { getSupabaseClient } from '@/lib/supabase'
import type { Order } from '@/types/domain'

function rupiah(value: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value || 0))
}

function isPaidOrder(order: Order | null) {
  return order?.payment_status === 'paid' || ['Dibayar', 'Diproses', 'Dikemas', 'Dikirim', 'Selesai'].includes(String(order?.status || ''))
}

function getExpiryTime(order: Order | null) {
  const explicit = order?.payment_expires_at ? new Date(order.payment_expires_at).getTime() : 0
  if (Number.isFinite(explicit) && explicit > 0) return explicit
  const created = order?.created_at ? new Date(order.created_at).getTime() : 0
  return Number.isFinite(created) && created > 0 ? created + 24 * 60 * 60 * 1000 : 0
}

function formatCountdown(ms: number) {
  if (ms <= 0) return '00:00:00'
  const total = Math.floor(ms / 1000)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':')
}

export function PaymentPage() {
  const navigate = useNavigate()
  const { orderId = '' } = useParams()
  const [params] = useSearchParams()
  const [order, setOrder] = useState<Order | null>(null)
  const [loadingOrder, setLoadingOrder] = useState(true)
  const [paying, setPaying] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [message, setMessage] = useState('')
  const [now, setNow] = useState(Date.now())
  const paymentCheckBusy = useRef(false)

  const invoice = params.get('invoice') || orderId
  const amountFromUrl = Number(params.get('amount') || 0)
  const buyerNameFromUrl = params.get('name') || 'Buyer SanzStore25'
  const amount = Number(order?.total || amountFromUrl || 0)
  const buyerName = String((order as any)?.customer?.name || buyerNameFromUrl)
  const paid = useMemo(() => isPaidOrder(order), [order])
  const expiryTime = useMemo(() => getExpiryTime(order), [order])
  const remainingMs = expiryTime ? Math.max(0, expiryTime - now) : 0
  const expired = Boolean(expiryTime && remainingMs <= 0 && !paid && order?.payment_status !== 'cancelled')

  async function loadOrder(redirectWhenPaid = true) {
    if (!invoice) return
    try {
      const result = await getOrderById(invoice)
      const found = result.data || null
      setOrder(found)
      if (redirectWhenPaid && isPaidOrder(found)) navigate(`/account/orders/${invoice}`, { replace: true })
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal membaca status pesanan.')
    } finally {
      setLoadingOrder(false)
    }
  }

  async function reconcilePayment() {
    if (!invoice || paymentCheckBusy.current) return
    paymentCheckBusy.current = true
    try {
      const result = await checkPayment({ orderId: invoice, amount })
      if (['paid', 'completed', 'success'].includes(String(result?.status || '').toLowerCase())) {
        await loadOrder(true)
      }
    } catch (error) {
      // Polling is a fallback for webhook delivery. Keep the page usable if one check fails.
      console.warn('[payment:reconcile]', error)
    } finally {
      paymentCheckBusy.current = false
    }
  }

  useEffect(() => {
    void loadOrder(false).then(() => void reconcilePayment())
    const orderIntervalId = window.setInterval(() => { void loadOrder(false) }, 10000)
    const paymentIntervalId = window.setInterval(() => { void reconcilePayment() }, 5000)
    const timerId = window.setInterval(() => setNow(Date.now()), 1000)
    const supabase = getSupabaseClient()
    const channel = supabase ? supabase.channel(`payment-order-${invoice}`).on('postgres_changes', {
      event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${invoice}`,
    }, (payload) => {
      const updated = payload.new as Order
      setOrder(updated)
      if (isPaidOrder(updated)) navigate(`/account/orders/${invoice}`, { replace: true })
    }).subscribe() : null
    const handleReturn = () => {
      // Browser back/forward cache can preserve the old `paying=true` state.
      setPaying(false)
      void loadOrder(false).then(() => void reconcilePayment())
    }
    window.addEventListener('focus', handleReturn)
    window.addEventListener('pageshow', handleReturn)
    return () => {
      window.clearInterval(orderIntervalId)
      window.clearInterval(paymentIntervalId)
      window.clearInterval(timerId)
      window.removeEventListener('focus', handleReturn)
      window.removeEventListener('pageshow', handleReturn)
      if (supabase && channel) void supabase.removeChannel(channel)
    }
  }, [invoice, navigate])

  async function handlePay() {
    if (!invoice || !amount || paying || expired) return
    setPaying(true); setMessage('')
    try {
      const payment = await createPayment({ orderId: invoice, amount, method: 'all', redirectUrl: `${window.location.origin}/payment/${invoice}?amount=${amount}&name=${encodeURIComponent(buyerName)}&invoice=${invoice}` })
      window.location.assign(payment.paymentUrl)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal membuka pembayaran Pakasir.')
      setPaying(false)
    }
  }

  async function handleCancel() {
    if (!invoice || paid || cancelling) return
    if (!(await confirmAction('Batalkan pesanan ini?', { confirmText: 'Batalkan pesanan', danger: true }))) return
    setCancelling(true); setMessage('')
    try {
      await cancelBuyerOrder(invoice)
      navigate('/account?tab=orders', { replace: true })
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Pesanan gagal dibatalkan.')
      setCancelling(false)
    }
  }

  if (loadingOrder) return <main className="mx-auto max-w-5xl px-4 py-8"><p>Memeriksa status pembayaran...</p></main>

  const statusText = paid ? 'Sudah Dibayar' : expired ? 'Kedaluwarsa' : order?.status || 'Belum Bayar'

  return <main className="payment-polish mx-auto max-w-6xl px-4 py-8 sm:py-10">
    <Card className="payment-shell">
      <div className="payment-topline">
        <div>
          <p className="payment-eyebrow">SANZSTORE25 PAYMENT</p>
          <h1>{paid ? 'Pembayaran Berhasil' : expired ? 'Waktu Pembayaran Habis' : 'Menunggu Pembayaran'}</h1>
          <p>{paid ? 'Pembayaran sudah diterima dan pesanan akan segera diproses.' : expired ? 'Pesanan ini sudah melewati batas pembayaran.' : 'Selesaikan pembayaran sebelum waktu habis agar pesanan tetap aktif.'}</p>
        </div>
        <span className={`payment-status-pill ${paid ? 'is-paid' : ''} ${expired ? 'is-expired' : ''}`}>{statusText}</span>
      </div>

      {!paid && !expired && expiryTime ? <div className="payment-countdown-banner">
        <div className="payment-countdown-icon"><Clock3 size={22}/></div>
        <div><span>Sisa waktu pembayaran</span><strong>{formatCountdown(remainingMs)}</strong></div>
        <p>Berakhir {new Date(expiryTime).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</p>
      </div> : null}

      <div className="payment-content-grid">
        <div className="payment-detail-panel">
          <div className="payment-panel-title"><ReceiptText size={18}/><span>Detail Transaksi</span></div>
          <div className="payment-detail-row"><span>Invoice</span><strong>{invoice || '-'}</strong></div>
          <div className="payment-detail-row"><span>Nama Buyer</span><strong>{buyerName}</strong></div>
          <div className="payment-detail-row"><span>Status</span><strong className="payment-status-text">{statusText}</strong></div>
          <div className="payment-detail-row payment-total-row"><span>Total Pembayaran</span><strong>{rupiah(amount)}</strong></div>
        </div>

        <div className="payment-action-panel">
          <div className="payment-panel-title"><ShieldCheck size={18}/><span>{paid ? 'Pesanan Siap Dipantau' : 'Aksi Pembayaran'}</span></div>
          <p>{paid ? 'Lihat detail pesanan untuk memantau proses dan pengiriman.' : expired ? 'Buat pesanan baru jika Anda masih ingin membeli produk ini.' : 'Klik Bayar Sekarang untuk memilih metode pembayaran di halaman Pakasir.'}</p>
          <div className="payment-actions">
            {!paid && !expired ? <>
              <Button className="payment-primary-action" disabled={!amount || paying || cancelling} onClick={handlePay}>{paying ? 'Membuka Pembayaran...' : 'Bayar Sekarang'}</Button>
              <Link to="/" className="payment-secondary-link">Kembali Belanja</Link>
              <button type="button" className="payment-cancel-link" onClick={handleCancel} disabled={paying || cancelling}>{cancelling ? 'Membatalkan...' : 'Batalkan Pesanan'}</button>
            </> : paid ? <>
              <Button className="payment-primary-action" type="button" onClick={() => navigate(`/account/orders/${invoice}`, { replace: true })}>Lihat Detail Pesanan</Button>
              <Link to="/" className="payment-secondary-link">Kembali Belanja</Link>
            </> : <>
              <Link to="/" className="payment-primary-link">Kembali Belanja</Link>
              <Link to="/account?tab=orders" className="payment-secondary-link">Lihat Pesanan</Link>
            </>}
          </div>
        </div>
      </div>
      {message ? <div className="payment-error">{message}</div> : null}
    </Card>
  </main>
}
