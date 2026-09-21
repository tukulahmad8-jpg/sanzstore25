import { FormEvent, useEffect, useMemo, useState } from 'react'
import { confirmAction } from '@/lib/notify'
import { CalendarDays, Pencil, Plus, Power, TicketPercent, Trash2, Users, X } from 'lucide-react'
import { Button } from '@/components/common/Button'
import { Card } from '@/components/common/Card'
import { Input } from '@/components/common/Input'
import { getSellerSupabaseClient } from '@/lib/supabase'


type Voucher = {
  id: string
  code: string
  name: string
  type: 'percent' | 'fixed' | 'shipping'
  value: number
  max_discount: number
  min_purchase: number
  quota: number
  used_count: number
  status: string
  start_at: string
  end_at: string | null
}

const emptyForm = {
  id: '',
  code: '',
  name: '',
  type: 'percent' as Voucher['type'],
  value: '',
  max_discount: '',
  min_purchase: '',
  quota: '',
  status: 'Aktif',
  start_at: '',
  end_at: '',
}

function rupiah(value: number) {
  return `Rp ${Number(value || 0).toLocaleString('id-ID')}`
}

function voucherValue(voucher: Voucher) {
  if (voucher.type === 'percent') return `${voucher.value}%`
  if (voucher.type === 'shipping') return 'Gratis Ongkir'
  return rupiah(voucher.value)
}

