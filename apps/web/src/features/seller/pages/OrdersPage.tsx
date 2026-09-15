import { useQuery } from '@tanstack/react-query'
import { Card } from '@/components/common/Card'
import { getOrders } from '@/services/orders.service'
import { formatCurrency } from '@/utils/format'
export function OrdersPage(){const {data}=useQuery({queryKey:['orders'],queryFn:getOrders});const orders=data?.data??[];return <main className='p-6'><h1 className='text-3xl font-black'>Pesanan</h1><Card className='mt-5 bg-[#151f2d] text-white border-slate-800'><div className='grid gap-3'>{orders.length?orders.map((o)=><div key={o.id} className='rounded-xl border border-slate-800 p-4'><div className='flex justify-between'><b>{o.id}</b><span className='text-brand'>{o.status}</span></div><p className='text-slate-400'>{o.customer?.name}</p><strong>{formatCurrency(o.total)}</strong></div>):<p className='text-slate-400'>Belum ada pesanan.</p>}</div></Card></main>}
