import { getSellerSupabaseClient } from '@/lib/supabase'

export interface BiteshipShipmentResult {
  success: boolean
  message?: string
  order?: Record<string, unknown>
  biteship?: Record<string, unknown>
}

async function friendlyFunctionError(functionName: string, error: unknown) {
  const contextual = error as { context?: unknown } | null
  const response = contextual?.context instanceof Response ? contextual.context : null

  if (response) {
    try {
      const payload = await response.clone().json() as { message?: string; error?: string; biteship?: unknown }
      const message = String(payload?.message || payload?.error || '').trim()
      if (message) return new Error(message)
    } catch {
      try {
        const text = (await response.clone().text()).trim()
        if (text) return new Error(text)
      } catch {
        // Abaikan kegagalan parsing response dan gunakan fallback di bawah.
      }
    }
  }

  const raw = error instanceof Error ? error.message : String(error || '')
  const lower = raw.toLowerCase()

  if (lower.includes('failed to send a request') || lower.includes('fetch')) {
    return new Error(
      `Layanan pengiriman belum dapat dihubungi (${functionName}). Pastikan Edge Function Biteship sudah dideploy ke project Supabase yang aktif.`,
    )
  }

  if (lower.includes('jwt') || lower.includes('unauthorized') || lower.includes('401')) {
    return new Error('Sesi Seller Center sudah tidak valid. Silakan login ulang lalu coba lagi.')
  }

  return new Error(raw || 'Edge Function gagal dipanggil.')
}

async function invoke(functionName: string, body: Record<string, unknown>) {
  const supabase = getSellerSupabaseClient()
  if (!supabase) throw new Error('Supabase belum dikonfigurasi.')

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  const accessToken = sessionData.session?.access_token
  if (sessionError || !accessToken) {
    throw new Error('Sesi Seller Center tidak ditemukan. Silakan login ulang.')
  }

  const { data, error } = await supabase.functions.invoke(functionName, {
    body,
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (error) throw await friendlyFunctionError(functionName, error)
  if (!data?.success) throw new Error(data?.message || 'Permintaan Biteship gagal.')
  return data as BiteshipShipmentResult
}

export function createBiteshipShipment(orderId: string, collectionMethod: 'pickup' | 'drop_off' = 'pickup') {
  return invoke('biteship-create-order', { order_id: orderId, collection_method: collectionMethod })
}

export function refreshBiteshipShipment(orderId: string) {
  return invoke('biteship-track-order', { order_id: orderId })
}

export function bulkRecoverBiteshipShipments(csvText: string) {
  return invoke('biteship-bulk-recover', { csv_text: csvText })
}
