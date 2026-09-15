import { useAuthStore } from '@/stores/auth.store'
import { getBuyerOrders, getSellerOrders } from './orders.service'

export function getBuyerIdentity() {
  const user = useAuthStore.getState().user
  if (user?.id) return user.id
  const savedId = localStorage.getItem('ss25_buyer_id') || ''
  if (savedId) return savedId
  const savedPhone = localStorage.getItem('ss25_buyer_phone') || localStorage.getItem('buyer_phone') || ''
  const checkout = localStorage.getItem('ss25_checkout_customer')
  try {
    const parsed = checkout ? JSON.parse(checkout) : null
    return String(parsed?.phone || parsed?.email || savedPhone || '').trim()
  } catch {
    return String(savedPhone || '').trim()
  }
}

export async function loadBuyerOrderList() {
  return getBuyerOrders(getBuyerIdentity())
}

export async function loadSellerOrderList() {
  return getSellerOrders()
}
