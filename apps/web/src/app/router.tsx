import { createBrowserRouter } from 'react-router-dom'
import { BuyerLayout } from '@/components/layouts/BuyerLayout'
import { SellerLayout } from '@/components/layouts/SellerLayout'
import { HomePage } from '@/features/buyer/pages/HomePage'
import { ProductPage } from '@/features/buyer/pages/ProductPage'
import { CartPage } from '@/features/buyer/pages/CartPage'
import { CheckoutPage } from '@/features/buyer/pages/CheckoutPage'
import { AccountPage } from '@/features/buyer/pages/AccountPage'
import { BuyerOrderDetailPage } from '@/features/buyer/pages/BuyerOrderDetailPage'
import { PaymentPage } from '@/features/payment/pages/PaymentPage'
import { SellerDashboardPage } from '@/features/seller/pages/SellerDashboardPage'
import { SellerProductsPage } from '@/features/seller/pages/SellerProductsPage'
import { SellerOrdersPage } from '@/features/seller/pages/SellerOrdersPage'
import { SellerVouchersPage } from '@/features/seller/pages/SellerVouchersPage'
import { ReportsPage } from '@/features/seller/pages/ReportsPage'
import { SettingsPage } from '@/features/seller/pages/SettingsPage'
import { SellerLoginPage } from '@/features/seller/pages/SellerLoginPage'
import { SellerProtectedRoute } from '@/features/seller/components/SellerProtectedRoute'
import { ErrorPage } from './ErrorPage'

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
    element: <SellerLoginPage />,
    errorElement: <ErrorPage />,
  },
  {
    element: <SellerProtectedRoute />,
    errorElement: <ErrorPage />,
    children: [
      {
        path: '/seller',
        element: <SellerLayout />,
        children: [
          { index: true, element: <SellerDashboardPage /> },
          { path: 'dashboard', element: <SellerDashboardPage /> },
          { path: 'products', element: <SellerProductsPage /> },
          { path: 'orders', element: <SellerOrdersPage /> },
          { path: 'vouchers', element: <SellerVouchersPage /> },
          { path: 'reports', element: <ReportsPage /> },
          { path: 'settings', element: <SettingsPage /> },
          { path: '*', element: <ErrorPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <ErrorPage /> },
])
