import { getSupabaseClient } from './supabase'

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const supabase = getSupabaseClient()

  if (!supabase) {
    throw new Error('Supabase belum dikonfigurasi. Gunakan service Supabase direct atau set ENV Supabase.')
  }

  const functionName = path.replace(/^\/api\//, '').replace(/^\//, '')
  const body = options?.body ? JSON.parse(String(options.body)) : undefined
  const { data, error } = await supabase.functions.invoke(functionName, { body })

  if (error) throw new Error(error.message)
  return data as T
}
