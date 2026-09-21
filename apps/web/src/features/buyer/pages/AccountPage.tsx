import { FormEvent, useEffect, useMemo, useState } from 'react'
import { confirmAction, toast } from '@/lib/notify'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Card } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { Input } from '@/components/common/Input'
import { getOrders } from '@/services/orders.service'
import { getProducts } from '@/services/products.service'
import { getAddresses, saveAddresses, type BuyerAddress } from '@/services/address.service'
import { searchLocations, type LocationOption } from '@/services/location.service'
import { formatCurrency } from '@/utils/format'
import { useAuthStore } from '@/stores/auth.store'
import { useWishlistStore } from '@/stores/wishlist.store'
import { useCartStore } from '@/stores/cart.store'

const tabs = [
  ['profile', 'Profil'],
  ['address', 'Alamat'],
  ['orders', 'Pesanan'],
  ['wishlist', 'Wishlist'],
] as const

type OrderFilter = 'all' | 'unpaid' | 'process' | 'shipped' | 'done'

type Tab = typeof tabs[number][0]

const emptyAddress: BuyerAddress = {
  id: '',
  label: 'Rumah',
  recipient: '',
  phone: '',
  province: '',
  city: '',
  district: '',
  village: '',
  postalCode: '',
  address: '',
  landmark: '',
  rajaongkirDestinationId: '',
  isMain: true,
}

