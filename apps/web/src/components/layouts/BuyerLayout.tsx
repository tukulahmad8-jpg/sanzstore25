import { Link, Outlet } from 'react-router-dom'
import { MessageCircle, Moon, Search, ShoppingCart, Sun } from 'lucide-react'
import { useEffect } from 'react'
import { useThemeStore } from '@/stores/theme.store'
import { useCartStore } from '@/stores/cart.store'
import { AuthDropdown } from '@/components/auth/AuthDropdown'
import { useAuthStore } from '@/stores/auth.store'

const whatsappUrl = 'https://wa.me/6281807907592?text=Halo%20Admin%20SanzStore25%2C%20saya%20ingin%20bertanya%20mengenai%20produk%20atau%20pesanan.'

export function BuyerLayout() {
  const { theme, toggleTheme } = useThemeStore()
  const hydrateAuth = useAuthStore((state) => state.hydrate)
  const cartCount = useCartStore((state) => state.items.reduce((sum, item) => sum + item.qty, 0))

  useEffect(() => {
    hydrateAuth()
  }, [hydrateAuth])

  return (
    <div className="buyer-shell flex min-h-screen flex-col bg-[var(--background)] text-[var(--text)]">
      <header className="buyer-header sticky top-0 z-40 border-b border-[var(--line)] backdrop-blur-xl">
        <div className="mx-auto grid w-full max-w-[1440px] grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-2 px-4 py-3 lg:min-h-[70px] lg:grid-cols-[220px_minmax(320px,1fr)_auto_auto_auto] lg:gap-3 lg:py-0 xl:px-6">
          <Link to="/" className="min-w-0 truncate text-2xl font-bold tracking-[-0.02em] sm:text-[28px]">
            Sanz<span className="text-brand">Store25</span>
          </Link>

          <label className="buyer-search order-5 col-span-4 flex h-11 items-center overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface-2)] lg:order-none lg:col-span-1 lg:h-12 lg:rounded-2xl">
            <input
              placeholder="Cari produk di SanzStore25..."
              className="h-full min-w-0 flex-1 bg-transparent px-4 text-sm outline-none sm:text-base"
            />
            <button
              type="button"
              className="grid h-full w-12 place-items-center bg-brand text-white transition hover:brightness-110 lg:w-14"
              aria-label="Cari produk"
            >
              <Search size={19} />
            </button>
          </label>

          <button
            type="button"
            onClick={toggleTheme}
            className="theme-toggle inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)] font-bold transition hover:border-brand/50 lg:h-11 lg:w-auto lg:gap-2 lg:px-3.5"
            aria-label="Ubah tema"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            <span className="hidden lg:inline">{theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>

          <Link
            to="/cart"
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-brand/70 bg-brand/5 font-bold text-brand transition hover:bg-brand hover:text-white lg:h-11 lg:w-auto lg:gap-2 lg:px-4"
            aria-label="Keranjang"
          >
            <ShoppingCart size={18} />
            <span className="hidden lg:inline">Keranjang</span>
            {cartCount > 0 ? (
              <span className="absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1 text-[10px] text-white shadow lg:h-6 lg:min-w-6 lg:text-xs">
                {cartCount}
              </span>
            ) : null}
          </Link>

          <div className="min-w-0">
            <AuthDropdown />
          </div>
        </div>
      </header>

      <div className="flex-1">
        <Outlet />
      </div>

      <a
        href={whatsappUrl}
        target="_blank"
        rel="noreferrer"
        className="fixed bottom-5 right-5 z-40 grid h-12 w-12 place-items-center rounded-full bg-emerald-500 text-white shadow-2xl transition hover:-translate-y-1 hover:brightness-110 sm:h-14 sm:w-14"
        aria-label="Chat WhatsApp"
      >
        <MessageCircle size={24} />
      </a>

      <footer className="mt-10 border-t border-[var(--line)] bg-[var(--surface)]/70">
        <div className="mx-auto flex max-w-[1440px] items-center justify-center px-4 py-4 text-xs text-[var(--muted)] xl:px-6">
          <p className="text-center">© 2026 SanzStore25</p>
        </div>
      </footer>
    </div>
  )
}
