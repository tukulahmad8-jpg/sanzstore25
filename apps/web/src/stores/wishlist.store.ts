import { create } from 'zustand'
import { useAuthStore } from '@/stores/auth.store'

interface WishlistState {
  ids: string[]
  hydrate: () => void
  has: (productId: string) => boolean
  add: (productId: string) => void
  toggle: (productId: string) => void
  remove: (productId: string) => void
  clear: () => void
}

function storageKey() {
  return `sanzstore25-wishlist-v2:${useAuthStore.getState().user?.id ?? 'guest'}`
}

function readWishlist(): string[] {
  try {
    const raw = localStorage.getItem(storageKey())
    const parsed = raw ? JSON.parse(raw) : []

    if (!Array.isArray(parsed)) return []

    return Array.from(
      new Set(
        parsed.filter(
          (item): item is string =>
            typeof item === 'string' && item.trim().length > 0,
        ),
      ),
    )
  } catch {
    return []
  }
}

function saveWishlist(ids: string[]) {
  const next = Array.from(new Set(ids.filter(Boolean)))
  localStorage.setItem(storageKey(), JSON.stringify(next))
  return next
}

export const useWishlistStore = create<WishlistState>((set, get) => ({
  ids: readWishlist(),

  hydrate: () => {
    set({ ids: readWishlist() })
  },

  has: (productId) => get().ids.includes(productId),

  add: (productId) => {
    if (!productId || get().ids.includes(productId)) return
    set({ ids: saveWishlist([...get().ids, productId]) })
  },

  toggle: (productId) => {
    if (!productId) return

    const exists = get().ids.includes(productId)

    if (exists) {
      set({
        ids: saveWishlist(
          get().ids.filter((id) => id !== productId),
        ),
      })
      return
    }

    set({
      ids: saveWishlist([...get().ids, productId]),
    })
  },

  remove: (productId) => {
    set({
      ids: saveWishlist(
        get().ids.filter((id) => id !== productId),
      ),
    })
  },

  clear: () => {
    set({ ids: saveWishlist([]) })
  },
}))

useAuthStore.subscribe((state, previous) => {
  if (state.user?.id === previous.user?.id) return
  // Login: gabungkan wishlist tamu ke wishlist akun, lalu kosongkan wishlist tamu.
  if (state.user?.id && !previous.user?.id) {
    try {
      const guestKey = 'sanzstore25-wishlist-v2:guest'
      const accountKey = `sanzstore25-wishlist-v2:${state.user.id}`
      const guest = JSON.parse(localStorage.getItem(guestKey) ?? '[]')
      const account = JSON.parse(localStorage.getItem(accountKey) ?? '[]')
      if (Array.isArray(guest) && guest.length) {
        const merged = Array.from(new Set([...(Array.isArray(account) ? account : []), ...guest].filter((id) => typeof id === 'string' && id.trim())))
        localStorage.setItem(accountKey, JSON.stringify(merged))
        localStorage.removeItem(guestKey)
      }
    } catch {
      // abaikan: wishlist akun tetap dimuat
    }
  }
  useWishlistStore.getState().hydrate()
})
