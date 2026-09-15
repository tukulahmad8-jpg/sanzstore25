import { FormEvent, useMemo, useState } from 'react'
import { confirmAction } from '@/lib/notify'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Boxes, Pencil, Plus, Power, Search, Trash2, X } from 'lucide-react'
import { Button } from '@/components/common/Button'
import { Card } from '@/components/common/Card'
import { Input } from '@/components/common/Input'
import { deleteProduct, getProducts, saveProduct } from '@/services/products.service'
import { uploadProductImage } from '@/services/upload.service'
import type { Product, ProductVariant } from '@/types/domain'
import { formatCurrency, slugify } from '@/utils/format'
import { ProductImageDraft, ProductImageUploader } from '../components/ProductImageUploader'

const emptyVariant = (): ProductVariant => ({ id: `var-${Date.now()}-${Math.random().toString(36).slice(2,7)}`, name: '', sku: '', price: 0, stock: 0 })

const emptyForm = {
  id: '',
  title: '',
  category: '',
  price: '',
  cost_price: '',
  stock: '',
  weight: '250',
  rack: '',
  badge: '',
  status: 'Aktif',
  summary: '',
}

export function SellerProductsPage() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['products'], queryFn: getProducts, refetchOnMount: 'always', refetchOnWindowFocus: true })
  const products = data?.data ?? []
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [images, setImages] = useState<ProductImageDraft[]>([])
  const [saving, setSaving] = useState(false)
  const [hasVariants, setHasVariants] = useState(false)
  const [variants, setVariants] = useState<ProductVariant[]>([])
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const filtered = useMemo(() => {
    return products.filter((product) =>
      `${product.title} ${product.category}`.toLowerCase().includes(query.toLowerCase()),
    )
  }, [products, query])

  const saveMutation = useMutation({
    mutationFn: saveProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      setOpen(false)
      setForm(emptyForm)
      setImages([])
      setHasVariants(false)
      setVariants([])
    },
  })

  function editProduct(product: Product) {
    setForm({
      id: product.id,
      title: product.title,
      category: product.category,
      price: String(product.price ?? ''),
      cost_price: String(product.cost_price ?? ''),
      stock: String(product.stock ?? ''),
      weight: String(product.weight ?? '250'),
      rack: product.rack ?? '',
      badge: product.badge ?? '',
      status: product.status ?? 'Aktif',
      summary: product.summary ?? '',
    })

    setHasVariants(Boolean(product.has_variants && product.variants?.length))
    setVariants((product.variants ?? []).map((variant) => ({ ...variant })))

    setImages((product.images?.length ? product.images : [product.image].filter(Boolean)).map((url) => ({
      id: url,
      url,
      uploaded: true,
    })))

    setOpen(true)
  }


  async function removeProduct(product: Product) {
    const ok = await confirmAction(`Hapus produk ${product.title}?`, { confirmText: 'Hapus produk', danger: true })
    if (!ok) return
    await deleteProduct(product.id)
    queryClient.invalidateQueries({ queryKey: ['products'] })
  }

  async function toggleProduct(product: Product) {
    const nextStatus = product.status === 'Aktif' ? 'Nonaktif' : 'Aktif'
    setErrorMessage('')
    try {
      await saveMutation.mutateAsync({ ...product, status: nextStatus as Product['status'] })
      setSuccessMessage(`Produk berhasil ${nextStatus === 'Aktif' ? 'diaktifkan' : 'dinonaktifkan'}.`)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Status produk gagal diperbarui.')
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const uploadedImages = []
      for (const image of images) {
        if (image.file && !image.uploaded) {
          const result = await uploadProductImage(image.file)
          uploadedImages.push(result.url)
        } else {
          uploadedImages.push(image.url)
        }
      }

      const id = form.id || slugify(form.title)
      const cleanVariants = hasVariants ? variants
        .map((variant, index) => ({ ...variant, id: variant.id || `${id}-v${index+1}`, name: variant.name.trim(), sku: variant.sku?.trim() || '', price: Number(variant.price || 0), stock: Number(variant.stock || 0), weight: variant.weight ? Number(variant.weight) : undefined }))
        .filter((variant) => variant.name) : []
      if (hasVariants && !cleanVariants.length) throw new Error('Tambahkan minimal satu varian produk.')
      if (cleanVariants.some((variant) => variant.price <= 0)) throw new Error('Harga setiap varian harus lebih dari 0.')
      const variantStock = cleanVariants.reduce((sum, variant) => sum + variant.stock, 0)
      const variantPrice = cleanVariants.length ? Math.min(...cleanVariants.map((variant) => variant.price)) : Number(form.price || 0)
      const product: Product = {
        id,
        title: form.title,
        category: form.category || 'Produk',
        price: variantPrice,
        cost_price: Number(form.cost_price || 0),
        stock: cleanVariants.length ? variantStock : Number(form.stock || 0),
        weight: Number(form.weight || 250),
        rack: form.rack,
        image: uploadedImages[0] || '/placeholder.svg',
        images: uploadedImages.length ? uploadedImages : ['/placeholder.svg'],
        summary: form.summary,
        badge: form.badge,
        status: form.status as Product['status'],
        sold: products.find((item) => item.id === id)?.sold ?? 0,
        has_variants: cleanVariants.length > 0,
        variants: cleanVariants,
      }

      await saveMutation.mutateAsync(product)
      setSuccessMessage('Produk berhasil disimpan.')
      setForm(emptyForm)
      setImages([])
      setHasVariants(false)
      setVariants([])
      setOpen(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal menyimpan produk'
      setErrorMessage(message)
    } finally {
      setSaving(false)
    }
  }

  const previewProduct: Product = {
    id: form.id || 'preview',
    title: form.title || 'Nama Produk',
    category: form.category || 'Kategori',
    price: hasVariants && variants.length ? Math.min(...variants.map((variant) => Number(variant.price || 0)).filter(Boolean)) || 0 : Number(form.price || 0),
    cost_price: Number(form.cost_price || 0),
    stock: hasVariants ? variants.reduce((sum, variant) => sum + Number(variant.stock || 0), 0) : Number(form.stock || 0),
    weight: Number(form.weight || 250),
    rack: form.rack,
    image: images[0]?.url || '/placeholder.svg',
    images: images.map((image) => image.url),
    summary: form.summary || 'Deskripsi produk akan tampil di sini.',
    badge: form.badge,
    status: form.status as Product['status'],
    sold: 0,
    has_variants: hasVariants,
    variants,
  }

  return (
    <main className="seller-page seller-products-page">
      <div className="seller-page-heading">
        <div>
          <span className="seller-eyebrow">KATALOG PRODUK</span>
          <h1>Produk</h1>
        </div>

        <Button onClick={() => setOpen(true)} className="seller-primary-action gap-2">
          <Plus size={18} />
          Tambah Produk
        </Button>
      </div>

      {successMessage ? (
        <div className="seller-notice seller-notice-success">{successMessage}</div>
      ) : null}

      <div className="seller-product-toolbar">
        <label className="seller-search-box">
          <Search size={18} />
          <input
            placeholder="Cari nama atau kategori produk..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="seller-product-count">
          <Boxes size={17} />
          <span><b>{filtered.length}</b> dari {products.length} produk</span>
        </div>
      </div>

      <Card className="seller-product-list-card">
        <div className="seller-product-list-head" aria-hidden="true">
          <span>Produk</span>
          <span>Harga</span>
          <span>Aksi</span>
        </div>
        {isLoading ? (
          <p className="seller-loading-text">Memuat produk...</p>
        ) : filtered.length ? (
          <div className="seller-product-list">
            {filtered.map((product) => (
              <article key={product.id} className="seller-product-row">
                <img src={product.image || '/placeholder.svg'} alt={product.title} className="seller-product-thumb" />

                <div className="seller-product-info">
                  <div className="seller-product-title-line">
                    <h3>{product.title}</h3>
                    <span className={`seller-product-status ${product.status === 'Aktif' ? 'active' : 'inactive'}`}>{product.status}</span>
                  </div>
                  <p>{product.category} <i /> Stok {product.stock} <i /> Rak {product.rack || '-'}{product.has_variants && product.variants?.length ? <> <i /> {product.variants.length} varian</> : null}</p>
                  <small>Modal {formatCurrency(product.cost_price ?? 0)} · Berat {product.weight}g</small>
                </div>

                <div className="seller-product-price">
                  <span>Harga jual</span>
                  <strong>{formatCurrency(product.price)}</strong>
                </div>

                <div className="seller-product-actions">
                  <Button type="button" variant="outline" onClick={() => editProduct(product)}><Pencil size={16} /> Edit</Button>
                  <Button type="button" variant="outline" onClick={() => toggleProduct(product)}><Power size={16} /> {product.status === 'Aktif' ? 'Nonaktifkan' : 'Aktifkan'}</Button>
                  <button type="button" className="seller-danger-icon" onClick={() => removeProduct(product)} title="Hapus produk" aria-label={`Hapus ${product.title}`}><Trash2 size={17} /></button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="seller-empty-state">
            <Boxes size={28} />
            <b>Produk tidak ditemukan</b>
            <span>{query ? 'Coba gunakan kata pencarian lain.' : 'Klik Tambah Produk untuk membuat listing pertama.'}</span>
          </div>
        )}
      </Card>

      {open ? (
        <div className="seller-modal-backdrop fixed inset-0 z-50 overflow-y-auto p-4">
          <div className="seller-product-modal mx-auto grid max-w-6xl gap-5 rounded-3xl border p-6 shadow-2xl lg:grid-cols-[1fr_360px]">
            <form onSubmit={handleSubmit} className="grid gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black">{form.id ? 'Edit Produk' : 'Tambah Produk'}</h2>
                  <p className="text-sm text-[var(--seller-muted)]">Foto pertama otomatis menjadi cover.</p>
                </div>
                <button type="button" onClick={() => setOpen(false)} className="grid h-10 w-10 place-items-center rounded-full border">
                  <X size={18} />
                </button>
              </div>

              {errorMessage ? (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm font-bold text-red-500">
                  {errorMessage}
                </div>
              ) : null}

              <ProductImageUploader images={images} onChange={setImages} />

              <div className="grid gap-3 md:grid-cols-2">
                <Input required placeholder="Nama produk" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                <Input placeholder="Kategori" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
                <Input type="number" disabled={hasVariants} placeholder={hasVariants ? "Harga otomatis dari varian" : "Harga jual"} value={hasVariants ? "" : form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                <Input type="number" placeholder="Harga modal" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} />
                <Input type="number" disabled={hasVariants} placeholder={hasVariants ? "Stok otomatis dari varian" : "Stok"} value={hasVariants ? "" : form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
                <Input type="number" min="1" placeholder="Berat produk (gram)" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} />
                <Input placeholder="Rak gudang, contoh A3" value={form.rack} onChange={(e) => setForm({ ...form, rack: e.target.value })} />
                <select
                  value={form.badge}
                  onChange={(e) => setForm({ ...form, badge: e.target.value })}
                  className="h-11 rounded-xl border px-3"
                >
                  <option value="">Tanpa badge</option>
                  <option value="Hot">Hot</option>
                  <option value="New">New</option>
                  <option value="Promo">Promo</option>
                  <option value="Flash Sale">Flash Sale</option>
                </select>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="h-11 rounded-xl border px-3"
                >
                  <option>Aktif</option>
                  <option>Nonaktif</option>
                </select>
              </div>

              <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)]/40 p-4">
                <label className="flex cursor-pointer items-center justify-between gap-4">
                  <div><b>Varian Produk</b><p className="mt-1 text-xs text-[var(--seller-muted)]">Aktifkan untuk ukuran, warna, tipe, kapasitas, dan pilihan lainnya.</p></div>
                  <input type="checkbox" checked={hasVariants} onChange={(e) => { setHasVariants(e.target.checked); if (e.target.checked && !variants.length) setVariants([emptyVariant()]) }} className="h-5 w-5 accent-brand" />
                </label>
                {hasVariants ? <div className="mt-4 grid gap-3">
                  {variants.map((variant, index) => <div key={variant.id} className="variant-editor-row">
                    <div className="variant-editor-number">{index + 1}</div>
                    <Input required placeholder="Nama varian, contoh: Hitam / 128GB" value={variant.name} onChange={(e)=>setVariants((rows)=>rows.map((row,i)=>i===index?{...row,name:e.target.value}:row))}/>
                    <Input placeholder="SKU (opsional)" value={variant.sku ?? ''} onChange={(e)=>setVariants((rows)=>rows.map((row,i)=>i===index?{...row,sku:e.target.value}:row))}/>
                    <Input required type="number" min="0" placeholder="Harga" value={variant.price || ''} onChange={(e)=>setVariants((rows)=>rows.map((row,i)=>i===index?{...row,price:Number(e.target.value)}:row))}/>
                    <Input required type="number" min="0" placeholder="Stok" value={variant.stock || ''} onChange={(e)=>setVariants((rows)=>rows.map((row,i)=>i===index?{...row,stock:Number(e.target.value)}:row))}/>
                    <button type="button" aria-label="Hapus varian" onClick={()=>setVariants((rows)=>rows.filter((_,i)=>i!==index))} className="variant-remove"><Trash2 size={17}/></button>
                  </div>)}
                  <button type="button" onClick={()=>setVariants((rows)=>[...rows,emptyVariant()])} className="variant-add"><Plus size={16}/> Tambah Varian</button>
                  <p className="text-xs text-[var(--seller-muted)]">Stok produk akan otomatis menjadi total stok semua varian. Harga utama menggunakan harga varian termurah.</p>
                </div> : null}
              </section>

              <textarea
                placeholder="Deskripsi produk"
                value={form.summary}
                onChange={(e) => setForm({ ...form, summary: e.target.value })}
                className="min-h-28 rounded-xl border p-3"
              />

              <Button disabled={saving} className="w-full">
                {saving ? 'Menyimpan... jangan tutup halaman' : 'Simpan Produk'}
              </Button>
            </form>

            <aside className="lg:sticky lg:top-5 h-max">
              <Card>
                <p className="mb-3 font-bold text-brand">Live Preview</p>
                <div className="overflow-hidden rounded-2xl border">
                  <img src={previewProduct.image} alt="" className="aspect-square w-full object-cover" />
                  <div className="p-4">
                    <div className="flex items-center justify-between gap-2"><small className="text-[var(--seller-muted)]">{previewProduct.category}</small>{previewProduct.badge ? <span className="rounded-full bg-brand/10 px-2 py-1 text-xs font-black text-brand">{previewProduct.badge}</span> : null}</div>
                    <h3 className="mt-1 font-black">{previewProduct.title}</h3>
                    <strong className="mt-2 block text-2xl text-brand">{formatCurrency(previewProduct.price)}</strong>
                    <p className="mt-2 text-sm text-[var(--seller-muted)]">Stok {previewProduct.stock} • Rak {previewProduct.rack || '-'}{hasVariants ? ` • ${variants.length} varian` : ''}</p>
                  </div>
                </div>
              </Card>
            </aside>
          </div>
        </div>
      ) : null}
    </main>
  )
}
