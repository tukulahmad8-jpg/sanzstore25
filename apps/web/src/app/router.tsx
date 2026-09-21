import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { BuyerLayout } from '@/components/layouts/BuyerLayout'
import { HomePage } from '@/features/buyer/pages/HomePage'
import { ProductPage } from '@/features/buyer/pages/ProductPage'
import { CartPage } from '@/features/buyer/pages/CartPage'
import { CheckoutPage } from '@/features/buyer/pages/CheckoutPage'
import { AccountPage } from '@/features/buyer/pages/AccountPage'
import { BuyerOrderDetailPage } from '@/features/buyer/pages/BuyerOrderDetailPage'
import { PaymentPage } from '@/features/payment/pages/PaymentPage'
import { SellerProtectedRoute } from '@/features/seller/components/SellerProtectedRoute'
import { ErrorPage } from './ErrorPage'

// Halaman Seller (sekitar 100 KB kode) tidak perlu diunduh pembeli. Vite memecahnya
// menjadi file terpisah yang baru dimuat saat halamannya dibuka.
const SellerLayout = lazy(() => import('@/components/layouts/SellerLayout').then((m) => ({ default: m.SellerLayout })))
const SellerLoginPage = lazy(() => import('@/features/seller/pages/SellerLoginPage').then((m) => ({ default: m.SellerLoginPage })))
const SellerDashboardPage = lazy(() => import('@/features/seller/pages/SellerDashboardPage').then((m) => ({ default: m.SellerDashboardPage })))
const SellerProductsPage = lazy(() => import('@/features/seller/pages/SellerProductsPage').then((m) => ({ default: m.SellerProductsPage })))
const SellerOrdersPage = lazy(() => import('@/features/seller/pages/SellerOrdersPage').then((m) => ({ default: m.SellerOrdersPage })))
const SellerVouchersPage = lazy(() => import('@/features/seller/pages/SellerVouchersPage').then((m) => ({ default: m.SellerVouchersPage })))
const ReportsPage = lazy(() => import('@/features/seller/pages/ReportsPage').then((m) => ({ default: m.ReportsPage })))
const SettingsPage = lazy(() => import('@/features/seller/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })))

function withSuspense(node: ReactNode) {
  return <Suspense fallback={<div style={{ padding: 24, opacity: 0.7 }}>Memuat...</div>}>{node}</Suspense>
}

export const router = createBrowserRouter([
  {
    element: <BuyerLayout />,
    errorElement: <ErrorPage />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/product/:id', element: <ProductPage /> },
      { path: '/products/:id', element: <ProductPage /> },
      { path: '/cart', element: <CartPage /> },
      { path: '/checkout', element: <CheckoutPage /> },
      { path: '/account', element: <AccountPage /> },
      { path: '/account/orders/:orderId', element: <BuyerOrderDetailPage /> },
      { path: '/payment/:orderId', element: <PaymentPage /> },
    ],
  },
  {
    path: '/seller/login',
    element: withSuspense(<SellerLoginPage />),
    errorElement: <ErrorPage />,
  },
  {
    element: <SellerProtectedRoute />,
    errorElement: <ErrorPage />,
    children: [
      {
        path: '/seller',
        element: withSuspense(<SellerLayout />),
        children: [
          { index: true, element: withSuspense(<SellerDashboardPage />) },
          { path: 'dashboard', element: withSuspense(<SellerDashboardPage />) },
          { path: 'products', element: withSuspense(<SellerProductsPage />) },
          { path: 'orders', element: withSuspense(<SellerOrdersPage />) },
          { path: 'vouchers', element: withSuspense(<SellerVouchersPage />) },
          { path: 'reports', element: withSuspense(<ReportsPage />) },
          { path: 'settings', element: withSuspense(<SettingsPage />) },
          { path: '*', element: <ErrorPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <ErrorPage /> },
])
