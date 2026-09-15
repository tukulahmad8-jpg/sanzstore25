import { create } from 'zustand'
import { getSellerSupabaseClient } from '@/lib/supabase'
import { sellerAuthError } from '@/lib/seller-auth-error'

const SELLER_EMAIL = 'admin@sanzstore25.com'

export interface SellerUser {
  id: string
  email: string
}

interface SellerAuthState {
  seller: SellerUser | null
  hydrated: boolean
  hydrate: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

export const useSellerAuthStore = create<SellerAuthState>((set) => ({
  seller: null,
  hydrated: false,

  hydrate: async () => {
    const supabase = getSellerSupabaseClient()
    if (!supabase) {
      set({ seller: null, hydrated: true })
      return
    }

    const { data, error } = await supabase.auth.getSession()
    const authUser = data.session?.user
    const email = String(authUser?.email || '').trim().toLowerCase()

    if (error || !authUser || email !== SELLER_EMAIL) {
      if (authUser) await supabase.auth.signOut()
      set({ seller: null, hydrated: true })
      return
    }

    set({ seller: { id: authUser.id, email }, hydrated: true })
  },

  login: async (email, password) => {
    const normalizedEmail = email.trim().toLowerCase()
    if (normalizedEmail !== SELLER_EMAIL) {
      throw new Error('Email ini tidak memiliki akses ke Seller Center.')
    }

    const supabase = getSellerSupabaseClient()
    if (!supabase) throw new Error(sellerAuthError(null))

    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    }).catch((error: unknown) => { throw new Error(sellerAuthError(error)) })

    if (error || !data.user) {
      throw new Error(sellerAuthError(error))
    }

    const authenticatedEmail = String(data.user.email || '').trim().toLowerCase()
    if (authenticatedEmail !== SELLER_EMAIL) {
      await supabase.auth.signOut()
      throw new Error('Akun ini tidak memiliki akses ke Seller Center.')
    }

    set({
      seller: { id: data.user.id, email: authenticatedEmail },
      hydrated: true,
    })
  },

  logout: async () => {
    const supabase = getSellerSupabaseClient()
    if (supabase) {
      const { error } = await supabase.auth.signOut()
      if (error) throw new Error('Logout belum berhasil. Periksa koneksi Anda lalu coba lagi.')
    }
    set({ seller: null, hydrated: true })
  },
}))
