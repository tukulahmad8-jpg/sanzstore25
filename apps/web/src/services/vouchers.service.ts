import { getSupabaseClient } from '@/lib/supabase'

export interface Voucher {
  id: string
  code: string
  name: string
  type: 'percent' | 'fixed' | 'shipping'
  value: number
  max_discount?: number
  min_purchase?: number
  status: string
  start_at?: string | null
  end_at?: string | null
  quota?: number | null
  used_count?: number | null
}

const fallback: Voucher[] = [
  {
    id: 'sanzhemat',
    code: 'SANZHEMAT',
    name: 'Diskon Hemat SanzStore25',
    type: 'percent',
    value: 10,
    max_discount: 20000,
    min_purchase: 100000,
    status: 'Aktif',
  },
]

export async function getVouchers() {
  const supabase = getSupabaseClient()
  if (!supabase) return { data: fallback }

  const { data, error } = await supabase.from('vouchers').select('*').eq('status', 'Aktif')

  if (error) {
    console.warn('[vouchers:supabase]', error.message)
    return { data: [] as Voucher[] }
  }

  return { data: (data ?? []) as Voucher[] }
}

export function voucherError(voucher: Voucher | null | undefined, subtotal: number, now = Date.now()) {
  if (!voucher) return 'Kode voucher tidak ditemukan.'
  if (voucher.status !== 'Aktif') return 'Voucher tidak aktif.'
  if (voucher.start_at && new Date(voucher.start_at).getTime() > now) return 'Voucher belum berlaku.'
  if (voucher.end_at && new Date(voucher.end_at).getTime() < now) return 'Voucher sudah kedaluwarsa.'
  if (Number(voucher.quota) > 0 && Number(voucher.used_count || 0) >= Number(voucher.quota)) return 'Kuota voucher sudah habis.'
  if (subtotal < Number(voucher.min_purchase || 0)) return 'Belanja belum memenuhi minimum voucher.'
  return ''
}

export function applyVoucher(voucher: Voucher | null, subtotal: number, shipping = 0) {
  if (!voucher || voucherError(voucher, subtotal)) return 0
  if (voucher.min_purchase && subtotal < voucher.min_purchase) return 0

  if (voucher.type === 'percent') {
    const value = Math.floor((subtotal * voucher.value) / 100)
    return Math.min(value, voucher.max_discount || value)
  }

  if (voucher.type === 'shipping') {
    return Math.min(shipping, voucher.value)
  }

  return voucher.value
}
