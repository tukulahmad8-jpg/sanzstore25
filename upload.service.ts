import { getSellerSupabaseClient } from '@/lib/supabase'

// Unggah foto produk (hanya dipakai Seller Center).
// Kalau gagal, lempar error yang jelas. Jangan pernah menyimpan gambar sebagai teks base64
// di database: satu foto bisa jadi jutaan karakter dan ikut terkirim ke setiap pengunjung.
export async function uploadProductImage(file: File) {
  const supabase = getSellerSupabaseClient()
  if (!supabase) throw new Error('Supabase seller belum dikonfigurasi. Gambar tidak dapat diunggah.')

  const { data: sessionData } = await supabase.auth.getSession()
  if (!sessionData.session) throw new Error('Sesi seller sudah berakhir. Silakan login ulang.')

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-')
  const path = `${Date.now()}-${safeName}`

  const { error } = await supabase.storage.from('products').upload(path, file, {
    contentType: file.type,
    upsert: false,
  })

  if (error) {
    console.error('[storage:upload]', error)
    throw new Error(`Gambar gagal diunggah: ${error.message}`)
  }

  const { data } = supabase.storage.from('products').getPublicUrl(path)
  return { url: data.publicUrl }
}
