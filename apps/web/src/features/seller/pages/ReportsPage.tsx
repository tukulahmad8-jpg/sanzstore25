import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart3, CalendarRange, Download, PackageCheck, ReceiptText, ShoppingBag, TrendingUp } from 'lucide-react'
import { Button } from '@/components/common/Button'
import { Card } from '@/components/common/Card'
import { getSellerOrders } from '@/services/orders.service'
import { useSellerAuthStore } from '@/stores/sellerAuth.store'
import { formatCurrency } from '@/utils/format'

export function ReportsPage() {
  const sellerId = useSellerAuthStore((state) => state.seller?.id)
  const { data, isLoading, error } = useQuery({ queryKey: ['seller-report-orders', sellerId], queryFn: getSellerOrders, enabled: !!sellerId })
  const orders = data?.data ?? []
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const filtered = useMemo(() => {
    return orders.filter((order: any) => {
      const created = new Date(order.created_at || 0)
      if (from && created < new Date(`${from}T00:00:00`)) return false
      if (to && created > new Date(`${to}T23:59:59`)) return false
      return true
    })
  }, [orders, from, to])

  const paid = filtered.filter((order: any) =>
    order.payment_status === 'paid' ||
    ['Dibayar', 'Diproses', 'Packing', 'Dikemas', 'Dikirim', 'Selesai'].includes(order.status),
  )

  const omzet = paid.reduce((sum, order: any) => sum + Number(order.total || 0), 0)
  const itemsSold = paid.reduce(
    (sum, order: any) =>
      sum + (order.items || []).reduce((subtotal: number, item: any) => subtotal + Number(item.qty || item.quantity || 1), 0),
    0,
  )

  const averageOrder = paid.length ? omzet / paid.length : 0

  const bestProducts = useMemo(() => {
    const map = new Map<string, { title: string; qty: number; omzet: number }>()
    paid.forEach((order: any) => {
      ;(order.items || []).forEach((item: any) => {
        const id = String(item.product?.id || item.product_id || item.id || item.product?.title || item.title || 'produk')
        const title = String(item.product?.title || item.title || item.product_name || 'Produk')
        const qty = Number(item.qty || item.quantity || 1)
        const price = Number(item.product?.price || item.price || 0)
        const current = map.get(id) || { title, qty: 0, omzet: 0 }
        current.qty += qty
        current.omzet += qty * price
        map.set(id, current)
      })
    })
    return [...map.values()].sort((a, b) => b.qty - a.qty)
  }, [paid])

  function exportCsv() {
    const rows = [
      ['Invoice', 'Tanggal', 'Buyer', 'Status', 'Pembayaran', 'Total'],
      ...filtered.map((order: any) => [
        order.id,
        order.created_at || '',
        order.customer?.name || '',
        order.status || '',
        order.payment_status || '',
        order.total || 0,
      ]),
    ]

    const csv = rows
      .map((row) => row.map((value) => `"${String(value ?? '').split('"').join('""')}"`).join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `laporan-sanzstore25-${new Date().toISOString().slice(0, 10)}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="seller-page seller-reports-page">
      <div className="seller-page-heading">
        <div>
          <span className="seller-eyebrow">ANALITIK PENJUALAN</span>
          <h1>Laporan</h1>
        </div>
        <Button type="button" variant="outline" className="seller-secondary-action gap-2" onClick={exportCsv} disabled={!filtered.length}>
          <Download size={17} /> Export CSV
        </Button>
      </div>

      <Card className="seller-report-filter-card">
        <div className="seller-report-filter-head">
          <div><CalendarRange size={18} /><span>Periode laporan</span></div>
          {(from || to) ? <button type="button" onClick={() => { setFrom(''); setTo('') }}>Reset periode</button> : null}
        </div>
        <div className="seller-report-filter-grid">
          <label className="seller-field"><span>Dari tanggal</span><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
          <label className="seller-field"><span>Sampai tanggal</span><input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
        </div>
      </Card>

      {error ? <p role="alert">Laporan belum berhasil dimuat. Silakan muat ulang halaman.</p> : isLoading ? <p className="seller-loading-text">Memuat laporan...</p> : (
        <>
          <section className="seller-report-metrics">
            <div><span className="seller-report-icon brand"><TrendingUp size={19} /></span><p>Omzet</p><strong>{formatCurrency(omzet)}</strong></div>
            <div><span className="seller-report-icon blue"><ReceiptText size={19} /></span><p>Pesanan dibayar</p><strong>{paid.length}</strong></div>
            <div><span className="seller-report-icon green"><ShoppingBag size={19} /></span><p>Produk terjual</p><strong>{itemsSold}</strong></div>
            <div><span className="seller-report-icon amber"><BarChart3 size={19} /></span><p>Rata-rata order</p><strong>{formatCurrency(averageOrder)}</strong></div>
          </section>

          <div className="seller-report-grid">
            <Card className="seller-report-products-card">
              <div className="seller-card-heading">
                <div><span className="seller-card-kicker">PERFORMA PRODUK</span><h2>Produk Terlaris</h2></div>
                <PackageCheck size={19} />
              </div>

              {bestProducts.length ? (
                <div className="seller-report-product-table">
                  <div className="seller-report-product-header"><span>#</span><span>Produk</span><span>Terjual</span><span>Omzet</span></div>
                  {bestProducts.slice(0, 10).map((product, index) => (
                    <div key={`${product.title}-${index}`} className="seller-report-product-row">
                      <b>{index + 1}</b>
                      <div><strong>{product.title}</strong></div>
                      <span>{product.qty} unit</span>
                      <strong>{formatCurrency(product.omzet)}</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="seller-empty-state compact"><PackageCheck size={26} /><b>Belum ada penjualan</b><span>Data produk akan muncul setelah ada pembayaran berhasil.</span></div>
              )}
            </Card>

            <Card className="seller-report-summary-card">
              <span className="seller-card-kicker">RINGKASAN</span>
              <h2>Aktivitas periode</h2>
              <div className="seller-report-summary-list">
                <div><span>Semua pesanan</span><b>{filtered.length}</b></div>
                <div><span>Berhasil dibayar</span><b>{paid.length}</b></div>
                <div><span>Belum / gagal bayar</span><b>{Math.max(filtered.length - paid.length, 0)}</b></div>
                <div><span>Rasio pembayaran</span><b>{filtered.length ? Math.round((paid.length / filtered.length) * 100) : 0}%</b></div>
              </div>
            </Card>
          </div>
        </>
      )}
    </main>
  )
}

export default ReportsPage