function createAddressId() {
  if (typeof crypto !== 'undefined') {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
    if (typeof crypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(16)
      crypto.getRandomValues(bytes)
      return `addr-${Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('')}`
    }
  }
  return `addr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function AccountPage() {
  const userId = useAuthStore((state) => state.user?.id)
  return <AccountContent key={userId ?? 'guest'} />
}

function AccountContent() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const [searchParams, setSearchParams] = useSearchParams()
  const wishlistIds = useWishlistStore((state) => state.ids)
  const hydrateWishlist = useWishlistStore((state) => state.hydrate)
  const removeWishlist = useWishlistStore((state) => state.remove)
  const addToCart = useCartStore((state) => state.addToCart)
  const logout = useAuthStore((state) => state.logout)
  const updateProfile = useAuthStore((state) => state.updateProfile)
  const [active, setActiveState] = useState<Tab>((searchParams.get('tab') as Tab) || 'orders')
  const [orderFilter, setOrderFilter] = useState<OrderFilter>('all')
  const [addresses, setAddresses] = useState<BuyerAddress[]>([])
  const [addressForm, setAddressForm] = useState<BuyerAddress>(emptyAddress)
  const [showAddressForm, setShowAddressForm] = useState(false)
  const [locationKeyword, setLocationKeyword] = useState('')
  const [locations, setLocations] = useState<LocationOption[]>([])
  const [locationOpen, setLocationOpen] = useState(false)
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [locationError, setLocationError] = useState('')
  const [profileName, setProfileName] = useState(user?.name ?? '')
  const [profilePhone, setProfilePhone] = useState(user?.phone ?? '')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMessage, setProfileMessage] = useState('')
  const [addressSaving, setAddressSaving] = useState(false)
  const [addressError, setAddressError] = useState('')
  const [addressReady, setAddressReady] = useState(false)

  const { data: orderData, isPending: ordersPending, error: ordersError, refetch: refetchOrders } = useQuery({ queryKey: ['buyer-orders', user?.id], queryFn: getOrders, enabled: !!user?.id })
  const { data: productData } = useQuery({ queryKey: ['products'], queryFn: getProducts })
  const orders = orderData?.data ?? []
  const products = productData?.data ?? []


  useEffect(() => {
    setProfileName(user?.name ?? '')
    setProfilePhone(user?.phone ?? '')
  }, [user?.name, user?.phone])

  useEffect(() => {
    hydrateWishlist()
    let cancelled = false
    getAddresses().then((result) => {
      if (cancelled) return
      setAddresses(result.data)
      setAddressReady(true)
    }).catch((error) => { if (!cancelled) setAddressError(error.message) })
    return () => { cancelled = true }
  }, [hydrateWishlist])

  useEffect(() => {
    if (!locationOpen) return
    const keyword = locationKeyword.trim()
    if (keyword.length < 2) {
      setLocations([])
      setLocationStatus('idle')
      return
    }
    let cancelled = false
    setLocationStatus('loading')
    const timeout = window.setTimeout(() => {
      searchLocations(keyword).then((result) => {
        if (cancelled) return
        setLocations(result.data)
        setLocationError(result.error || '')
        setLocationStatus(result.error ? 'error' : 'done')
      })
    }, 300)
    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [locationKeyword, locationOpen])

  useEffect(() => {
    const tab = (searchParams.get('tab') as Tab) || 'orders'
    if (tabs.some(([key]) => key === tab)) setActiveState(tab)
  }, [searchParams])

  function setActive(tab: Tab) {
    setActiveState(tab)
    setSearchParams(tab === 'orders' ? {} : { tab })
  }

  const filteredOrders = useMemo(() => {
    if (orderFilter === 'unpaid') return orders.filter((order) => ['Belum Bayar', 'Menunggu Pembayaran'].includes(order.status))
    if (orderFilter === 'process') return orders.filter((order) => ['Diproses', 'Dikemas'].includes(order.status))
    if (orderFilter === 'shipped') return orders.filter((order) => order.status === 'Dikirim')
    if (orderFilter === 'done') return orders.filter((order) => order.status === 'Selesai')
    return orders
  }, [orders, orderFilter])

  const wishlistProducts = products.filter((product) => wishlistIds.includes(product.id))

  if (!user) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <Card className="text-center">
          <h1 className="text-3xl font-bold">Masuk untuk melihat akun</h1>
          <p className="mt-2 text-[var(--muted)]">Klik tombol Masuk di navbar untuk login atau daftar.</p>
        </Card>
      </main>
    )
  }

  function selectLocation(location: LocationOption) {
    setAddressForm({
      ...addressForm,
      rajaongkirDestinationId: location.id,
      province: location.province,
      city: location.city,
      district: location.district,
      village: location.village,
      postalCode: location.postalCode,
    })
    setLocationKeyword(location.label)
    setLocationOpen(false)
    setLocations([])
  }

  async function handleAddressSubmit(event: FormEvent) {
    event.preventDefault()
    if (!addressReady || addressSaving) return

    const nextAddress = {
      ...addressForm,
      id: addressForm.id || createAddressId(),
      recipient: addressForm.recipient || user?.name || 'Customer',
      phone: addressForm.phone || user?.phone || '',
      isMain: addresses.length === 0 ? true : addressForm.isMain,
    }

    let next = addresses.some((item) => item.id === nextAddress.id)
      ? addresses.map((item) => item.id === nextAddress.id ? nextAddress : item)
      : [...addresses, nextAddress]

    if (nextAddress.isMain) next = next.map((item) => ({ ...item, isMain: item.id === nextAddress.id }))

    setAddressSaving(true)
    setAddressError('')
    try {
      await saveAddresses(next)
      setAddresses(next)
      setAddressForm(emptyAddress)
      setLocationKeyword('')
      setShowAddressForm(false)
    } catch (error) {
      setAddressError(error instanceof Error ? error.message : 'Alamat gagal disimpan.')
    } finally {
      setAddressSaving(false)
    }
  }

  async function handleProfileSubmit(event: FormEvent) {
    event.preventDefault()
    setProfileSaving(true)
    setProfileMessage('')
    try {
      await updateProfile({ name: profileName, phone: profilePhone })
      setProfileMessage('Profil berhasil diperbarui.')
    } catch (error) {
      setProfileMessage(error instanceof Error ? error.message : 'Profil gagal diperbarui.')
    } finally {
      setProfileSaving(false)
    }
  }

  function handleAddAddressClick() {
    setAddressForm(emptyAddress)
    setLocationKeyword('')
    setShowAddressForm(false)
    setShowAddressForm(true)
  }

  function handleEditAddressClick(address: BuyerAddress) {
    setAddressForm(address)
    setLocationKeyword(`${address.village}, ${address.district}, ${address.city}, ${address.province}, ${address.postalCode}`)
    setShowAddressForm(true)
  }

  async function handleSetMainAddress(addressId: string) {
    if (!addressReady || addressSaving) return
    const next = addresses.map((item) => ({ ...item, isMain: item.id === addressId }))
    await persistAddressChange(next)
  }

  async function handleDeleteAddress(addressId: string) {
    if (!addressReady || addressSaving) return
    if (!(await confirmAction('Hapus alamat ini?', { confirmText: 'Hapus', danger: true }))) return
    const next = addresses.filter((item) => item.id !== addressId)
    await persistAddressChange(next)
  }

  async function persistAddressChange(next: BuyerAddress[]) {
    setAddressSaving(true)
    setAddressError('')
    try { await saveAddresses(next); setAddresses(next) }
    catch (error) { setAddressError(error instanceof Error ? error.message : 'Alamat gagal disimpan.') }
    finally { setAddressSaving(false) }
  }


  return (
    <main className="account-page mx-auto grid max-w-[1440px] gap-5 px-4 py-7 lg:grid-cols-[220px_minmax(0,1fr)] xl:px-6">
      <Card className="account-sidebar h-max lg:sticky lg:top-24">
        <div className="mb-4 rounded-2xl bg-brand/10 p-4">
          <b className="text-brand">{user.name}</b>
          <p className="text-sm text-[var(--muted)]">{user.email}</p>
          <p className="text-sm text-[var(--muted)]">{user.phone}</p>
        </div>

        <nav className="account-nav">
          {tabs.map(([key, label]) => (
            <button key={key} onClick={() => setActive(key)} className={active === key ? 'is-active' : ''}>
              <span>{label}</span>
            </button>
          ))}
          <div className="account-nav-divider" />
          <button className="account-logout" onClick={async () => {
            try { await logout(); navigate('/') }
            catch { toast('Logout belum berhasil. Periksa koneksi Anda lalu coba lagi.', 'error') }
          }}>Keluar</button>
        </nav>
      </Card>

      <Card>
        {active === 'orders' && ordersPending ? <p role="status">Memuat riwayat pesanan...</p> : null}
        {active === 'orders' && ordersError ? <div role="alert"><p>Riwayat pesanan belum berhasil dimuat. Periksa koneksi Anda.</p><Button onClick={() => void refetchOrders()}>Coba Lagi</Button></div> : null}
        {active === 'profile' ? (
          <section className="account-panel">
            <p className="account-eyebrow">AKUN</p>
            <h1 className="account-title">Profil Saya</h1>
            <form onSubmit={handleProfileSubmit} className="mt-6">
              <div className="grid gap-3 md:grid-cols-2">
                <Input value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder="Nama lengkap" />
                <Input value={user.email} readOnly aria-label="Email akun" />
                <Input value={profilePhone} onChange={(event) => setProfilePhone(event.target.value)} placeholder="Nomor WhatsApp" />
              </div>
              <div className="mt-4 flex items-center gap-3">
                <Button type="submit" disabled={profileSaving}>{profileSaving ? 'Menyimpan...' : 'Simpan Profil'}</Button>
                {profileMessage ? <span className="text-sm text-[var(--muted)]">{profileMessage}</span> : null}
              </div>
            </form>
          </section>
        ) : active === 'address' ? (
          <section className="account-panel">
            <div className="account-heading-row">
              <div><p className="account-eyebrow">PENGIRIMAN</p><h1 className="account-title">Alamat Saya</h1></div>
              <Button type="button" disabled={!addressReady || addressSaving} onClick={handleAddAddressClick}>+ Tambah Alamat</Button>
            </div>
            {addressError ? <p role="alert" className="mb-3 text-sm text-red-500">{addressError} {!addressReady ? <button onClick={() => window.location.reload()}>Muat ulang</button> : null}</p> : !addressReady ? <p>Memuat alamat...</p> : null}
            <div className="address-grid">
              {addresses.length ? addresses.map((address) => (
                <article key={address.id} className={`address-card ${address.isMain ? 'is-main' : ''}`}>
                  <div className="address-card-top"><span className="address-label">{address.label || 'Alamat'}</span>{address.isMain ? <span className="address-main-badge">Utama</span> : null}</div>
                  <h3>{address.recipient}</h3><p className="address-phone">{address.phone}</p>
                  <p className="address-street">{address.address}{address.landmark ? `, ${address.landmark}` : ''}</p>
                  <p className="address-region">{[address.village ? `Kel. ${address.village}` : '', address.district ? `Kec. ${address.district}` : '', address.city, address.province, address.postalCode].filter(Boolean).join(', ')}</p>
                  <div className="address-actions"><button type="button" onClick={() => handleEditAddressClick(address)}>Ubah</button>{!address.isMain ? <button type="button" onClick={() => handleSetMainAddress(address.id)}>Jadikan Utama</button> : null}<button className="danger" type="button" onClick={() => handleDeleteAddress(address.id)}>Hapus</button></div>
                </article>
              )) : addressReady ? <div className="account-empty">Belum ada alamat. Tambahkan alamat untuk mulai checkout.</div> : null}
            </div>
            {showAddressForm ? <div className="address-modal-backdrop" onMouseDown={(e) => { if (e.currentTarget === e.target) setShowAddressForm(false) }}><form onSubmit={handleAddressSubmit} className="address-modal">
              <div className="address-modal-head"><div><p className="account-eyebrow">ALAMAT</p><h2>{addressForm.id ? 'Edit Alamat' : 'Tambah Alamat Baru'}</h2></div><button type="button" onClick={() => setShowAddressForm(false)}>✕</button></div>
              <div className="address-form-grid">
                <label className="address-field"><span>Nama Lengkap</span><Input required placeholder="Contoh: Ikhsan Wahyudi" value={addressForm.recipient} onChange={(e) => setAddressForm({ ...addressForm, recipient: e.target.value })}/></label>
                <label className="address-field"><span>Nomor Telepon</span><Input required inputMode="tel" placeholder="08xxxxxxxxxx" value={addressForm.phone} onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })}/></label>
                <div className="address-field address-field-full"><span>Provinsi / Kota / Kecamatan / Kelurahan</span><div className="relative"><Input required className="w-full" placeholder="Cari provinsi, kota, kecamatan, kode pos" value={locationKeyword} onFocus={() => setLocationOpen(true)} onChange={(e) => { setLocationKeyword(e.target.value); setLocationOpen(true) }}/>{locationOpen ? <div className="location-results polished-location-results">{locations.length ? locations.map((location,index)=><button key={`${location.label}-${index}`} type="button" onClick={()=>selectLocation(location)}><b>{location.district || location.city}</b><span>{location.label}</span></button>) : <p>{locationStatus === 'loading' ? 'Mencari lokasi...' : locationStatus === 'error' ? locationError : locationStatus === 'done' ? 'Lokasi tidak ditemukan. Coba nama kecamatan atau kota.' : 'Ketik minimal 2 huruf untuk mencari lokasi.'}</p>}</div> : null}</div></div>
                <label className="address-field address-field-full"><span>Nama Jalan, Gedung, No. Rumah</span><Input required className="w-full" placeholder="Contoh: Jl. Adil RT 04/06 No. 12" value={addressForm.address} onChange={(e)=>setAddressForm({...addressForm,address:e.target.value})}/></label>
                <label className="address-field address-field-full"><span>Detail Alamat <small>(opsional)</small></span><Input className="w-full" placeholder="Blok, unit, patokan, warna rumah, dll." value={addressForm.landmark} onChange={(e)=>setAddressForm({...addressForm,landmark:e.target.value})}/></label>
              </div>
              <div className="address-form-bottom"><div><span className="address-bottom-label">Jenis Alamat</span><div className="address-label-choice">{['Rumah','Kantor'].map(label=><button key={label} type="button" onClick={()=>setAddressForm({...addressForm,label})} className={addressForm.label===label?'active':''}>{label}</button>)}</div></div><label className="address-main-check"><input type="checkbox" checked={addressForm.isMain} onChange={(e)=>setAddressForm({...addressForm,isMain:e.target.checked})}/> <span>Jadikan alamat utama</span></label></div>
              {addressError ? <p className="mt-3 text-sm text-red-500">{addressError}</p> : null}<div className="address-modal-actions"><Button type="button" variant="outline" onClick={()=>setShowAddressForm(false)}>Batal</Button><Button type="submit" disabled={addressSaving}>{addressSaving ? 'Menyimpan...' : 'Simpan Alamat'}</Button></div>
            </form></div> : null}
          </section>
        ) : active === 'wishlist' ? (
          <section className="account-panel">
            <div className="account-heading-row"><div><p className="account-eyebrow">KOLEKSI</p><h1 className="account-title">Wishlist Saya</h1></div></div>
            <div className="wishlist-list">{wishlistProducts.length ? wishlistProducts.map(product=><article className="wishlist-row interactive-card" key={product.id}><Link to={`/product/${product.id}`} className="wishlist-row-image interactive-image"><img src={product.image || product.images?.[0] || '/placeholder.svg'} alt={product.title}/>{product.stock<=0?<span>Stok Habis</span>:null}</Link><div className="wishlist-row-info"><p className="wishlist-category">{product.category}</p><Link to={`/product/${product.id}`} className="wishlist-row-title">{product.title}</Link><div className="wishlist-meta"><span>Terjual {product.sold || 0}</span><span>Stok {product.stock}</span></div><strong>{formatCurrency(product.price)}</strong></div><div className="wishlist-row-actions"><Button type="button" disabled={product.stock<=0} onClick={()=>addToCart(product,1)}>+ Keranjang</Button><Button type="button" variant="outline" onClick={()=>removeWishlist(product.id)}>Hapus</Button></div></article>) : <div className="account-empty">Wishlist masih kosong. Simpan produk yang Anda suka dari halaman produk.</div>}</div>
          </section>
        ) : ordersPending || ordersError ? null : (
          <section className="account-panel">
            <div className="account-heading-row"><div><p className="account-eyebrow">TRANSAKSI</p><h1 className="account-title">Pesanan Saya</h1></div><span className="order-count">{filteredOrders.length} pesanan</span></div>
            <div className="order-tabs">{[['all','Semua'],['unpaid','Belum Bayar'],['process','Diproses'],['shipped','Dikirim'],['done','Selesai']].map(([key,label])=><button key={key} onClick={()=>setOrderFilter(key as OrderFilter)} className={orderFilter===key?'active':''}>{label}</button>)}</div>
            <div className="orders-list">{filteredOrders.length ? filteredOrders.map((order:any)=>{const first=order.items?.[0]; const img=first?.product?.image || first?.product?.images?.[0]; return <article className="order-card" key={order.id}><div className="order-card-head"><div><span className="order-invoice">{order.id}</span><span className="order-date">{order.created_at ? new Date(order.created_at).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}) : ''}</span></div><span className={`order-status status-${String(order.status).toLowerCase().replace(/\s+/g,'-')}`}>{order.status}</span></div><div className="order-product-row">{first?.product?.id ? <Link to={`/product/${first.product.id}`} className="order-product-image-link">{img?<img src={img} alt={first?.product?.title || first?.title || 'Produk'}/>:<div className="order-image-placeholder">▣</div>}</Link> : (img?<img src={img} alt=""/>:<div className="order-image-placeholder">▣</div>)}<div className="order-product-copy">{first?.product?.id ? <Link to={`/product/${first.product.id}`} className="order-product-title-link">{first?.product?.title || first?.title || `${order.items?.length || 0} produk`}</Link> : <b>{first?.product?.title || first?.title || `${order.items?.length || 0} produk`}</b>}<span>{order.items?.length || 0} item{(order.items?.length||0)>1 ? ` • +${order.items.length-1} produk lainnya` : ''}</span></div><div className="order-total"><span>Total Pesanan</span><strong>{formatCurrency(order.total)}</strong></div></div><div className="order-card-actions"><button onClick={()=>navigate(`/account/orders/${order.id}`)} className="order-detail-link">Lihat Detail</button>{['Belum Bayar','Menunggu Pembayaran'].includes(order.status)?<button onClick={()=>navigate(`/payment/${order.id}?amount=${order.total}&name=${encodeURIComponent(order.customer?.name || 'Buyer')}&invoice=${order.id}`)} className="order-primary-action">Bayar Sekarang</button>:null}</div></article>}) : <div className="account-empty">Belum ada pesanan pada status ini.</div>}</div>
          </section>
        )}
      </Card>
    </main>
  )
}
