import { FormEvent, useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, CreditCard, Image, MapPin, Megaphone, Phone, Save, Store, Truck } from 'lucide-react'
import { Button } from '@/components/common/Button'
import { Card } from '@/components/common/Card'
import { Input } from '@/components/common/Input'
import { getSellerSupabaseClient } from '@/lib/supabase'

const defaults = {
  store_name: 'SanzStore25',
  whatsapp: '',
  address: '',
  origin_city: 'Jakarta Timur',
  pakasir_slug: 'sanzstore25',
  banner_title: 'Jual Barang Termurah Se-Indonesia',
  logo_url: '',
}

export function SettingsPage() {
  const [form, setForm] = useState(defaults)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function load() {
      const supabase = getSellerSupabaseClient()
      if (!supabase) {
        setMessage('Supabase belum terhubung.')
        setLoading(false)
        return
      }

      const { data, error } = await supabase.from('store_settings').select('*').eq('id', 'main').maybeSingle()
      if (error) setMessage(error.message)
      else if (data) {
        setForm({
          store_name: data.store_name || defaults.store_name,
          whatsapp: data.whatsapp || '',
          address: data.address || '',
          origin_city: data.origin_city || defaults.origin_city,
          pakasir_slug: data.pakasir_slug || defaults.pakasir_slug,
          banner_title: data.banner_title || defaults.banner_title,
          logo_url: data.logo_url || '',
        })
      }
      setLoading(false)
    }

    void load()
  }, [])

  async function save(event: FormEvent) {
    event.preventDefault()
    const supabase = getSellerSupabaseClient()
    if (!supabase || saving) return

    setSaving(true)
    setMessage('')
    const { error } = await supabase.from('store_settings').upsert({ id: 'main', ...form, updated_at: new Date().toISOString() })
    setMessage(error ? error.message : 'Pengaturan berhasil disimpan.')
    setSaving(false)
  }

  return (
    <main className="seller-page seller-settings-page">
      <div className="seller-page-heading">
        <div>
          <span className="seller-eyebrow">KONFIGURASI TOKO</span>
          <h1>Pengaturan</h1>
        </div>
      </div>

      {loading ? <p className="seller-loading-text">Memuat pengaturan...</p> : (
        <form onSubmit={save} className="seller-settings-form">
          {message ? (
            <div className={`seller-notice ${message.includes('berhasil') ? 'is-success' : 'is-error'}`} role={message.includes('berhasil') ? 'status' : 'alert'}>
              <span className="seller-notice-icon" aria-hidden="true">{message.includes('berhasil') ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}</span>
              <span className="seller-notice-copy"><b>{message.includes('berhasil') ? 'Pengaturan tersimpan' : 'Pengaturan belum tersimpan'}</b><small>{message}</small></span>
            </div>
          ) : null}

          <div className="seller-settings-grid">
            <Card className="seller-settings-card seller-settings-card-main">
              <div className="seller-settings-card-head">
                <span className="seller-settings-icon brand"><Store size={19} /></span>
                <div><h2>Identitas Toko</h2></div>
              </div>

              <div className="seller-form-grid two-col">
                <label className="seller-field"><span>Nama Toko</span><Input value={form.store_name} onChange={(event) => setForm({ ...form, store_name: event.target.value })} /></label>
                <label className="seller-field"><span>WhatsApp</span><div className="seller-field-with-icon"><Phone size={16} /><Input placeholder="628xxxxxxxxxx" value={form.whatsapp} onChange={(event) => setForm({ ...form, whatsapp: event.target.value })} /></div></label>
                <label className="seller-field full"><span>URL Logo</span><div className="seller-field-with-icon"><Image size={16} /><Input placeholder="https://..." value={form.logo_url} onChange={(event) => setForm({ ...form, logo_url: event.target.value })} /></div></label>
                <label className="seller-field full"><span>Judul Banner</span><div className="seller-field-with-icon"><Megaphone size={16} /><Input value={form.banner_title} onChange={(event) => setForm({ ...form, banner_title: event.target.value })} /></div></label>
              </div>
            </Card>

            <Card className="seller-settings-card">
              <div className="seller-settings-card-head">
                <span className="seller-settings-icon blue"><Truck size={19} /></span>
                <div><h2>Pengiriman</h2></div>
              </div>

              <div className="seller-form-grid">
                <label className="seller-field"><span>Kota Pengiriman</span><div className="seller-field-with-icon"><MapPin size={16} /><Input placeholder="Jakarta Timur" value={form.origin_city} onChange={(event) => setForm({ ...form, origin_city: event.target.value })} /></div></label>
                <label className="seller-field"><span>Alamat Toko</span><textarea value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} placeholder="Alamat operasional / pickup toko" /></label>
              </div>
            </Card>

            <Card className="seller-settings-card">
              <div className="seller-settings-card-head">
                <span className="seller-settings-icon green"><CreditCard size={19} /></span>
                <div><h2>Pembayaran</h2></div>
              </div>

              <div className="seller-form-grid">
                <label className="seller-field"><span>Slug Pakasir</span><Input value={form.pakasir_slug} onChange={(event) => setForm({ ...form, pakasir_slug: event.target.value })} /></label>
                <p className="seller-settings-help">Gunakan slug project Pakasir yang aktif. Secret API tetap disimpan di environment / Supabase Edge Function, bukan di halaman ini.</p>
              </div>
            </Card>
          </div>

          <div className="seller-settings-savebar">
            <div><b>Simpan perubahan</b><span>Pastikan data toko sudah benar sebelum dipublikasikan.</span></div>
            <Button disabled={saving} className="seller-primary-action gap-2"><Save size={17} /> {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}</Button>
          </div>
        </form>
      )}
    </main>
  )
}

export default SettingsPage
