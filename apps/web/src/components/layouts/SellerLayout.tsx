import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  ChevronRight,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Moon,
  Package,
  Settings,
  Store,
  Sun,
  TicketPercent,
} from 'lucide-react'
import { useThemeStore } from '@/stores/theme.store'
import { useSellerAuthStore } from '@/stores/sellerAuth.store'
import { toast } from '@/lib/notify'

const menus = [
  { label: 'Dashboard', href: '/seller', icon: LayoutDashboard },
  { label: 'Produk', href: '/seller/products', icon: Package },
  { label: 'Pesanan', href: '/seller/orders', icon: ClipboardList },
  { label: 'Voucher', href: '/seller/vouchers', icon: TicketPercent },
  { label: 'Laporan', href: '/seller/reports', icon: BarChart3 },
  { label: 'Pengaturan', href: '/seller/settings', icon: Settings },
] as const

function currentSection(pathname: string) {
  if (pathname === '/seller') return 'Dashboard'
  if (pathname.startsWith('/seller/products')) return 'Produk'
  if (pathname.startsWith('/seller/orders')) return 'Pesanan'
  if (pathname.startsWith('/seller/vouchers')) return 'Voucher'
  if (pathname.startsWith('/seller/reports')) return 'Laporan'
  if (pathname.startsWith('/seller/settings')) return 'Pengaturan'
  return 'Seller Center'
}

export function SellerLayout() {
  const { theme, toggleTheme } = useThemeStore()
  const seller = useSellerAuthStore((state) => state.seller)
  const logout = useSellerAuthStore((state) => state.logout)
  const navigate = useNavigate()
  const location = useLocation()
  const section = currentSection(location.pathname)

  async function handleLogout() {
    try {
      await logout()
      navigate('/seller/login', { replace: true })
    } catch {
      toast('Logout belum berhasil. Periksa koneksi Anda lalu coba lagi.', 'error')
    }
  }

  return (
    <div className="seller-shell seller-v4-shell">
      <aside className="seller-sidebar">
        <Link to="/seller" className="seller-brand-card">
          <div className="seller-brand-mark">S</div>
          <div className="min-w-0">
            <div className="seller-brand-name">Sanz<span>Store25</span></div>
            <small>Seller Center</small>
          </div>
        </Link>

        <div className="seller-nav-label">MENU UTAMA</div>
        <nav className="seller-nav">
          {menus.map(({ label, href, icon: Icon }) => (
            <NavLink
              key={href}
              to={href}
              end={href === '/seller'}
              className={({ isActive }) => `seller-nav-link ${isActive ? 'active' : ''}`}
            >
              <span className="seller-nav-icon"><Icon size={18} /></span>
              <span>{label}</span>
              <ChevronRight className="seller-nav-chevron" size={15} />
            </NavLink>
          ))}
        </nav>

        <div className="seller-sidebar-spacer" />


        <div className="seller-account-card">
          <div className="seller-account-avatar">{(seller?.email || 'S').slice(0, 1).toUpperCase()}</div>
          <div className="min-w-0 flex-1 seller-account-copy">
            <b className="truncate" title={seller?.email || 'Seller'}>{seller?.email || 'Seller'}</b>
            <span>Akun seller</span>
          </div>
          <button type="button" onClick={handleLogout} className="seller-sidebar-logout" aria-label="Logout seller" title="Logout seller">
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <main className="seller-main">
        <header className="seller-header">
          <div className="seller-header-context">
            <span>Seller Center</span>
            <ChevronRight size={14} />
            <strong>{section}</strong>
          </div>

          <div className="seller-header-actions">
            <span className="seller-store-status"><i /> Toko aktif</span>
            <Link to="/" className="seller-store-link"><Store size={17} /> Buka Toko</Link>
            <button onClick={toggleTheme} className="theme-toggle seller-theme-toggle" aria-label="Ganti tema">
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
              <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
            </button>
          </div>
        </header>

        <div className="seller-content">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
