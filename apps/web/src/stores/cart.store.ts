import { create } from 'zustand'
import { useAuthStore } from '@/stores/auth.store'
import type { Product } from '@/types/domain'

export interface CartItem {
  product: Product
  qty: number
  note?: string
  selected?: boolean
}

interface CartState {
  items: CartItem[]
  hydrate: () => void
  syncProducts: (products: Product[]) => void
  add: (product: Product, qty?: number) => void
  addItem: (product: Product, qty?: number) => void
  addToCart: (product: Product, qty?: number) => void
  buyNow: (product: Product, qty?: number) => void
  increase: (lineKey: string) => void
  increment: (lineKey: string) => void
  decrease: (lineKey: string) => void
  decrement: (lineKey: string) => void
  updateQty: (lineKey: string, qty: number) => void
  updateNote: (lineKey: string, note: string) => void
  toggleSelect: (lineKey: string) => void
  selectAll: () => void
  unselectAll: () => void
  remove: (lineKey: string) => void
  removeItem: (lineKey: string) => void
  removeFromCart: (lineKey: string) => void
  removeSelected: () => void
  clear: () => void
}

function storageKeys() {
  return [`sanz-cart-v5:${useAuthStore.getState().user?.id ?? 'guest'}`]
}

export function cartItemKey(itemOrProduct: CartItem | Product) {
  const product = 'product' in itemOrProduct ? itemOrProduct.product : itemOrProduct
  return `${product.id}::${product.selected_variant?.id ?? 'base'}`
}

export function getCartLineStock(product: Product) {
  if (product.selected_variant) return Math.max(0, Number(product.selected_variant.stock ?? 0))
  return Math.max(0, Number(product.stock ?? 0))
}

function valid(item: unknown): item is CartItem {
  const it = item as CartItem
  return Boolean(it?.product?.id && typeof it.product.price === 'number' && Number(it.qty) > 0)
}

function normalize(items: CartItem[]) {
  return items.filter(valid).map((item) => ({
    ...item,
    qty: Math.max(1, Math.floor(Number(item.qty || 1))),
    selected: item.selected !== false,
    note: item.note ?? '',
  }))
}

function read() {
  // Legacy shared carts have no reliable owner. Preserve them on disk, but never
  // import them into an authenticated account automatically.
  for (const key of storageKeys()) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) ?? '[]') as CartItem[]
      const normalized = normalize(Array.isArray(parsed) ? parsed : [])
      if (normalized.length) return normalized
    } catch {
      // Try the next legacy key.
    }
  }
  return []
}

function write(items: CartItem[]) {
  const next = normalize(items)
  for (const key of storageKeys()) localStorage.setItem(key, JSON.stringify(next))
  return next
}

function withLiveProduct(snapshot: Product, live: Product) {
  const selectedId = snapshot.selected_variant?.id
  if (!selectedId) return { ...live, selected_variant: undefined }

  const liveVariant = (live.variants ?? []).find((variant) => variant.id === selectedId)
  return {
    ...live,
    // A variant removed by the seller must immediately become unavailable in cart.
    selected_variant: liveVariant
      ? { ...liveVariant }
      : { ...snapshot.selected_variant!, stock: 0 },
  }
}

/**
 * Replace product snapshots stored in localStorage with the current database rows.
 * The cart intentionally keeps qty/note, but unavailable items are deselected and
 * quantities above the current stock are clamped.
 */
export function reconcileCartItems(items: CartItem[], products: Product[]) {
  const catalog = new Map(products.map((product) => [product.id, product]))

  return normalize(items).map((item) => {
    const live = catalog.get(item.product.id)
    if (!live) {
      const product = {
        ...item.product,
        stock: 0,
        status: 'Nonaktif' as const,
        selected_variant: item.product.selected_variant
          ? { ...item.product.selected_variant, stock: 0 }
          : undefined,
      }
      return { ...item, product, selected: false }
    }

    const product = withLiveProduct(item.product, live)
    const stock = getCartLineStock(product)
    const qty = stock > 0 ? Math.min(item.qty, stock) : item.qty
    const selected = Boolean(item.selected) && stock > 0 && String(product.status || '').toLowerCase() === 'aktif'
    return { ...item, product, qty, selected }
  })
}

function upsert(items: CartItem[], product: Product, qty = 1, onlyThis = false) {
  if (!product?.id || typeof product.price !== 'number') return normalize(items)
  const base = onlyThis ? [] : normalize(items)
  const key = cartItemKey(product)
  const stock = getCartLineStock(product)
  if (stock <= 0 || String(product.status || '').toLowerCase() !== 'aktif') return base

  const existing = base.find((item) => cartItemKey(item) === key)
  if (existing) {
    return base.map((item) => cartItemKey(item) === key
      ? { ...item, product, qty: Math.min(stock, item.qty + Math.max(1, qty)), selected: true }
      : item)
  }
  return [...base, { product, qty: Math.min(stock, Math.max(1, qty)), selected: true, note: '' }]
}

