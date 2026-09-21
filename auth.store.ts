import { create } from 'zustand'
import { getSupabaseClient } from '@/lib/supabase'
import { env, isSupabaseConfigured } from '@/lib/env'

export interface BuyerUser {
  id: string
  name: string
  email: string
  phone: string
}

type StoredUser = BuyerUser & { password: string }

interface AuthState {
  user: BuyerUser | null
  hydrate: () => Promise<void>
  login: (identity: string, password: string) => Promise<void>
  register: (payload: { name: string; email: string; phone: string; password: string }) => Promise<{ requiresEmailConfirmation: boolean }>
  updateProfile: (payload: { name: string; phone: string }) => Promise<void>
  resendSignupConfirmation: (email: string) => Promise<void>
  requestPasswordReset: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
  logout: () => Promise<void>
}

const SESSION_KEY = 'sanz-buyer-session'
const USERS_KEY = 'sanz-buyer-users'

function createClientId() {
  if (typeof crypto !== 'undefined') {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
    if (typeof crypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(16)
      crypto.getRandomValues(bytes)
      bytes[6] = (bytes[6] & 0x0f) | 0x40
      bytes[8] = (bytes[8] & 0x3f) | 0x80
      const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('')
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
    }
  }
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

function useSupabaseAuth() {
  return Boolean(import.meta.env.PROD || env.authMode === 'supabase')
}

function getUsers(): StoredUser[] {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) ?? '[]') as StoredUser[]
  } catch {
    return []
  }
}

function saveUsers(users: StoredUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

function saveLocalSession(user: BuyerUser | null) {
  if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user))
  else localStorage.removeItem(SESSION_KEY)
}

function toBuyerUser(authUser: any, fallback?: Partial<BuyerUser>): BuyerUser {
  return {
    id: String(authUser?.id || fallback?.id || createClientId()),
    name: String(
      authUser?.user_metadata?.name ||
      fallback?.name ||
      authUser?.email ||
      'Pembeli'
    ),
    email: String(authUser?.email || fallback?.email || ''),
    phone: String(
      authUser?.user_metadata?.phone ||
      fallback?.phone ||
      ''
    ),
  }
}

