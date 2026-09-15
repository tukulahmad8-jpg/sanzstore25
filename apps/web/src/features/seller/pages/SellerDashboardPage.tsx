import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  BarChart3,
  Boxes,
  ClipboardList,
  PackageCheck,
  PackagePlus,
  Star,
  TrendingUp,
  WalletCards,
} from 'lucide-react'
import { Card } from '@/components/common/Card'
import { getSupabaseClient } from '@/lib/supabase'
import { getSellerOrders } from '@/services/orders.service'
import { getProducts } from '@/services/products.service'
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
  const supabase = getSupabaseClient()
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

  // Dashboard seller must use the same order population shown on the seller order page.
  // Exclude only orders that are definitively cancelled/refunded/expired. Older orders
  // may not have payment_status="paid" even though they are valid seller orders.
  return !['refund', 'dibatalkan', 'cancelled', 'canceled'].includes(status)
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
  const { data: productsData, isLoading: loadingProducts } = useQuery({ queryKey: ['products'], queryFn: getProducts, refetchOnMount: 'always', refetchOnWindowFocus: true })
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
    const waitingPayment = orders.filter((order: any) => !isPaid(order) && !['cancelled', 'expired'].includes(String(order.payment_status || '').toLowerCase())).length
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

  const statCards = [
    { label: 'Total penjualan', value: loading ? '...' : formatCurrency(stats.totalSales), icon: WalletCards, note: `Hari ini ${formatCurrency(stats.omzetToday)}`, accent: 'brand' },
    { label: 'Pesanan hari ini', value: loading ? '...' : String(stats.todayOrders), icon: ClipboardList, note: 'Order masuk hari ini', accent: 'blue' },
    { label: 'Produk aktif', value: loading ? '...' : String(stats.activeProducts), icon: PackageCheck, note: `${products.length} total produk`, accent: 'green' },
    { label: 'Rating toko', value: loading ? '...' : reviews.length ? stats.averageRating.toFixed(1) : '-', icon: Star, note: reviews.length ? `${reviews.length} ulasan terbaru` : 'Belum ada ulasan', accent: 'amber' },
  ] as const

  return (
    <main className="seller-page seller-dashboard-page seller-dashboard-v3">
      <section className="seller-dashboard-welcome">
        <div>
          <span className="seller-eyebrow">SELLER CENTER</span>
          <h1>Ringkasan Toko</h1>
        </div>
        <div className="seller-dashboard-welcome-actions">
          <button className="seller-heading-action" type="button" onClick={() => navigate('/seller/reports')}>
            <BarChart3 size={17} /> Laporan
          </button>
          <button className="seller-primary-action" type="button" onClick={() => navigate('/seller/products')}>
            <PackagePlus size={17} /> Tambah Produk
          </button>
        </div>
      </section>

      <Card className="seller-overview-strip">
        {statCards.map(({ label, value, icon: Icon, note, accent }) => (
          <div key={label} className={`seller-overview-item seller-overview-${accent}`}>
            <span className="seller-overview-icon"><Icon size={18} /></span>
            <div className="seller-overview-copy">
              <span>{label}</span>
              <strong>{value}</strong>
              <small>{note}</small>
            </div>
          </div>
        ))}
      </Card>

      <div className="seller-dashboard-priority-grid">
        <Card className="seller-dashboard-orders-card">
          <div className="seller-card-heading compact">
            <div>
              <span className="seller-card-kicker">ORDER</span>
              <h2>Pesanan Terbaru</h2>
            </div>
            <button type="button" onClick={() => navigate('/seller/orders')}>Semua pesanan <ArrowRight size={15} /></button>
          </div>

          <div className="seller-dashboard-order-table">
            {latestOrders.length ? latestOrders.map((order: any) => (
              <button key={order.id} type="button" onClick={() => navigate('/seller/orders')} className="seller-dashboard-order-row">
                <div className="seller-dashboard-order-main">
                  <b>{order.id}</b>
                  <span>{order.customer?.name || order.buyer_phone || 'Buyer'}</span>
                </div>
                <span className={`seller-dashboard-status is-${statusTone(order)}`}>{shortStatus(order)}</span>
                <strong>{formatCurrency(Number(order.total || 0))}</strong>
                <ArrowRight size={15} />
              </button>
            )) : (
              <div className="seller-empty-state compact">Belum ada pesanan.</div>
            )}
          </div>
        </Card>

        <Card className="seller-attention-card">
          <div className="seller-card-heading compact">
            <div>
              <span className="seller-card-kicker">PRIORITAS</span>
              <h2>Perlu Ditindak</h2>
            </div>
          </div>

          <div className="seller-attention-list">
            <button type="button" onClick={() => navigate('/seller/orders')}>
              <span className="seller-attention-icon pending"><ClipboardList size={18} /></span>
              <div><b>Menunggu pembayaran</b></div>
              <strong>{stats.waitingPayment}</strong>
              <ArrowRight size={15} />
            </button>
            <button type="button" onClick={() => navigate('/seller/orders')}>
              <span className="seller-attention-icon paid"><PackageCheck size={18} /></span>
              <div><b>Siap diproses</b></div>
              <strong>{stats.readyToProcess}</strong>
              <ArrowRight size={15} />
            </button>
            <button type="button" onClick={() => navigate('/seller/products')}>
              <span className="seller-attention-icon stock"><Boxes size={18} /></span>
              <div><b>Stok menipis</b></div>
              <strong>{lowStock.length}</strong>
              <ArrowRight size={15} />
            </button>
          </div>
        </Card>
      </div>

      <div className="seller-dashboard-insight-grid">
        <Card className="seller-sales-card seller-sales-card-v3">
          <div className="seller-card-heading">
            <div>
              <span className="seller-card-kicker">PERFORMA</span>
              <h2>Penjualan 7 Hari</h2>
              <p>Total minggu ini <b>{formatCurrency(weeklySales)}</b></p>
            </div>
            <span className="seller-card-heading-icon"><TrendingUp size={20} /></span>
          </div>

          <div className="seller-sales-chart seller-sales-chart-v3">
            {salesByDay.map((item) => (
              <div key={item.label} className="seller-sales-column">
                <span className="seller-sales-value">{item.value ? formatCurrency(item.value) : '-'}</span>
                <div className="seller-sales-bar-track">
                  <div className="seller-sales-bar" style={{ height: `${Math.max((item.value / maxSales) * 100, item.value ? 8 : 2)}%` }} />
                </div>
                <span className="seller-sales-label">{item.label}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="seller-top-products-card">
          <div className="seller-card-heading compact">
            <div><span className="seller-card-kicker">PRODUK</span><h2>Produk Terlaris</h2></div>
            <Boxes size={19} />
          </div>
          <div className="seller-top-products-list">
            {bestProducts.length ? bestProducts.map((product, index) => (
              <div key={product.id} className="seller-top-product-row">
                <span className="seller-rank">{index + 1}</span>
                <div className="min-w-0"><b className="truncate">{product.title}</b><small>{product.count} terjual</small></div>
              </div>
            )) : <div className="seller-empty-state compact">Belum ada data penjualan.</div>}
          </div>
        </Card>
      </div>

      <div className="seller-dashboard-foot-grid">
        <Card className="seller-stock-card-v3">
          <div className="seller-card-heading compact">
            <div><span className="seller-card-kicker">INVENTORY</span><h2>Stok Menipis</h2></div>
            <button type="button" onClick={() => navigate('/seller/products')}>Kelola <ArrowRight size={15} /></button>
          </div>
          <div className="seller-stock-list-v3">
            {lowStock.length ? lowStock.map((product: any) => (
              <button key={product.id} type="button" onClick={() => navigate('/seller/products')}>
                <div className="min-w-0"><b className="truncate">{product.title}</b></div>
                <em className="seller-stock-pill">Stok {product.stock}</em>
              </button>
            )) : <div className="seller-empty-state compact">Semua stok masih aman.</div>}
          </div>
        </Card>

        <Card className="seller-review-card seller-review-card-v3">
          <div className="seller-card-heading compact">
            <div><span className="seller-card-kicker">CUSTOMER</span><h2>Ulasan Terbaru</h2></div>
            <Star size={19} className="text-amber-500" />
          </div>
          <div className="seller-review-list seller-review-list-v3">
            {reviews.length ? reviews.slice(0, 3).map((review) => (
              <div key={review.id} className="seller-review-item">
                <div className="seller-review-meta">
                  <b className="line-clamp-1">{productNames.get(review.product_id) || 'Produk'}</b>
                  <span><Star size={12} className="fill-current" /> {review.rating}</span>
                </div>
                <p className="line-clamp-1">{review.comment?.trim() || 'Rating tanpa komentar.'}</p>
              </div>
            )) : <div className="seller-empty-state compact">Belum ada ulasan.</div>}
          </div>
        </Card>
      </div>
    </main>
  )
}

export default SellerDashboardPage
