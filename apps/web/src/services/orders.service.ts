import { getSellerSupabaseClient, getSupabaseClient } from '@/lib/supabase'
import type { Order } from '@/types/domain'

const LOCAL_KEY = 'sanz-orders-fallback'

type OrderPatch = Partial<Order> & Record<string, unknown>

type CreateOrderInput = Order & {
  user_id?: string
  buyer_id?: string
  buyer_email?: string
  buyer_phone?: string
  seller_id?: string
  payment_status?: string
  payment_reference?: string
  payment_url?: string
  shipment_status?: string
  courier_code?: string
  courier_service?: string
  payment_expires_at?: string | null
}

function getLocalOrders(): Order[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '[]') as Order[]
  } catch {
    return []
  }
}

function setLocalOrders(orders: Order[]) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(orders))
}

function normalizeOrder(order: CreateOrderInput): CreateOrderInput {
  const customer = (order.customer ?? {}) as Record<string, unknown>
  const buyerPhone = String(order.buyer_phone ?? customer.phone ?? customer.whatsapp ?? '')
  const buyerEmail = String(order.buyer_email ?? customer.email ?? '')
  const buyerId = String(order.buyer_id ?? order.user_id ?? buyerEmail ?? buyerPhone)
  return {
    ...order,
    user_id: String(order.user_id ?? buyerId),
    buyer_id: buyerId,
    buyer_email: buyerEmail,
    buyer_phone: buyerPhone,
    seller_id: order.seller_id ?? 'sanzstore25',
    payment_status: order.payment_status ?? 'pending',
    shipment_status: order.shipment_status ?? 'pending',
    status: order.status ?? 'Belum Bayar',
  }
}

/** Only columns that really exist in public.orders are sent to Supabase. */
function toDatabaseRow(order: CreateOrderInput) {
  const shipping = (order.shipping ?? {}) as Record<string, unknown>
  return {
    id: order.id,
    user_id: order.user_id,
    buyer_id: order.buyer_id || null,
    buyer_email: order.buyer_email || null,
    buyer_phone: order.buyer_phone || null,
    seller_id: order.seller_id || 'sanzstore25',
    customer: order.customer ?? {},
    items: order.items ?? [],
    subtotal: Number(order.subtotal || 0),
    shipping,
    total: Number(order.total || 0),
    status: order.status || 'Belum Bayar',
    payment_status: order.payment_status || 'pending',
    payment_reference: order.payment_reference || null,
    payment_url: order.payment_url || null,
    payment_expires_at: order.payment_expires_at || null,
    shipment_status: order.shipment_status || 'pending',
    courier_code: order.courier_code || String(shipping.courier_code ?? shipping.courier ?? shipping.company ?? ''),
    courier_service: order.courier_service || String(shipping.courier_service ?? shipping.service ?? shipping.type ?? ''),
    resi: order.resi || null,
    updated_at: new Date().toISOString(),
  }
}

function toDatabasePatch(patch: OrderPatch) {
  const allowed = new Set([
    'buyer_id', 'buyer_email', 'buyer_phone', 'seller_id', 'customer', 'items', 'subtotal',
    'shipping', 'total', 'status', 'payment_status', 'payment_reference', 'payment_url',
    'shipment_status', 'courier_code', 'courier_service', 'resi', 'refund', 'paid_at',
    'shipped_at', 'completed_at', 'cancelled_at', 'cancellation_reason', 'payment_expires_at',
    'biteship_order_id', 'biteship_tracking_id', 'biteship_status', 'biteship_tracking_url',
    'biteship_raw', 'shipment_created_at',
  ])
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const [key, value] of Object.entries(patch)) {
    if (allowed.has(key)) row[key] = value
  }
  return row
}

export async function getOrders() {
  const supabase = getSupabaseClient()
  if (!supabase) return { data: getLocalOrders() }

  const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false })
  if (error) throw new Error(`Gagal mengambil pesanan: ${error.message}`)
  return { data: (data ?? []) as Order[] }
}

// Satu pesanan saja (dipakai halaman pembayaran). Jauh lebih ringan daripada getOrders().
export async function getOrderById(orderId: string) {
  const supabase = getSupabaseClient()
  if (!supabase) return { data: getLocalOrders().find((order) => order.id === orderId) ?? null }

  const { data, error } = await supabase.from('orders').select('*').eq('id', orderId).maybeSingle()
  if (error) throw new Error(`Gagal mengambil pesanan: ${error.message}`)
  return { data: (data ?? null) as Order | null }
}

export async function getBuyerOrders(identity?: string) {
  const supabase = getSupabaseClient()
  const local = getLocalOrders().filter((order: any) => !identity
    || order.buyer_id === identity
    || order.buyer_phone === identity
    || order.buyer_email === identity
    || order.customer?.phone === identity
    || order.customer?.email === identity)
  if (!supabase) return { data: local }

  let query = supabase.from('orders').select('*').order('created_at', { ascending: false })
  if (identity) {
    const safe = identity.replace(/,/g, '')
    query = query.or(`buyer_id.eq.${safe},buyer_phone.eq.${safe},buyer_email.eq.${safe},user_id.eq.${safe}`)
  }
  const { data, error } = await query
  if (error) throw new Error(`Gagal mengambil pesanan buyer: ${error.message}`)
  return { data: (data ?? []) as Order[] }
}

export async function getSellerOrders() {
  const supabase = getSellerSupabaseClient()
  if (!supabase) return { data: getLocalOrders() }

  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('seller_id', 'sanzstore25')
    .order('created_at', { ascending: false })
  if (error) throw new Error(`Gagal mengambil pesanan seller: ${error.message}`)
  return { data: (data ?? []) as Order[] }
}

