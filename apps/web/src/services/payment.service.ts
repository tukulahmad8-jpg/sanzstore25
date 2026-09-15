import { getSupabaseClient } from '@/lib/supabase'
import { env, isSupabaseConfigured } from '@/lib/env'
import type { PaymentMethod } from '@/types/domain'

export async function createPayment(payload: {
  orderId: string
  amount: number
  method?: PaymentMethod | 'all'
  redirectUrl?: string
}) {
  if (!isSupabaseConfigured) {
    const paymentUrl = buildPakasirUrl(payload.orderId, payload.amount, env.pakasirSlug)
    return { orderId: payload.orderId, method: payload.method || 'all', paymentUrl }
  }

  const supabase = getSupabaseClient()
  if (!supabase) {
    const paymentUrl = buildPakasirUrl(payload.orderId, payload.amount, env.pakasirSlug)
    return { orderId: payload.orderId, method: payload.method || 'all', paymentUrl }
  }

  const { data, error } = await supabase.functions.invoke('pakasir-create-payment', { body: payload })
  if (error) throw new Error(error.message || 'Gagal membuat pembayaran Pakasir.')
  if (data?.message && !data?.paymentUrl) throw new Error(data.message)

  return data as { orderId: string; method: string; paymentUrl: string; amount: number }
}

export async function checkPayment(payload: { orderId: string; amount: number }) {
  const supabase = getSupabaseClient()
  if (!supabase) return { status: 'pending' }

  const { data, error } = await supabase.functions.invoke('pakasir-check-payment', { body: payload })
  if (error) {
    let detail = ''
    try {
      const response = (error as { context?: Response }).context
      if (response && typeof response.clone === 'function') {
        const body = await response.clone().json().catch(() => null) as { message?: string; stage?: string; hint?: string } | null
        if (body?.message) detail = `${body.stage ? `[${body.stage}] ` : ''}${body.message}${body.hint ? ` (${body.hint})` : ''}`
      }
    } catch {}
    throw new Error(detail || error.message || 'Gagal cek pembayaran Pakasir.')
  }
  return data as { status: string; transaction?: Record<string, unknown>; order?: Record<string, unknown> | null; message?: string; stage?: string }
}

function buildPakasirUrl(orderId: string, amount: number, slug: string) {
  const encodedOrderId = encodeURIComponent(orderId)
  const roundedAmount = Math.max(500, Math.round(amount))
  return `https://app.pakasir.com/pay/${encodeURIComponent(slug)}/${roundedAmount}?order_id=${encodedOrderId}`
}