export const useCartStore = create<CartState>((set, get) => ({
  items: read(),
  hydrate: () => set({ items: read() }),
  syncProducts: (products) => {
    const next = write(reconcileCartItems(get().items, products))
    set({ items: next })
  },
  add: (product, qty = 1) => { const next = write(upsert(get().items, product, qty)); set({ items: next }) },
  addItem: (product, qty = 1) => get().add(product, qty),
  addToCart: (product, qty = 1) => get().add(product, qty),
  buyNow: (product, qty = 1) => { const next = write(upsert(get().items, product, qty, true)); set({ items: next }) },
  increase: (key) => {
    const next = write(normalize(get().items).map((item) => {
      if (cartItemKey(item) !== key) return item
      const stock = getCartLineStock(item.product)
      if (stock <= 0) return { ...item, selected: false }
      return { ...item, qty: Math.min(stock, item.qty + 1) }
    }))
    set({ items: next })
  },
  increment: (key) => get().increase(key),
  decrease: (key) => { const next = write(normalize(get().items).map((item) => cartItemKey(item) === key ? { ...item, qty: item.qty - 1 } : item).filter((item) => item.qty > 0)); set({ items: next }) },
  decrement: (key) => get().decrease(key),
  updateQty: (key, qty) => {
    const next = write(normalize(get().items).map((item) => {
      if (cartItemKey(item) !== key) return item
      const stock = getCartLineStock(item.product)
      if (stock <= 0) return { ...item, selected: false }
      return { ...item, qty: Math.min(stock, Math.floor(Number(qty || 0))) }
    }).filter((item) => item.qty > 0))
    set({ items: next })
  },
  updateNote: (key, note) => { const next = write(normalize(get().items).map((item) => cartItemKey(item) === key ? { ...item, note } : item)); set({ items: next }) },
  toggleSelect: (key) => {
    const next = write(normalize(get().items).map((item) => {
      if (cartItemKey(item) !== key) return item
      if (getCartLineStock(item.product) <= 0 || String(item.product.status || '').toLowerCase() !== 'aktif') return { ...item, selected: false }
      return { ...item, selected: !item.selected }
    }))
    set({ items: next })
  },
  selectAll: () => {
    const next = write(normalize(get().items).map((item) => ({
      ...item,
      selected: getCartLineStock(item.product) > 0 && String(item.product.status || '').toLowerCase() === 'aktif',
    })))
    set({ items: next })
  },
  unselectAll: () => { const next = write(normalize(get().items).map((item) => ({ ...item, selected: false }))); set({ items: next }) },
  remove: (key) => { const next = write(normalize(get().items).filter((item) => cartItemKey(item) !== key)); set({ items: next }) },
  removeItem: (key) => get().remove(key),
  removeFromCart: (key) => get().remove(key),
  removeSelected: () => { const next = write(normalize(get().items).filter((item) => !item.selected)); set({ items: next }) },
  clear: () => { const next = write([]); set({ items: next }) },
}))

// Saat pengunjung login, pindahkan isi keranjang tamu ke keranjang akunnya (jumlah yang sama
// digabung dengan mengambil yang lebih besar), lalu kosongkan keranjang tamu. Tanpa ini,
// pembeli yang menambah produk sebelum login melihat keranjangnya kosong setelah login.
function mergeGuestCartIntoAccount(userId: string) {
  try {
    const guestKey = 'sanz-cart-v5:guest'
    const accountKey = `sanz-cart-v5:${userId}`
    const guest = normalize(JSON.parse(localStorage.getItem(guestKey) ?? '[]') as CartItem[])
    if (!guest.length) return

    const account = normalize(JSON.parse(localStorage.getItem(accountKey) ?? '[]') as CartItem[])
    const merged = new Map<string, CartItem>()
    for (const item of account) merged.set(cartItemKey(item), item)
    for (const item of guest) {
      const key = cartItemKey(item)
      const existing = merged.get(key)
      merged.set(key, existing ? { ...existing, qty: Math.max(existing.qty, item.qty) } : item)
    }

    localStorage.setItem(accountKey, JSON.stringify(Array.from(merged.values())))
    localStorage.removeItem(guestKey)
  } catch {
    // Data keranjang rusak atau penyimpanan tidak tersedia: lewati, keranjang akun tetap dimuat.
  }
}

useAuthStore.subscribe((state, previous) => {
  if (state.user?.id === previous.user?.id) return
  if (state.user?.id && !previous.user?.id) mergeGuestCartIntoAccount(state.user.id)
  useCartStore.getState().hydrate()
})
