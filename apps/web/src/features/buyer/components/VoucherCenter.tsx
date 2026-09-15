import type { Voucher } from '@/types/domain'
import { formatCurrency } from '@/utils/format'

export function VoucherCenter({ vouchers }: { vouchers: Voucher[] }) {
  const active = vouchers.filter((voucher) => voucher.status === 'Aktif').slice(0, 4)
  if (!active.length) return null

  return (
    <section className="mb-8">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight">Voucher Center</h2>
          <p className="text-[var(--muted)]">Pakai voucher saat checkout.</p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {active.map((voucher) => (
          <div key={voucher.id} className="rounded-2xl border border-brand/30 bg-brand/10 p-4">
            <b className="text-brand">{voucher.code}</b>
            <p className="mt-1 text-sm font-bold">{voucher.name || 'Voucher SanzStore25'}</p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {voucher.type === 'percent' ? `${voucher.value}%` : formatCurrency(voucher.value)} • Min {formatCurrency(voucher.min_purchase)}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
