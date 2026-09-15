export type ProductStatus = 'Aktif' | 'Nonaktif'

export interface ProductVariant {
  id: string
  name: string
  sku?: string
  price: number
  stock: number
  weight?: number
  image?: string
}

export interface Product {
  id: string
  title: string
  category: string
  price: number
  cost_price?: number
  stock: number
  weight: number
  rack?: string
  supplier?: Record<string, unknown>
  image: string
  images: string[]
  summary: string
  badge?: string
  status: ProductStatus
  sold: number
  has_variants?: boolean
  variants?: ProductVariant[]
  selected_variant?: ProductVariant
  updated_at?: string
}

export interface CartItem {
  productId: string
  qty: number
  checked: boolean
  note?: string
}

export interface CustomerProfile {
  name?: string
  email?: string
  phone?: string
  city?: string
  address?: string
}

export type OrderStatus = 'Belum Bayar' | 'Dibayar' | 'Packing' | 'Dikirim' | 'Selesai' | 'Refund' | 'Dibatalkan'

export interface OrderLine {
  product: Product
  qty: number
  note?: string
}

export interface Order {
  id: string
  customer: CustomerProfile
  items: OrderLine[]
  subtotal: number
  shipping_cost: number
  discount: number
  total: number
  status: OrderStatus
  payment?: Record<string, unknown>
  shipping?: Record<string, unknown>
  voucher?: Record<string, unknown>
  resi?: string
  biteship_order_id?: string
  biteship_tracking_id?: string
  biteship_status?: string
  biteship_tracking_url?: string
  shipment_created_at?: string
  notes?: string
  created_at?: string
  payment_expires_at?: string | null
  payment_status?: string
  payment_url?: string
  payment_reference?: string
  cancelled_at?: string
  cancellation_reason?: string
}

export type VoucherType = 'percent' | 'fixed' | 'shipping'

export interface Voucher {
  id: string
  code: string
  name: string
  type: VoucherType
  value: number
  max_discount: number
  min_purchase: number
  quota: number
  used_count: number
  status: 'Aktif' | 'Nonaktif'
  start_at?: string
  end_at?: string | null
}

export interface ShippingQuote {
  name: string
  cost: number
  etd: string
}

export type PaymentMethod = 'qris' | 'bank_transfer' | 'dana' | 'ovo' | 'gopay' | 'shopeepay'
