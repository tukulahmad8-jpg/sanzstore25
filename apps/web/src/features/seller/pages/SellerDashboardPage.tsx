import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Boxes,
  ClipboardList,
  PackageCheck,
  PackagePlus,
  Star,
} from 'lucide-react'
import { Card } from '@/components/common/Card'
import { getSellerSupabaseClient } from '@/lib/supabase'
import { getSellerOrders } from '@/services/orders.service'
import { getSellerProducts } from '@/services/products.service'
import { formatCurrency } from '@/utils/format'

type ReviewRow = {
  id: string
  product_id: string
  rating: number
  comment?: string | null
  customer_phone?: string | null
  created_at?: string | null
}

async function getReviews(): Promise<ReviewRow[]> {
  const supabase = getSellerSupabaseClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('reviews')
    .select('id, product_id, rating, comment, customer_phone, created_at')
    .order('created_at', { ascending: false })
    .limit(8)

  if (error) {
    console.warn('[seller-dashboard:reviews]', error.message)
    return []
  }

  return (data ?? []) as ReviewRow[]
}

function isPaid(order: any) {
  return order.payment_status === 'paid' || ['Dibayar', 'Sudah Bayar', 'Diproses', 'Packing', 'Dikemas', 'Dikirim', 'Selesai'].includes(order.status)
}

function isRevenueOrder(order: any) {
  const status = String(order.status || '').trim().toLowerCase()
  const paymentStatus = String(order.payment_status || '').trim().toLowerCase()
  const refundStatus = String(order.refund?.status || '').trim().toLowerCase()

  return isPaid(order)
    && !['refund', 'dibatalkan', 'kedaluwarsa', 'cancelled', 'canceled'].includes(status)
    && !['cancelled', 'canceled', 'expired'].includes(paymentStatus)
    && !['pending', 'completed', 'refunded'].includes(refundStatus)
}

function sameDay(value: string | undefined, target: Date) {
  if (!value) return false
  const date = new Date(value)
  return date.getFullYear() === target.getFullYear() && date.getMonth() === target.getMonth() && date.getDate() === target.getDate()
}

function shortStatus(order: any) {
  if (order.payment_status === 'paid') return order.status || 'Sudah Bayar'
  if (order.payment_status === 'cancelled') return 'Dibatalkan'
  if (order.payment_status === 'expired') return 'Kedaluwarsa'
  return order.status || 'Menunggu Bayar'
}

function statusTone(order: any) {
  const label = shortStatus(order).toLowerCase()
  if (label.includes('selesai')) return 'done'
  if (label.includes('kirim')) return 'shipping'
  if (label.includes('batal') || label.includes('kedaluwarsa')) return 'danger'
  if (isPaid(order)) return 'paid'
  return 'pending'
}

