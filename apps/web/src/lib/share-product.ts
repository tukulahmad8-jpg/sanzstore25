export async function shareProduct(title: string, url: string): Promise<'shared' | 'copied' | 'manual' | 'cancelled'> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, url })
      return 'shared'
    } catch (error) {
      if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') return 'cancelled'
      // Unsupported or denied native sharing can still fall back to copying.
    }
  }
  if (typeof navigator.clipboard?.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(url)
      return 'copied'
    } catch { /* Offer a selectable link when clipboard permission is denied. */ }
  }
  return 'manual'
}
