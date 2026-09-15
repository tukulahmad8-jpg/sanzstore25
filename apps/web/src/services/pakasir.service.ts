type PakasirPaymentParams = {
  invoiceId: string
  amount: number
}

export function createPakasirPaymentUrl({ invoiceId, amount }: PakasirPaymentParams) {
  const slug = import.meta.env.VITE_PAKASIR_SLUG || 'sanzstore25'
  const baseUrl = `https://app.pakasir.com/pay/${slug}`
  const url = new URL(baseUrl)
  url.searchParams.set('order_id', invoiceId)
  url.searchParams.set('amount', String(Math.round(Number(amount || 0))))
  return url.toString()
}
