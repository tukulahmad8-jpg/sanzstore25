import { useEffect, useState } from 'react'
import { confirmAction } from '@/lib/notify'
import { Link } from 'react-router-dom'
import { Button } from '@/components/common/Button'
import { loadBuyerOrderList } from '@/services/order-query.service'
import { cancelBuyerOrder } from '@/services/orders.service'
import type { Order } from '@/types/domain'

function rupiah(value: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value || 0))
}

function statusLabel(order: any) {
  if (order.payment_status === 'paid') return 'Dibayar'
  if (order.payment_status === 'cancelled' || order.status === 'Dibatalkan') return 'Dibatalkan'
  return 'Belum Bayar'
}

export function BuyerOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  async function refresh() {
    setLoading(true)
    await loadBuyerOrderList().then((res) => setOrders((res.data || []) as Order[])).finally(() => setLoading(false))
  }

  useEffect(() => { void refresh() }, [])

  async function cancelOrder(order: any) {
    if (!(await confirmAction('Batalkan pesanan ini?', { confirmText: 'Batalkan pesanan', danger: true }))) return
    await cancelBuyerOrder(order.id)
    await refresh()
  }

  if (loading) return <main className="p-6"><p>Memuat pesanan...</p></main>

  return (
    <main className="p-6">
      <div className="mb-5">
        <p className="font-bold text-brand">Buyer Center</p>
        <h1 className="text-3xl font-bold">Pesanan Saya</h1>
      </div>
      {!orders.length ? <div className="rounded-2xl border border-dashed p-8 text-center text-[var(--muted)]">Belum ada pesanan. Checkout dulu, nanti pesanan muncul di sini.</div> : null}
      <div className="grid gap-4">
        {orders.map((order: any) => {
          const paid = order.payment_status === 'paid'
          const cancelled = order.payment_status === 'cancelled' || order.status === 'Dibatalkan'
          return (
            <article className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-soft" key={order.id}>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--line)] pb-3">
                <div><strong>{order.id}</strong><p className="text-sm text-[var(--muted)]">{order.items?.length || 0} produk</p></div>
                <span className="rounded-full bg-brand/10 px-3 py-1 text-sm font-bold text-brand">{statusLabel(order)}</span>
              </div>
              <div className="mt-3 grid gap-3">
                {(order.items || []).slice(0, 2).map((item: any, index: number) => (
                  <div key={`${order.id}-${index}`} className="flex gap-3">
                    <Link to={`/product/${item.product?.id}`} className="block h-16 w-16 overflow-hidden rounded-xl bg-[var(--surface-2)]"><img src={item.product?.image || '/placeholder.svg'} className="h-full w-full object-contain transition hover:scale-[1.03]" /></Link>
                    <div className="min-w-0 flex-1"><Link to={`/product/${item.product?.id}`} className="line-clamp-1 font-semibold hover:text-brand">{item.product?.title || 'Produk'}</Link>{item.product?.selected_variant ? <p className="mt-1 text-xs font-semibold text-brand">Varian: {item.product.selected_variant.name}</p> : null}<p className="text-sm text-[var(--muted)]">Qty {item.qty}</p></div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <b className="text-xl text-brand">{rupiah(order.total)}</b>
                <div className="flex flex-wrap gap-2">
                  {!paid && !cancelled ? <Link to={`/payment/${order.id}?amount=${order.total}&name=${encodeURIComponent(order.customer?.name || 'Buyer')}&invoice=${order.id}`} className="rounded-xl bg-brand px-4 py-2 font-bold text-white">Bayar Sekarang</Link> : null}
                  {!paid && !cancelled ? <Button type="button" variant="outline" onClick={() => cancelOrder(order)}>Batalkan</Button> : null}
                  <Button type="button" variant="outline">Lihat Detail</Button>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </main>
  )
}

export default BuyerOrdersPage
