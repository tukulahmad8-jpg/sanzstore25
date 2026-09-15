import { useAuthStore } from '@/stores/auth.store'
import { getSupabaseClient } from '@/lib/supabase'

export interface BuyerAddress {
  id: string
  label: string
  recipient: string
  phone: string
  province: string
  city: string
  district: string
  village: string
  postalCode: string
  address: string
  landmark: string
  rajaongkirDestinationId: string
  isMain: boolean
}

const LOCAL_KEY = 'sanz-address-book'

function readLocal(id: string): BuyerAddress[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(`${LOCAL_KEY}:${id}`) ?? '[]')
    return Array.isArray(parsed) ? parsed as BuyerAddress[] : []
  } catch {
    return []
  }
}

function writeLocal(id: string, addresses: BuyerAddress[]) {
  try { localStorage.setItem(`${LOCAL_KEY}:${id}`, JSON.stringify(addresses)) } catch { /* Cloud remains authoritative. */ }
}

export async function getAddresses() {
  const id = useAuthStore.getState().user?.id
  if (!id) return { data: [] as BuyerAddress[] }
  const client = getSupabaseClient()
  if (!client) throw new Error('Alamat belum dapat dimuat. Periksa koneksi lalu coba lagi.')
  // Insert once, including an empty book: deleted cloud addresses must never be resurrected by an old device.
  const { error: seedError } = await client.from('buyer_address_books').upsert(
    { user_id: id, addresses: readLocal(id) }, { onConflict: 'user_id', ignoreDuplicates: true },
  )
  if (seedError) throw new Error('Alamat belum dapat dimuat. Coba lagi beberapa saat.')
  const { data, error } = await client.from('buyer_address_books').select('addresses').eq('user_id', id).single()
  if (error) throw new Error('Alamat belum dapat dimuat. Coba lagi beberapa saat.')
  if (useAuthStore.getState().user?.id !== id) throw new Error('Akun berubah. Silakan muat ulang alamat.')
  const addresses = (data.addresses ?? []) as BuyerAddress[]
  writeLocal(id, addresses)
  return { data: addresses }
}

export async function saveAddresses(addresses: BuyerAddress[]) {
  const id = useAuthStore.getState().user?.id
  const client = getSupabaseClient()
  if (!id || !client) throw new Error('Silakan login kembali untuk menyimpan alamat.')
  const { error } = await client.from('buyer_address_books').upsert({ user_id: id, addresses })
  if (error) throw new Error('Alamat gagal disimpan ke akun. Periksa koneksi lalu coba lagi.')
  if (useAuthStore.getState().user?.id !== id) throw new Error('Akun berubah. Silakan muat ulang alamat.')
  writeLocal(id, addresses)
  return { data: addresses }
}
