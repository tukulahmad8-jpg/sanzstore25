import { useQuery } from '@tanstack/react-query'
import { Card } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { getProducts } from '@/services/products.service'
import { formatCurrency } from '@/utils/format'
export function ProductsPage(){const {data}=useQuery({queryKey:['products'],queryFn:getProducts});const products=data?.data??[];return <main className='p-6'><div className='mb-5 flex items-center justify-between'><div><h1 className='text-3xl font-black'>Produk</h1></div><Button>+ Tambah Produk</Button></div><Card className='bg-[#151f2d] text-white border-slate-800'><div className='grid gap-3'>{products.map((p)=><div key={p.id} className='grid grid-cols-[64px_1fr_auto_auto] items-center gap-3 rounded-xl border border-slate-800 p-3'><img src={p.image} alt={p.title} className='h-16 w-16 rounded-xl object-cover'/><div><b>{p.title}</b><p className='text-sm text-slate-400'>{p.category}</p></div><strong>{formatCurrency(p.price)}</strong><span>Stok {p.stock}</span></div>)}</div></Card></main>}