function mapRegisterError(message?: string) {
  const normalized = String(message || '').toLowerCase()

  if (
    normalized.includes('already registered') ||
    normalized.includes('already been registered') ||
    normalized.includes('user already exists') ||
    normalized.includes('email already exists') ||
    normalized.includes('email address is already') ||
    normalized.includes('duplicate')
  ) {
    return 'Email ini sudah digunakan. Silakan login atau gunakan email lain.'
  }

  if (normalized.includes('invalid email')) {
    return 'Format email tidak valid.'
  }

  if (normalized.includes('password')) {
    return message || 'Password tidak memenuhi ketentuan.'
  }

  return message || 'Daftar gagal.'
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,

  hydrate: async () => {
    if (useSupabaseAuth()) {
      const supabase = getSupabaseClient()
      if (!supabase) {
        set({ user: null })
        return
      }

      const { data } = await supabase.auth.getUser()
      const authUser = data.user

      if (!authUser) {
        set({ user: null })
        return
      }

      const user = toBuyerUser(authUser)
      saveLocalSession(user)
      set({ user })
      return
    }

    try {
      set({
        user: JSON.parse(
          localStorage.getItem(SESSION_KEY) ?? 'null'
        ) as BuyerUser | null,
      })
    } catch {
      set({ user: null })
    }
  },

  login: async (identity, password) => {
    if (useSupabaseAuth()) {
      const supabase = getSupabaseClient()
      if (!supabase) throw new Error('Supabase belum dikonfigurasi.')

      const email = identity.trim().toLowerCase()
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error || !data.user) {
        throw new Error(error?.message || 'Login gagal.')
      }

      const user = toBuyerUser(data.user)
      saveLocalSession(user)
      set({ user })
      return
    }

    const value = identity.trim().toLowerCase()
    const found = getUsers().find((item) => {
      return (
        (item.email.toLowerCase() === value ||
          item.phone === identity.trim()) &&
        item.password === password
      )
    })

    if (!found) {
      throw new Error('Email/WhatsApp atau password salah.')
    }

    const user = {
      id: found.id,
      name: found.name,
      email: found.email,
      phone: found.phone,
    }

    saveLocalSession(user)
    set({ user })
  },

  register: async (payload) => {
    const email = payload.email.trim().toLowerCase()
    const phone = payload.phone.trim()
    const name = payload.name.trim()

    if (!name) throw new Error('Nama wajib diisi.')
    if (!email) throw new Error('Email wajib diisi.')
    if (!phone) throw new Error('WhatsApp wajib diisi.')
    if (payload.password.length < 8) {
      throw new Error('Password minimal 8 karakter.')
    }

    if (useSupabaseAuth()) {
      const supabase = getSupabaseClient()
      if (!supabase) throw new Error('Supabase belum dikonfigurasi.')

      const { data, error } = await supabase.auth.signUp({
        email,
        password: payload.password,
        options: {
          emailRedirectTo: `${window.location.origin}/?email_confirmed=1`,
          data: {
            name,
            phone,
          },
        },
      })

      if (error) {
        throw new Error(mapRegisterError(error.message))
      }

      if (!data.user) {
        throw new Error('Daftar gagal. Silakan coba lagi.')
      }

      // Supabase dapat menyamarkan respons untuk email yang sudah terdaftar.
      // Pada konfigurasi tertentu, responsnya berupa user tanpa identity baru.
      if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        throw new Error('Email ini sudah digunakan. Silakan login atau gunakan email lain.')
      }

      if (!data.session) {
        saveLocalSession(null)
        set({ user: null })
        return { requiresEmailConfirmation: true }
      }

      const user = toBuyerUser(data.user, {
        name,
        email,
        phone,
      })

      saveLocalSession(user)
      set({ user })
      return { requiresEmailConfirmation: false }
    }

    const users = getUsers()

    if (
      users.some(
        (item) =>
          item.email.toLowerCase() === email ||
          item.phone === phone,
      )
    ) {
      throw new Error('Email atau WhatsApp sudah terdaftar.')
    }

    const stored = {
      id: createClientId(),
      name,
      email,
      phone,
      password: payload.password,
    }

    saveUsers([...users, stored])

    const user = {
      id: stored.id,
      name: stored.name,
      email: stored.email,
      phone: stored.phone,
    }

    saveLocalSession(user)
    set({ user })
    return { requiresEmailConfirmation: false }
  },

  resendSignupConfirmation: async (rawEmail) => {
    const email = rawEmail.trim().toLowerCase()
    if (!email) throw new Error('Masukkan email terlebih dahulu.')
    if (!useSupabaseAuth()) throw new Error('Verifikasi email hanya tersedia pada Supabase Auth.')
    const supabase = getSupabaseClient()
    if (!supabase) throw new Error('Supabase belum dikonfigurasi.')
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${window.location.origin}/?email_confirmed=1` },
    })
    if (error) throw new Error(error.message || 'Gagal mengirim ulang email verifikasi.')
  },

  requestPasswordReset: async (rawEmail) => {
    const email = rawEmail.trim().toLowerCase()
    if (!email) throw new Error('Masukkan email terlebih dahulu.')
    if (!useSupabaseAuth()) throw new Error('Reset password hanya tersedia pada Supabase Auth.')

    const supabase = getSupabaseClient()
    if (!supabase) throw new Error('Supabase belum dikonfigurasi.')

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/?password_recovery=1`,
    })

    if (error) {
      const message = String(error.message || '').toLowerCase()
      if (message.includes('rate') || message.includes('limit')) {
        throw new Error('Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi.')
      }
      throw new Error('Gagal mengirim email reset password. Silakan coba lagi.')
    }
  },

  updatePassword: async (password) => {
    if (password.length < 8) throw new Error('Password baru minimal 8 karakter.')
    if (!useSupabaseAuth()) throw new Error('Reset password hanya tersedia pada Supabase Auth.')

    const supabase = getSupabaseClient()
    if (!supabase) throw new Error('Supabase belum dikonfigurasi.')

    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) {
      throw new Error('Link reset password tidak valid atau sudah kedaluwarsa. Minta link reset baru.')
    }

    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      const message = String(error.message || '').toLowerCase()
      if (message.includes('same password') || message.includes('different')) {
        throw new Error('Password baru harus berbeda dari password sebelumnya.')
      }
      if (message.includes('expired') || message.includes('invalid') || message.includes('session')) {
        throw new Error('Link reset password tidak valid atau sudah kedaluwarsa. Minta link reset baru.')
      }
      throw new Error(error.message || 'Password gagal diperbarui.')
    }
  },

  updateProfile: async (payload) => {
    const current = useAuthStore.getState().user
    if (!current) throw new Error('Sesi pengguna tidak ditemukan.')

    const name = payload.name.trim()
    const phone = payload.phone.trim()
    if (!name) throw new Error('Nama wajib diisi.')
    if (!phone) throw new Error('Nomor WhatsApp wajib diisi.')

    if (useSupabaseAuth()) {
      const supabase = getSupabaseClient()
      if (!supabase) throw new Error('Supabase belum dikonfigurasi.')

      const { data, error } = await supabase.auth.updateUser({
        data: { name, phone },
      })

      if (error) throw new Error(error.message || 'Profil gagal diperbarui.')

      const user = toBuyerUser(data.user, { ...current, name, phone })
      saveLocalSession(user)
      set({ user })
      return
    }

    const users = getUsers()
    const nextUsers = users.map((item) => item.id === current.id ? { ...item, name, phone } : item)
    saveUsers(nextUsers)

    const user = { ...current, name, phone }
    saveLocalSession(user)
    set({ user })
  },

  logout: async () => {
    if (useSupabaseAuth()) {
      const supabase = getSupabaseClient()
      if (supabase) {
        const { error } = await supabase.auth.signOut()
        if (error) throw new Error('Logout belum berhasil. Periksa koneksi Anda lalu coba lagi.')
      }
    }

    saveLocalSession(null)
    set({ user: null })
  },
}))
