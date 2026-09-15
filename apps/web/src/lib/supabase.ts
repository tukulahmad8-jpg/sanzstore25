import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env, isSupabaseConfigured } from './env'

let buyerClient: SupabaseClient | null = null
let sellerClient: SupabaseClient | null = null

export function getSupabaseClient() {
  if (!isSupabaseConfigured) return null

  if (!buyerClient) {
    buyerClient = createClient(
      env.supabaseUrl,
      env.supabasePublishableKey,
      {
        auth: {
          storageKey: 'sanzstore25-buyer-auth',
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      },
    )
  }

  return buyerClient
}

export function getSellerSupabaseClient() {
  if (!isSupabaseConfigured) return null

  if (!sellerClient) {
    sellerClient = createClient(
      env.supabaseUrl,
      env.supabasePublishableKey,
      {
        auth: {
          storageKey: 'sanzstore25-seller-auth',
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
      },
    )
  }

  return sellerClient
}