export function SellerDashboardPage() {
  const navigate = useNavigate()
  const { data: ordersData, isLoading: loadingOrders } = useQuery({ queryKey: ['seller-orders'], queryFn: getSellerOrders, refetchOnMount: 'always', refetchOnWindowFocus: true })
  const { data: productsData, isLoading: loadingProducts } = useQuery({ queryKey: ['seller-products'], queryFn: getSellerProducts, refetchOnMount: 'always', refetchOnWindowFocus: true })
  const { data: reviews = [], isLoading: loadingReviews } = useQuery({ queryKey: ['seller-reviews'], queryFn: getReviews })

  const orders = ordersData?.data ?? []
  const products = productsData?.data ?? []
  const productNames = useMemo(() => new Map(products.map((product: any) => [product.id, product.title])), [products])

  const stats = useMemo(() => {
    const today = new Date()
    const paidOrders = orders.filter(isRevenueOrder)
    const todayOrders = orders.filter((order: any) => sameDay(order.created_at, today))
    const todayPaid = paidOrders.filter((order: any) => sameDay(order.paid_at || order.created_at, today))
    const omzetToday = todayPaid.reduce((sum: number, order: any) => sum + Number(order.total || 0), 0)
    const totalSales = paidOrders.reduce((sum: number, order: any) => sum + Number(order.total || 0), 0)
    const activeProducts = products.filter((product: any) => product.status !== 'Nonaktif').length
    const averageRating = reviews.length
      ? reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length
      : 0
    const waitingPayment = orders.filter((order: any) => !isPaid(order)
      && !['cancelled', 'canceled', 'expired'].includes(String(order.payment_status || '').toLowerCase())
      && !['dibatalkan', 'kedaluwarsa', 'refund'].includes(String(order.status || '').trim().toLowerCase())).length
    const readyToProcess = orders.filter((order: any) => isPaid(order) && !['Dikirim', 'Selesai', 'Dibatalkan'].includes(order.status)).length

    return {
      omzetToday,
      totalSales,
      todayOrders: todayOrders.length,
      activeProducts,
      averageRating,
      waitingPayment,
      readyToProcess,
    }
  }, [orders, products, reviews])

  const salesByDay = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date()
      date.setDate(date.getDate() - (6 - index))
      return date
    })

    return days.map((date) => ({
      label: date.toLocaleDateString('id-ID', { weekday: 'short' }),
      value: orders
        .filter((order: any) => isRevenueOrder(order) && sameDay(order.paid_at || order.created_at, date))
        .reduce((sum: number, order: any) => sum + Number(order.total || 0), 0),
    }))
  }, [orders])

  const maxSales = Math.max(...salesByDay.map((item) => item.value), 1)
  const weeklySales = salesByDay.reduce((sum, item) => sum + item.value, 0)

  const bestProducts = useMemo(() => {
    const sold = new Map<string, number>()
    orders.filter(isRevenueOrder).forEach((order: any) => {
      ;(order.items ?? []).forEach((item: any) => {
        const product = item.product ?? item
        const id = String(product.id ?? item.product_id ?? '')
        if (id) sold.set(id, (sold.get(id) ?? 0) + Number(item.qty ?? item.quantity ?? 1))
      })
    })

    return [...sold.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([id, count]) => ({ id, count, title: productNames.get(id) || 'Produk' }))
  }, [orders, productNames])

  const lowStock = useMemo(
    () => products.filter((product: any) => product.status !== 'Nonaktif' && Number(product.stock || 0) <= 5).slice(0, 4),
    [products],
  )

  const latestOrders = orders.slice(0, 5)
  const loading = loadingOrders || loadingProducts || loadingReviews

  return (
    <main className="seller-page seller-dashboard-page seller-dashboard-v3 seller-dash-v60">
      <div className="dash-hero">
        <Card className="dash-hero-card">
          <div className="dash-hero-top">
            <div>
              <h1>Ringkasan Toko</h1>
              <p>Selamat datang kembali — begini performa toko kamu.</p>
            </div>
            <div className="dash-hero-actions">
              <button type="button" onClick={() => navigate('/seller/reports')}>Laporan lengkap</button>
              <button type="button" className="is-primary" onClick={() => navigate('/seller/products')}>
                <PackagePlus size={16} /> Tambah produk
              </button>
            </div>
          </div>

          <div className="dash-hero-body">
            <div className="dash-hero-number">
              <span>Omzet minggu ini</span>
              <strong>{loading ? '...' : formatCurrency(weeklySales)}</strong>
              <small>Hari ini {loading ? '...' : formatCurrency(stats.omzetToday)} · Total sepanjang waktu {loading ? '...' : formatCurrency(stats.totalSales)}</small>
            </div>
            <div className="dash-hero-chart">
              {salesByDay.map((item) => (
                <div key={item.label} className="dash-hero-bar-col">
                  <div className="dash-hero-bar-track">
                    <div className="dash-hero-bar" style={{ height: `${Math.max((item.value / maxSales) * 100, item.value ? 6 : 2)}%` }} title={formatCurrency(item.value)} />
                  </div>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <div className="dash-secondary-strip">
          <button type="button" onClick={() => navigate('/seller/orders')}>
            <span>Pesanan hari ini</span>
            <strong>{loading ? '...' : stats.todayOrders}</strong>
          </button>
          <button type="button" onClick={() => navigate('/seller/products')}>
            <span>Produk aktif</span>
            <strong>{loading ? '...' : stats.activeProducts}</strong>
            <small>{products.length} total</small>
          </button>
          <button type="button" onClick={() => navigate('/seller/reviews')}>
            <span>Rating toko</span>
            <strong>{loading ? '...' : reviews.length ? stats.averageRating.toFixed(1) : '–'}</strong>
            <small>{reviews.length ? `${reviews.length} ulasan` : 'Belum ada ulasan'}</small>
          </button>
        </div>
      </div>

      <div className="dash-columns">
        <Card className="dash-orders-card">
          <div className="dash-card-head">
            <h2>Pesanan terbaru</h2>
            <button type="button" onClick={() => navigate('/seller/orders')}>Lihat semua</button>
          </div>

          <div className="dash-order-table">
            {latestOrders.length ? latestOrders.map((order: any) => (
              <button key={order.id} type="button" onClick={() => navigate('/seller/orders')} className="dash-order-row">
                <div className="dash-order-main">
                  <b>{order.id}</b>
                  <span>{order.customer?.name || order.buyer_phone || 'Buyer'}</span>
                </div>
                <span className={`dash-status is-${statusTone(order)}`}>{shortStatus(order)}</span>
                <strong>{formatCurrency(Number(order.total || 0))}</strong>
              </button>
            )) : (
              <div className="dash-empty">Belum ada pesanan.</div>
            )}
          </div>
        </Card>

        <Card className="dash-attention-card">
          <div className="dash-card-head">
            <h2>Perlu ditindak</h2>
          </div>

          <div className="dash-attention-list">
            <button type="button" onClick={() => navigate('/seller/orders')}>
              <span className="dash-attention-icon is-pending"><ClipboardList size={17} /></span>
              <span className="dash-attention-label">Menunggu pembayaran</span>
              <strong>{stats.waitingPayment}</strong>
            </button>
            <button type="button" onClick={() => navigate('/seller/orders')}>
              <span className="dash-attention-icon is-paid"><PackageCheck size={17} /></span>
              <span className="dash-attention-label">Siap diproses</span>
              <strong>{stats.readyToProcess}</strong>
            </button>
            <button type="button" onClick={() => navigate('/seller/products')}>
              <span className="dash-attention-icon is-stock"><Boxes size={17} /></span>
              <span className="dash-attention-label">Stok menipis</span>
              <strong>{lowStock.length}</strong>
            </button>
          </div>
        </Card>
      </div>

      <div className="dash-columns dash-columns-thirds">
        <Card className="dash-list-card">
          <div className="dash-card-head"><h2>Produk terlaris</h2></div>
          <div className="dash-simple-list">
            {bestProducts.length ? bestProducts.map((product, index) => (
              <div key={product.id} className="dash-simple-row">
                <span className="dash-rank">{index + 1}</span>
                <div className="min-w-0"><b className="truncate">{product.title}</b><small>{product.count} terjual</small></div>
              </div>
            )) : <div className="dash-empty">Belum ada data penjualan.</div>}
          </div>
        </Card>

        <Card className="dash-list-card">
          <div className="dash-card-head">
            <h2>Stok menipis</h2>
            <button type="button" onClick={() => navigate('/seller/products')}>Kelola</button>
          </div>
          <div className="dash-simple-list">
            {lowStock.length ? lowStock.map((product: any) => (
              <button key={product.id} type="button" className="dash-simple-row is-button" onClick={() => navigate('/seller/products')}>
                <div className="min-w-0"><b className="truncate">{product.title}</b></div>
                <em>Stok {product.stock}</em>
              </button>
            )) : <div className="dash-empty">Semua stok masih aman.</div>}
          </div>
        </Card>

        <Card className="dash-list-card">
          <div className="dash-card-head">
            <h2>Ulasan terbaru</h2>
            <Star size={16} className="text-amber-500" />
          </div>
          <div className="dash-simple-list">
            {reviews.length ? reviews.slice(0, 3).map((review) => (
              <div key={review.id} className="dash-review-row">
                <div className="dash-review-top">
                  <b className="line-clamp-1">{productNames.get(review.product_id) || 'Produk'}</b>
                  <span><Star size={11} className="fill-current" /> {review.rating}</span>
                </div>
                <p className="line-clamp-1">{review.comment?.trim() || 'Rating tanpa komentar.'}</p>
              </div>
            )) : <div className="dash-empty">Belum ada ulasan.</div>}
          </div>
        </Card>
      </div>
    </main>
  )
}

export default SellerDashboardPage
