// Bagikan produk.
//  - HP (layar sentuh): buka menu bagikan bawaan (WhatsApp, dll.).
//  - Desktop: langsung salin link. Dialog bagikan bawaan di desktop sering tidak
//    muncul atau tidak menyalin apa pun, dan tidak memberi tanda berhasil.
//  - Kalau menyalin diblokir browser (mis. browser di dalam aplikasi Instagram/TikTok),
//    kembalikan 'manual' agar halaman menampilkan kolom link yang bisa disalin sendiri.

const NATIVE_SHARE_TIMEOUT_MS = 30000

async function copyText(text: string): Promise<boolean> {
  if (typeof navigator.clipboard?.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Ditolak (izin/gesture): coba cara lama di bawah.
    }
  }

  try {
    const el = document.createElement('textarea')
    el.value = text
    el.setAttribute('readonly', '')
    el.style.position = 'fixed'
    el.style.left = '-9999px'
    el.style.opacity = '0'
    document.body.appendChild(el)
    el.select()
    el.setSelectionRange(0, text.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(el)
    return ok
  } catch {
    return false
  }
}

function prefersNativeShare(): boolean {
  if (typeof navigator.share !== 'function') return false
  return window.matchMedia?.('(pointer: coarse)').matches ?? false
}

// Pastikan janji selalu selesai, supaya tombol tidak macet kalau dialog bagikan tidak merespons.
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | 'timeout'> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => resolve('timeout'), ms)
    promise.then(
      (value) => { window.clearTimeout(timer); resolve(value) },
      (error) => { window.clearTimeout(timer); reject(error) },
    )
  })
}

export async function shareProduct(title: string, url: string): Promise<'shared' | 'copied' | 'manual' | 'cancelled'> {
  if (prefersNativeShare()) {
    try {
      const result = await withTimeout(navigator.share({ title, url }), NATIVE_SHARE_TIMEOUT_MS)
      return result === 'timeout' ? 'cancelled' : 'shared'
    } catch (error) {
      if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') return 'cancelled'
      // Bagikan bawaan tidak tersedia atau ditolak: lanjut salin link.
    }
  }

  return (await copyText(url)) ? 'copied' : 'manual'
}
