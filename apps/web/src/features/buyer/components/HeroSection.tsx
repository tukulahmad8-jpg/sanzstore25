import { Link } from 'react-router-dom'
import { Button } from '@/components/common/Button'

export function HeroSection() {
  return (
    <section className="mb-8 overflow-hidden rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-8 shadow-soft md:p-10 lg:p-12">
      <div className="grid items-center gap-8 lg:grid-cols-[1fr_420px]">
        <div>
          <h1 className="mt-2 max-w-3xl text-5xl font-black leading-tight tracking-tight md:text-7xl">
            Jual Barang <span className="text-brand">Termurah</span>
            <br />
            Se-Indonesia.
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-[var(--muted)]">
            Temukan produk pilihan dengan harga termurah, pembayaran aman, dan pengiriman cepat ke seluruh Indonesia.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button>
              <Link to="/#products">Mulai Belanja</Link>
            </Button>
            <Button variant="outline">
              <Link to="/#categories">Jelajahi Kategori</Link>
            </Button>
          </div>
          <div className="mt-5 inline-flex rounded-2xl border border-brand/30 bg-brand/10 px-4 py-3 text-sm font-black text-brand">
            Gratis Ongkir Maks. Rp10.000 • Min. Belanja Rp100.000
          </div>
        </div>

        <div className="grid gap-3">
          {[
            ['🚚', 'Gratis Ongkir', 'Otomatis min. Rp100.000, potongan maks. Rp10.000.'],
            ['🔒', 'Pembayaran Aman', 'Bayar lewat Pakasir setelah order dibuat.'],
            ['📦', 'Pengiriman Cepat', 'JNE, J&T, dan JNE Cargo via Biteship.'],
          ].map(([icon, title, desc]) => (
            <div key={title} className="rounded-2xl border border-[var(--line)] bg-[var(--background)] p-4">
              <span className="text-2xl">{icon}</span>
              <b className="ml-2">{title}</b>
              <p className="mt-1 text-sm text-[var(--muted)]">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
