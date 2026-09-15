// crypto.randomUUID() only works in secure contexts (HTTPS or http://localhost).
// Accessing the app over a plain-HTTP LAN IP (e.g. http://192.168.x.x:5173) makes it
// undefined, so every place that needs a client-side id should go through this helper
// instead of calling crypto.randomUUID() directly.
export function generateId(prefix = 'id') {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}