export async function createOrder(order: CreateOrderInput) {
  const normalized = normalizeOrder(order)
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase belum dikonfigurasi. Checkout production membutuhkan Supabase Auth.')

  const customer = (normalized.customer ?? {}) as Record<string, unknown>
  const shipping = (normalized.shipping ?? {}) as Record<string, unknown>
  const voucher = ((normalized as any).voucher ?? {}) as Record<string, unknown>

  const { data, error } = await supabase.functions.invoke('checkout-create-order', {
    body: {
      order_id: normalized.id,
      buyer_email: normalized.buyer_email || '',
      buyer_phone: normalized.buyer_phone || '',
      customer,
      items: normalized.items ?? [],
      destination_postal_code: String(customer.postalCode ?? customer.postal_code ?? ''),
      shipping,
      voucher_code: String(voucher.code ?? ''),
      payment_expires_at: normalized.payment_expires_at || null,
    },
  })

  if (error) throw new Error(error.message || 'Checkout server gagal dipanggil.')
  if (!data?.ok || !data?.order) throw new Error(data?.message || 'Pesanan gagal dibuat dan stok belum direservasi.')

  const created = data.order as Order
  setLocalOrders([created, ...getLocalOrders().filter((item) => item.id !== created.id)])
  return { data: created, persisted: true }
}

export async function cancelBuyerOrder(orderId: string) {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase belum dikonfigurasi.')
  const { data, error } = await supabase.rpc('cancel_order_for_buyer', { p_order_id: orderId })
  if (error) throw new Error(error.message || 'Pesanan gagal dibatalkan.')
  const updated = data as Order
  setLocalOrders(getLocalOrders().map((order) => order.id === orderId ? updated : order))
  return { data: updated }
}

export async function completeBuyerOrder(orderId: string) {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase belum dikonfigurasi.')
  const { data, error } = await supabase.rpc('complete_order_for_buyer', { p_order_id: orderId })
  if (error) throw new Error(error.message || 'Pesanan gagal diselesaikan.')
  const updated = data as Order
  setLocalOrders(getLocalOrders().map((order) => order.id === orderId ? updated : order))
  return { data: updated }
}

export async function updateSellerOrder(orderId: string, patch: OrderPatch) {
  const supabase = getSellerSupabaseClient()
  if (!supabase) throw new Error('Supabase seller belum dikonfigurasi.')

  // Seller UI is intentionally prevented from changing payment state directly.
  const blocked = new Set(['status', 'payment_status', 'paid_at', 'payment_reference', 'payment_url', 'total', 'subtotal', 'items', 'user_id', 'buyer_id'])
  const safePatch: OrderPatch = {}
  for (const [key, value] of Object.entries(patch)) if (!blocked.has(key)) safePatch[key] = value

  const dbPatch = toDatabasePatch(safePatch)
  const { data, error } = await supabase.from('orders').update(dbPatch).eq('id', orderId).select('*').single()
  if (error) throw new Error(`Pesanan seller gagal diperbarui: ${error.message}`)
  return { data: data as Order }
}



export async function processSellerOrder(orderId: string) {
  const supabase = getSellerSupabaseClient()
  if (!supabase) throw new Error('Supabase seller belum dikonfigurasi.')
  const { data, error } = await supabase.functions.invoke('seller-process-order', { body: { order_id: orderId } })
  if (error) throw new Error(error.message || 'Proses pesanan seller gagal dipanggil.')
  if (!data?.ok) throw new Error(data?.message || 'Pesanan gagal diproses.')
  return data as { ok: true; action: 'processed' | 'already_processed'; message: string; order: Order }
}

export async function cancelSellerOrder(orderId: string, reason: string) {
  const supabase = getSellerSupabaseClient()
  if (!supabase) throw new Error('Supabase seller belum dikonfigurasi.')
  const { data, error } = await supabase.functions.invoke('seller-cancel-order', { body: { order_id: orderId, reason } })
  if (error) throw new Error(error.message || 'Pembatalan seller gagal dipanggil.')
  if (!data?.ok) throw new Error(data?.message || 'Pesanan gagal dibatalkan.')
  return data as { ok: true; action: 'cancelled' | 'refund_pending' | 'shipment_cancel_pending' | 'already_cancelled'; message: string; order: Order }
}

export async function completeSellerRefund(orderId: string, reference: string, note: string) {
  const supabase = getSellerSupabaseClient()
  if (!supabase) throw new Error('Supabase seller belum dikonfigurasi.')
  const { data, error } = await supabase.functions.invoke('seller-complete-refund', {
    body: { order_id: orderId, reference, note },
  })
  if (error) throw new Error(error.message || 'Penyelesaian refund gagal dipanggil.')
  if (!data?.ok) throw new Error(data?.message || 'Refund gagal diselesaikan.')
  return data as { ok: true; message: string; order: Order }
}


export async function submitBuyerRefundDestination(orderId: string, destination: { type: 'bank' | 'ewallet'; provider: string; account_number: string; account_name: string }) {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase belum dikonfigurasi.')
  const { data, error } = await supabase.functions.invoke('buyer-submit-refund-destination', {
    body: { order_id: orderId, destination },
  })
  if (error) throw new Error(error.message || 'Data tujuan refund gagal dikirim.')
  if (!data?.ok) throw new Error(data?.message || 'Data tujuan refund gagal disimpan.')
  return data as { ok: true; message: string; order: Order }
}
