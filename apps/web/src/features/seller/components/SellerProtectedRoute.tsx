import { useEffect } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useSellerAuthStore } from '@/stores/sellerAuth.store'

export function SellerProtectedRoute() {
  const seller = useSellerAuthStore((state) => state.seller)
  const hydrated = useSellerAuthStore((state) => state.hydrated)
  const hydrate = useSellerAuthStore((state) => state.hydrate)
  const location = useLocation()

  useEffect(() => {
    if (!hydrated) void hydrate()
  }, [hydrate, hydrated])

  if (!hydrated) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--background)]">
        <p className="font-bold text-[var(--muted)]">Memeriksa sesi seller...</p>
      </main>
    )
  }

  if (!seller) {
    return (
      <Navigate
        to="/seller/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    )
  }

  return <Outlet />
}
