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

const fallbackLocations: LocationOption[] = [
  { id: '3175101001', label: 'Lubang Buaya, Cipayung, Kota Administrasi Jakarta Timur, DKI Jakarta, 13810', province: 'DKI Jakarta', city: 'Kota Administrasi Jakarta Timur', district: 'Cipayung', village: 'Lubang Buaya', postalCode: '13810' },
  { id: '3175101002', label: 'Cipayung, Cipayung, Kota Administrasi Jakarta Timur, DKI Jakarta, 13840', province: 'DKI Jakarta', city: 'Kota Administrasi Jakarta Timur', district: 'Cipayung', village: 'Cipayung', postalCode: '13840' },
  { id: '3175101003', label: 'Ceger, Cipayung, Kota Administrasi Jakarta Timur, DKI Jakarta, 13820', province: 'DKI Jakarta', city: 'Kota Administrasi Jakarta Timur', district: 'Cipayung', village: 'Ceger', postalCode: '13820' },
  { id: '3175101004', label: 'Bambu Apus, Cipayung, Kota Administrasi Jakarta Timur, DKI Jakarta, 13890', province: 'DKI Jakarta', city: 'Kota Administrasi Jakarta Timur', district: 'Cipayung', village: 'Bambu Apus', postalCode: '13890' },
  { id: '3175101008', label: 'Cilangkap, Cipayung, Kota Administrasi Jakarta Timur, DKI Jakarta, 13870', province: 'DKI Jakarta', city: 'Kota Administrasi Jakarta Timur', district: 'Cipayung', village: 'Cilangkap', postalCode: '13870' },
  { id: '3173010001', label: 'Gambir, Gambir, Kota Administrasi Jakarta Pusat, DKI Jakarta, 10110', province: 'DKI Jakarta', city: 'Kota Administrasi Jakarta Pusat', district: 'Gambir', village: 'Gambir', postalCode: '10110' },
  { id: '3671010001', label: 'Tangerang, Tangerang, Kota Tangerang, Banten, 15111', province: 'Banten', city: 'Kota Tangerang', district: 'Tangerang', village: 'Tangerang', postalCode: '15111' },
]

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
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
    village: row.village || row.subdistrict_name || row.village_name || row.name || '',
    postalCode: String(row.postalCode || row.zip_code || row.postal_code || ''),
  }
}

export async function searchLocations(keyword: string) {
  const q = keyword.trim()
  if (q.length < 2) return { data: [] as LocationOption[] }

  const local = fallbackLocations.filter((item) => normalize(item.label).includes(normalize(q)))
  const supabase = getSupabaseClient()

  if (supabase) {
    try {
      const { data, error } = await supabase.functions.invoke('rajaongkir-location-search', {
        body: { keyword: q },
      })

      const rows = data?.locations || data?.data || []
      if (!error && Array.isArray(rows) && rows.length) {
        const remote = rows.map(normalizeRemote).filter((item: LocationOption) => item.label)
        const merged = [...remote, ...local].filter((item, index, arr) => arr.findIndex((x) => x.label === item.label) === index)
        return { data: merged.slice(0, 15) }
      }
    } catch {
      // fallback local
    }
  }

  return { data: local.slice(0, 15) }
}
