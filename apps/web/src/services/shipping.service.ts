import { getSupabaseClient } from '@/lib/supabase'
import { env, isSupabaseConfigured } from '@/lib/env'
import type { CartItem } from '@/stores/cart.store'

export interface ShippingRate {
  courier: string
  service: string
  description: string
  cost: number
  etd: string
  courier_service_code?: string
  courier_service_name?: string
}

export function formatShippingLabel(courier?: unknown, service?: unknown) {
  const rawCourier = String(courier ?? '').trim()
  const serviceLabel = String(service ?? '').trim()

  const courierLabel = rawCourier.toLowerCase() === 'jnt'
    ? 'J&T'
    : rawCourier.toUpperCase()

  if (!courierLabel) return serviceLabel || '-'
  if (!serviceLabel) return courierLabel

  const compact = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const courierCompact = compact(courierLabel)
  const serviceCompact = compact(serviceLabel)

  // Biteship kadang mengirim service yang sudah memuat nama kurir,
  // contoh courier=jne + service=JNE Trucking. Hindari "JNE JNE Trucking".
  if (courierCompact && serviceCompact.startsWith(courierCompact)) return serviceLabel

  return `${courierLabel} ${serviceLabel}`
}

function makeItems(items?: CartItem[]) {
  if (!items?.length) {
    return [
      {
        name: 'Produk SanzStore25',
        description: 'Produk',
        value: 100000,
        length: 10,
        width: 10,
        height: 10,
        weight: 1000,
        quantity: 1,
      },
    ]
  }

  return items.map((item) => ({
    name: item.product.title || 'Produk',
    description: item.product.summary || item.product.title || 'Produk',
    value: Math.max(1000, Math.floor(Number(item.product.price || 1000))),
    length: 10,
    width: 10,
    height: 10,
    weight: Math.max(1, Math.floor(Number(item.product.weight || 1000))),
    quantity: Math.max(1, Math.floor(Number(item.qty || 1))),
  }))
}

export async function getShippingRates({
  destinationPostalCode,
  courier,
  items,
}: {
  destinationPostalCode?: string
  weight?: number
  courier?: string
  items?: CartItem[]
}) {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase ENV belum terbaca. Copy .env ke apps/web/.env lalu restart npm run dev.')
  }

  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase client belum aktif.')

  if (!destinationPostalCode) {
    throw new Error('Kode pos tujuan kosong. Edit alamat buyer dan isi kode pos.')
  }

  const { data, error } = await supabase.functions.invoke('biteship-rates', {
    body: {
      destination_postal_code: destinationPostalCode,
      couriers: courier || env.biteshipCouriers,
      items: makeItems(items),
    },
  })

  if (error) throw new Error(error.message || 'Edge Function biteship-rates gagal dipanggil.')
  if (data?.message && !(data?.rates ?? []).length) throw new Error(data.message)

  const rates = (data?.rates ?? []) as ShippingRate[]
  if (!rates.length) throw new Error('Biteship tidak mengembalikan pilihan ongkir untuk kode pos ini.')
  return rates
}
