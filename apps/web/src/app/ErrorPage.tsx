import { useEffect } from 'react'
import { Link, useRouteError } from 'react-router-dom'
import { Button } from '@/components/common/Button'
import { Card } from '@/components/common/Card'

export function ErrorPage() {
  const error = useRouteError() as { status?: number; statusText?: string; message?: string } | undefined

  // Cadangan untuk kasus file halaman lama tidak ditemukan setelah deploy baru:
  // muat ulang sekali, bukan menampilkan pesan teknis ke pengguna.
  useEffect(() => {
    const message = String(error?.message ?? '')
    if (!/dynamically imported module|Importing a module script failed/i.test(message)) return
    try {
      const last = Number(sessionStorage.getItem('ss25_chunk_reload_at') || 0)
      if (Date.now() - last < 10000) return
      sessionStorage.setItem('ss25_chunk_reload_at', String(Date.now()))
    } catch {
      // abaikan
    }
    window.location.reload()
  }, [error])

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--background)] p-4 text-[var(--text)]">
      <Card className="max-w-xl text-center">
        <p className="font-bold text-brand">SanzStore25</p>
        <h1 className="mt-2 text-3xl font-black">
          {error?.status === 404 ? 'Halaman tidak ditemukan' : 'Terjadi kesalahan'}
        </h1>
        <p className="mt-3 text-[var(--muted)]">
          {error?.statusText || error?.message || 'Silakan kembali ke halaman utama.'}
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <Link to="/">
            <Button>Ke Toko</Button>
          </Link>
          <Link to="/seller">
            <Button variant="outline">Ke Seller</Button>
          </Link>
        </div>
      </Card>
    </main>
  )
}
