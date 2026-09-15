import { getSupabaseClient } from '@/lib/supabase'

export async function uploadProductImage(file: File) {
  const supabase = getSupabaseClient()

  if (!supabase) {
    return { url: await fileToDataUrl(file) }
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-')
  const path = `${Date.now()}-${safeName}`

  const { error } = await supabase.storage.from('products').upload(path, file, {
    contentType: file.type,
    upsert: true,
  })

  if (error) {
    console.warn('[storage:upload:fallback-data-url]', error.message)
    return { url: await fileToDataUrl(file) }
  }

  const { data } = supabase.storage.from('products').getPublicUrl(path)
  return { url: data.publicUrl }
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
