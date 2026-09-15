import { useQuery } from '@tanstack/react-query'
import { Card } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { getVouchers } from '@/services/vouchers.service'
export function VouchersPage(){const {data}=useQuery({queryKey:['vouchers'],queryFn:getVouchers});const vouchers=data?.data??[];return <main className='p-6'><div className='mb-5 flex items-center justify-between'><h1 className='text-3xl font-black'>Voucher</h1><Button>+ Buat Voucher</Button></div><Card className='bg-[#151f2d] text-white border-slate-800'>{vouchers.length?vouchers.map((v)=><div key={v.id} className='mb-3 rounded-xl border border-slate-800 p-4'><b>{v.code}</b><p className='text-slate-400'>{v.name}</p></div>):<p className='text-slate-400'>Belum ada voucher.</p>}</Card></main>}
