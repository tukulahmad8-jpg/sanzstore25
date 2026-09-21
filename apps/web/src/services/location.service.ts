import { getSupabaseClient } from '@/lib/supabase'

export interface LocationOption {
  id: string
  label: string
  province: string
  city: string
  district: string
  village: string
  postalCode: string
}

export interface LocationSearchResult {
  data: LocationOption[]
  // Terisi hanya kalau pencarian gagal. Daftar kosong TANPA error berarti "tidak ditemukan".
  error?: string
}

function normalizeRemote(row: any): LocationOption {
  return {
    id: String(row.id || row.destination_id || row.subdistrict_id || row.district_id || row.city_id || ''),
    label: row.label || [
      row.subdistrict_name || row.district_name || row.village_name || row.name,
      row.city_name || row.city,
      row.province_name || row.province,
      row.zip_code || row.postal_code,
    ].filter(Boolean).join(', '),
    province: row.province || row.province_name || '',
    city: row.city || row.city_name || '',
    district: row.district || row.district_name || row.subdistrict_name || '',
    village: row.village || row.subdistrict_name || row.village_name || '',
    postalCode: String(row.postalCode || row.zip_code || row.postal_code || ''),
  }
}

export async function searchLocations(keyword: string): Promise<LocationSearchResult> {
  const q = keyword.trim()
  if (q.length < 2) return { data: [] }

  const supabase = getSupabaseClient()
  if (!supabase) return { data: [], error: 'Pencarian lokasi belum aktif. Muat ulang halaman.' }

  try {
    const { data, error } = await supabase.functions.invoke('biteship-location-search', {
      body: { keyword: q },
    })

    if (error || data?.ok === false) {
      console.error('[location:search] gagal', error?.message || data?.message)
      return { data: [], error: 'Pencarian lokasi sedang bermasalah. Coba lagi beberapa saat.' }
    }

    const rows = data?.locations || data?.data || []
    if (!Array.isArray(rows)) return { data: [], error: 'Pencarian lokasi mengembalikan data yang tidak dikenali.' }

    const locations = rows
      .map(normalizeRemote)
      .filter((item: LocationOption) => item.label)
      .filter((item: LocationOption, index: number, arr: LocationOption[]) => arr.findIndex((x) => x.label === item.label) === index)

    return { data: locations.slice(0, 15) }
  } catch (err) {
    console.error('[location:search] error', err)
    return { data: [], error: 'Pencarian lokasi sedang bermasalah. Coba lagi beberapa saat.' }
  }
}
