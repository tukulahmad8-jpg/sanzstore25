const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL || ''

const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.SUPABASE_ANON_KEY ||
  ''

export const env = {
  supabaseUrl: String(supabaseUrl).trim(),
  supabasePublishableKey: String(supabasePublishableKey).trim(),
  authMode: String(import.meta.env.PROD ? 'supabase' : (import.meta.env.VITE_AUTH_MODE || 'local')).trim(),

  shippingProvider: 'biteship',
  biteshipCouriers: String(import.meta.env.VITE_BITESHIP_COURIERS || 'jne,jnt').trim(),

  pakasirSlug: String(import.meta.env.VITE_PAKASIR_SLUG || 'sanzstore25').trim(),
}

export const isSupabaseConfigured = Boolean(
  env.supabaseUrl &&
  env.supabasePublishableKey &&
  env.supabaseUrl.startsWith('http') &&
  !env.supabaseUrl.includes('xxxx') &&
  !env.supabasePublishableKey.includes('xxxxx')
)