function formatDate(value?: string | null) {
  if (!value) return 'Tanpa batas'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

export function SellerVouchersPage() {
  const [rows, setRows] = useState<Voucher[]>([])
  const [form, setForm] = useState(emptyForm)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const activeCount = useMemo(() => rows.filter((row) => row.status === 'Aktif').length, [rows])
  const usedCount = useMemo(() => rows.reduce((sum, row) => sum + Number(row.used_count || 0), 0), [rows])

  async function load() {
    setLoading(true)
    setMessage('')
    const supabase = getSellerSupabaseClient()
    if (!supabase) {
      setMessage('Supabase belum terhubung.')
      setLoading(false)
      return
    }

    const { data, error } = await supabase.from('vouchers').select('*').order('created_at', { ascending: false })
    if (error) setMessage(error.message)
    else setRows((data || []) as Voucher[])
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  function edit(voucher: Voucher) {
    setForm({
      id: voucher.id,
      code: voucher.code,
      name: voucher.name || '',
      type: voucher.type,
      value: String(voucher.value || ''),
      max_discount: String(voucher.max_discount || ''),
      min_purchase: String(voucher.min_purchase || ''),
      quota: String(voucher.quota || ''),
      status: voucher.status || 'Aktif',
      start_at: voucher.start_at ? voucher.start_at.slice(0, 16) : '',
      end_at: voucher.end_at ? voucher.end_at.slice(0, 16) : '',
    })
    setOpen(true)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const supabase = getSellerSupabaseClient()
    if (!supabase || saving) return

    setSaving(true)
    setMessage('')
    const payload = {
      id: form.id || crypto.randomUUID(),
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      type: form.type,
      value: Number(form.value || 0),
      max_discount: Number(form.max_discount || 0),
      min_purchase: Number(form.min_purchase || 0),
      quota: Number(form.quota || 0),
      status: form.status,
      start_at: form.start_at ? new Date(form.start_at).toISOString() : new Date().toISOString(),
      end_at: form.end_at ? new Date(form.end_at).toISOString() : null,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase.from('vouchers').upsert(payload)
    if (error) setMessage(error.message)
    else {
      setOpen(false)
      setForm(emptyForm)
      await load()
    }
    setSaving(false)
  }

  async function remove(voucher: Voucher) {
    if (!(await confirmAction(`Hapus voucher ${voucher.code}?`, { confirmText: 'Hapus voucher', danger: true }))) return
    const supabase = getSellerSupabaseClient()
    if (!supabase) return
    const { error } = await supabase.from('vouchers').delete().eq('id', voucher.id)
    if (error) setMessage(error.message)
    else await load()
  }

  async function toggle(voucher: Voucher) {
    const supabase = getSellerSupabaseClient()
    if (!supabase) return
    const { error } = await supabase
      .from('vouchers')
      .update({ status: voucher.status === 'Aktif' ? 'Nonaktif' : 'Aktif', updated_at: new Date().toISOString() })
      .eq('id', voucher.id)
    if (error) setMessage(error.message)
    else await load()
  }

  return (
    <main className="seller-page seller-vouchers-page">
      <div className="seller-page-heading">
        <div>
          <span className="seller-eyebrow">PROMOSI TOKO</span>
          <h1>Voucher</h1>
        </div>
        <Button type="button" className="seller-primary-action gap-2" onClick={() => { setForm(emptyForm); setOpen(true) }}>
          <Plus size={18} /> Buat Voucher
        </Button>
      </div>

      <div className="seller-voucher-summary">
        <div><span className="seller-voucher-summary-icon brand"><TicketPercent size={19} /></span><p>Total voucher</p><strong>{rows.length}</strong></div>
        <div><span className="seller-voucher-summary-icon green"><Power size={19} /></span><p>Voucher aktif</p><strong>{activeCount}</strong></div>
        <div><span className="seller-voucher-summary-icon blue"><Users size={19} /></span><p>Total digunakan</p><strong>{usedCount}</strong></div>
      </div>

      {message ? <div className="seller-notice">{message}</div> : null}

      {loading ? (
        <p className="seller-loading-text">Memuat voucher...</p>
      ) : rows.length ? (
        <div className="seller-voucher-grid">
          {rows.map((voucher) => {
            const quota = Number(voucher.quota || 0)
            const used = Number(voucher.used_count || 0)
            const usage = quota > 0 ? Math.min(100, Math.round((used / quota) * 100)) : 0
            return (
              <article key={voucher.id} className="seller-voucher-card">
                <div className="seller-voucher-card-top">
                  <div className="seller-voucher-code-block">
                    <span className="seller-voucher-type-icon"><TicketPercent size={18} /></span>
                    <div>
                      <div className="seller-voucher-code-row">
                        <strong>{voucher.code}</strong>
                        <span className={`seller-voucher-status ${voucher.status === 'Aktif' ? 'active' : 'inactive'}`}>{voucher.status}</span>
                      </div>
                      <p>{voucher.name || 'Voucher toko'}</p>
                    </div>
                  </div>
                  <div className="seller-voucher-value">
                    <span>Benefit</span>
                    <b>{voucherValue(voucher)}</b>
                  </div>
                </div>

                <div className="seller-voucher-meta-grid">
                  <div><span>Minimum belanja</span><b>{rupiah(voucher.min_purchase)}</b></div>
                  <div><span>Maks. diskon</span><b>{voucher.type === 'percent' && voucher.max_discount ? rupiah(voucher.max_discount) : '-'}</b></div>
                  <div><span>Berlaku sampai</span><b>{formatDate(voucher.end_at)}</b></div>
                </div>

                <div className="seller-voucher-usage">
                  <div><span>Penggunaan</span><b>{used}/{quota || '∞'}</b></div>
                  <div className="seller-voucher-progress"><i style={{ width: `${usage}%` }} /></div>
                </div>

                <div className="seller-voucher-actions">
                  <Button type="button" variant="outline" onClick={() => edit(voucher)}><Pencil size={15} /> Edit</Button>
                  <Button type="button" variant="outline" onClick={() => void toggle(voucher)}><Power size={15} /> {voucher.status === 'Aktif' ? 'Nonaktifkan' : 'Aktifkan'}</Button>
                  <button type="button" className="seller-danger-icon" onClick={() => void remove(voucher)} title="Hapus voucher"><Trash2 size={16} /></button>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <div className="seller-empty-state"><TicketPercent size={30} /><b>Belum ada voucher</b><span>Buat voucher pertama untuk mulai menjalankan promo.</span></div>
      )}

      {open ? (
        <div className="seller-modal-backdrop fixed inset-0 z-50 overflow-y-auto p-4">
          <div className="seller-voucher-modal mx-auto max-w-2xl rounded-3xl border p-6 shadow-2xl">
            <form onSubmit={submit} className="grid gap-5">
              <div className="seller-modal-title-row">
                <div>
                  <span className="seller-eyebrow">PROMO TOKO</span>
                  <h2>{form.id ? 'Edit Voucher' : 'Buat Voucher'}</h2>
                </div>
                <button type="button" onClick={() => setOpen(false)} className="seller-modal-close" aria-label="Tutup"><X size={18} /></button>
              </div>

              <div className="seller-form-grid two-col">
                <label className="seller-field"><span>Kode voucher</span><Input required placeholder="Contoh: HEMAT10" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></label>
                <label className="seller-field"><span>Nama promo</span><Input placeholder="Diskon akhir pekan" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
                <label className="seller-field"><span>Jenis voucher</span><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Voucher['type'] })}><option value="percent">Persentase</option><option value="fixed">Nominal</option><option value="shipping">Gratis Ongkir</option></select></label>
                <label className="seller-field"><span>Nilai voucher</span><Input type="number" placeholder="10" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></label>
                <label className="seller-field"><span>Maksimum diskon</span><Input type="number" placeholder="50000" value={form.max_discount} onChange={(e) => setForm({ ...form, max_discount: e.target.value })} /></label>
                <label className="seller-field"><span>Minimum belanja</span><Input type="number" placeholder="100000" value={form.min_purchase} onChange={(e) => setForm({ ...form, min_purchase: e.target.value })} /></label>
                <label className="seller-field"><span>Kuota</span><Input type="number" placeholder="100" value={form.quota} onChange={(e) => setForm({ ...form, quota: e.target.value })} /></label>
                <label className="seller-field"><span>Status</span><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option>Aktif</option><option>Nonaktif</option></select></label>
                <label className="seller-field"><span>Mulai berlaku</span><Input type="datetime-local" value={form.start_at} onChange={(e) => setForm({ ...form, start_at: e.target.value })} /></label>
                <label className="seller-field"><span>Berakhir</span><Input type="datetime-local" value={form.end_at} onChange={(e) => setForm({ ...form, end_at: e.target.value })} /></label>
              </div>

              <div className="seller-modal-footer">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button>
                <Button disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan Voucher'}</Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  )
}

export default SellerVouchersPage
