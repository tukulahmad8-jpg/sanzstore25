const messages = {
  credentials: 'Email atau password seller yang Anda masukkan salah.',
  access: 'Akun ini tidak memiliki akses ke Seller Center.',
  rate: 'Terlalu banyak percobaan login. Tunggu sebentar lalu coba lagi.',
  network: 'Koneksi ke server bermasalah. Periksa internet lalu coba lagi.',
  fallback: 'Login belum berhasil. Silakan coba lagi beberapa saat.',
}

export function sellerAuthError(error: unknown): string {
  const record = error && typeof error === 'object' ? error as { message?: unknown; name?: unknown; status?: unknown } : null
  const message = typeof record?.message === 'string' ? record.message : ''
  if (Object.values(messages).includes(message)) return message
  if (/invalid login credentials|email atau password seller salah/i.test(message)) return messages.credentials
  if (/email ini tidak memiliki akses|akun ini tidak memiliki akses/i.test(message)) return messages.access
  if (/too many|rate.?limit/i.test(message)) return messages.rate
  if (/network|fetch|connection|load failed|internet.*offline|network request failed/i.test(message)
      || record?.name === 'AuthRetryableFetchError'
      || record?.status === 0
      || (typeof navigator !== 'undefined' && navigator.onLine === false)) return messages.network
  return messages.fallback
}
