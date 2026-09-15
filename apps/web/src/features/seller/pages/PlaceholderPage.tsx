import { Card } from '@/components/common/Card'

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <main className="p-6">
      <h1 className="mb-5 text-3xl font-black">{title}</h1>
      <Card>Halaman ini akan dilanjutkan pada sprint berikutnya.</Card>
    </main>
  )
}
