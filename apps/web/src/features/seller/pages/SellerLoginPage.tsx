import { sellerAuthError } from '@/lib/seller-auth-error'
import { FormEvent, useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, LockKeyhole, Mail, Store } from 'lucide-react'
import { useSellerAuthStore } from '@/stores/sellerAuth.store'

const SELLER_EMAIL = 'admin@sanzstore25.com'

type LocationState = {
  from?: string
}

export function SellerLoginPage() {
  const seller = useSellerAuthStore((state) => state.seller)
  const hydrated = useSellerAuthStore((state) => state.hydrated)
  const hydrate = useSellerAuthStore((state) => state.hydrate)
  const login = useSellerAuthStore((state) => state.login)

  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = (location.state as LocationState | null)?.from || '/seller'

  const [email, setEmail] = useState(SELLER_EMAIL)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!hydrated) void hydrate()
  }, [hydrate, hydrated])

  if (hydrated && seller) {
    return <Navigate to="/seller" replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    setSubmitting(true)
    setError('')

    try {
      await login(email, password)
      navigate(redirectTo.startsWith('/seller') ? redirectTo : '/seller', {
        replace: true,
      })
    } catch (err) {
      setError(sellerAuthError(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--background)] px-4 py-10">
      <section className="w-full max-w-md overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--surface)] shadow-soft">
        <div className="bg-gradient-to-br from-brand/20 via-brand/5 to-transparent px-7 py-8 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-brand text-white shadow-soft">
            <Store size={30} />
          </div>
          <p className="mt-5 text-sm font-black uppercase tracking-[0.2em] text-brand">
            SanzStore25
          </p>
          <h1 className="mt-2 text-3xl font-black">Seller Center</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Kelola produk, pesanan, voucher, laporan, dan pengaturan toko.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-5 border-t border-[var(--line)] p-7">
          {error ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-500">
              {error}
            </div>
          ) : null}

          <label className="grid gap-2">
            <span className="text-sm font-black">Email Seller</span>
            <div className="flex h-12 items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--background)] px-4 focus-within:border-brand">
              <Mail size={18} className="shrink-0 text-[var(--muted)]" />
              <input
                required
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="min-w-0 flex-1 bg-transparent outline-none"
              />
            </div>
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-black">Password</span>
            <div className="flex h-12 items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--background)] px-4 focus-within:border-brand">
              <LockKeyhole size={18} className="shrink-0 text-[var(--muted)]" />
              <input
                required
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="min-w-0 flex-1 bg-transparent outline-none"
                placeholder="Masukkan password"
              />
              <button
                type="button"
                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                onClick={() => setShowPassword((value) => !value)}
                className="text-[var(--muted)] transition hover:text-brand"
              >
                {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>
          </label>

          <button
            type="submit"
            disabled={submitting || !hydrated}
            className="inline-flex h-12 items-center justify-center rounded-xl bg-brand px-5 font-black text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Memeriksa akun...' : 'Masuk ke Seller Center'}
          </button>

          <a
            href="/"
            className="text-center text-sm font-bold text-[var(--muted)] transition hover:text-brand"
          >
            Kembali ke toko
          </a>
        </form>
      </section>
    </main>
  )
}
