import { useEffect, useState } from 'react'
import { confirmAction } from '@/lib/notify'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CreditCard, Truck, WalletCards } from 'lucide-react'
import { Button } from '@/components/common/Button'
import { completeBuyerOrder, getOrders, submitBuyerRefundDestination } from '@/services/orders.service'
import { formatCurrency } from '@/utils/format'
import { formatShippingLabel } from '@/services/shipping.service'
import type { Order } from '@/types/domain'

const steps = ['Belum Bayar','Diproses','Dikirim','Selesai']
function stepIndex(status:string){ if(['Selesai'].includes(status)) return 3; if(['Dikirim'].includes(status)) return 2; if(['Diproses','Dikemas','Packing','Dibayar'].includes(status)) return 1; return 0 }

function trackingUrl(courier: string, resi: string) {
 const name=String(courier||'').toLowerCase()
 if(name.includes('jne')) return 'https://www.jne.co.id/tracking-package'
 if(name.includes('j&t')||name.includes('jnt')) return 'https://jet.co.id/track'
 if(name.includes('anteraja')) return 'https://anteraja.id/tracking'
 if(name.includes('sicepat')) return 'https://www.sicepat.com/'
 return `https://www.google.com/search?q=${encodeURIComponent(`cek resi ${courier} ${resi}`)}`
}
export function BuyerOrderDetailPage(){
 const {orderId=''}=useParams(); const navigate=useNavigate(); const [order,setOrder]=useState<Order|null>(null); const [loading,setLoading]=useState(true); const [saving,setSaving]=useState(false); const [error,setError]=useState(''); const [refundType,setRefundType]=useState<'bank'|'ewallet'>('bank'); const [refundProvider,setRefundProvider]=useState(''); const [refundAccount,setRefundAccount]=useState(''); const [refundName,setRefundName]=useState(''); const [refundEditing,setRefundEditing]=useState(false)
 async function load(){setLoading(true);setError('');try{const r=await getOrders();setOrder((r.data||[]).find(i=>i.id===orderId)||null)}catch(e){setError(e instanceof Error?e.message:'Gagal memuat detail pesanan.')}finally{setLoading(false)}}
 useEffect(()=>{void load()},[orderId])
 useEffect(()=>{const d=((order as any)?.refund?.destination||{}) as Record<string,any>; if(d.type==='bank'||d.type==='ewallet')setRefundType(d.type); setRefundProvider(String(d.provider||'')); setRefundAccount(String(d.account_number||'')); setRefundName(String(d.account_name||'')); setRefundEditing(false)},[order])
 async function saveRefundDestination(){if(!order)return; if(refundProvider.trim().length<2||refundAccount.replace(/\D/g,'').length<6||refundName.trim().length<2){setError('Lengkapi bank/e-wallet, nomor tujuan, dan nama pemilik.');return} setSaving(true);setError('');try{const r=await submitBuyerRefundDestination(order.id,{type:refundType,provider:refundProvider.trim(),account_number:refundAccount.replace(/\s/g,''),account_name:refundName.trim()});setOrder(r.order);setRefundEditing(false)}catch(e){setError(e instanceof Error?e.message:'Data tujuan refund gagal disimpan.')}finally{setSaving(false)}}
 async function markReceived(){if(!order||!(await confirmAction('Konfirmasi bahwa pesanan sudah diterima?', { confirmText: 'Sudah diterima' })))return;setSaving(true);try{const r=await completeBuyerOrder(order.id);setOrder(r.data||order)}catch(e){setError(e instanceof Error?e.message:'Gagal menyelesaikan pesanan.')}finally{setSaving(false)}}
 if(loading)return <main className="order-detail-shell"><p>Memuat detail pesanan...</p></main>; if(!order)return <main className="order-detail-shell"><div className="order-detail-empty">Pesanan tidak ditemukan.<Button className="mt-4" onClick={()=>navigate('/account?tab=orders')}>Kembali</Button></div></main>
 const shipping=(order.shipping||{}) as Record<string,any>
 const rawPaymentStatus=String((order as any).payment_status||(order as any).payment?.status||'').toLowerCase()
 const paymentPending=['pending','unpaid','waiting','waiting_payment'].includes(rawPaymentStatus)
 const paymentExpired=['expired','failed','cancelled','canceled'].includes(rawPaymentStatus)
 const refundData=((order as any).refund||{}) as Record<string,any>
 const refundDestination=(refundData.destination||{}) as Record<string,any>
 const hasRefundDestination=Boolean(refundDestination.provider&&refundDestination.account_number&&refundDestination.account_name)
 const isRefund=order.status==='Refund'
 const refundCompleted=isRefund && String(refundData.status||'').toLowerCase()==='completed'
 const displayStatus=isRefund?(refundCompleted?'Dana Dikembalikan':'Refund Menunggu'):paymentExpired?'Kedaluwarsa':paymentPending?'Belum Bayar':order.status
 const idx=stepIndex(displayStatus); const isUnpaid=!isRefund&&['Belum Bayar','Menunggu Pembayaran'].includes(displayStatus); const isShipped=!isRefund&&displayStatus==='Dikirim'; const isDone=!isRefund&&displayStatus==='Selesai'; const shippingCost=Number(shipping.cost||shipping.price||0)
 const storedFreeShippingDiscount=Math.max(0,Number(shipping.free_shipping_discount||0))
 const storedVoucherDiscount=Math.max(0,Number(shipping.voucher_discount||0))
 const storedOrderDiscount=Math.max(0,Number((order as any).discount||0))
 const subtotalAmount=Math.max(0,Number(order.subtotal||0))
 const totalAmount=Math.max(0,Number(order.total||0))
 const calculatedDiscount=Math.max(0,subtotalAmount+shippingCost-totalAmount)
 const knownDiscount=storedFreeShippingDiscount+storedVoucherDiscount
 const legacyDiscount=Math.max(0,calculatedDiscount-knownDiscount)
 const freeShippingDiscount=storedFreeShippingDiscount || (storedVoucherDiscount===0 && storedOrderDiscount===0 && calculatedDiscount>0 && calculatedDiscount<=shippingCost ? calculatedDiscount : 0)
 const voucherDiscount=storedVoucherDiscount
 const otherDiscount=Math.max(0,storedOrderDiscount || legacyDiscount-(freeShippingDiscount-storedFreeShippingDiscount))
 const paymentLabel=paymentExpired?'Kedaluwarsa':isUnpaid?'Belum Bayar':'Lunas'
 const shipmentRaw=String((order as any).shipment_status||'').toLowerCase(); const shipmentLabel=isRefund?'Dibatalkan':shipmentRaw==='pending'?'Menunggu diproses':((order as any).shipment_status||displayStatus)
 return <main className="order-detail-shell">
  <Link to="/account?tab=orders" className="order-back"><ArrowLeft size={15}/> <span>Kembali ke Pesanan</span></Link>
  <header className="order-detail-header"><div><p>DETAIL PESANAN</p><h1>{order.id}</h1><span>{(order as any).created_at?new Date((order as any).created_at).toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'}):'Transaksi SanzStore25'}</span></div><span className={`order-detail-status ${paymentExpired?'is-expired':''} ${isRefund?(refundCompleted?'!border-emerald-400/40 !bg-emerald-400/15 !text-emerald-300':'!border-amber-400/40 !bg-amber-400/15 !text-amber-300'):''}`}>{displayStatus}</span></header>
  {error?<div className="order-error">{error}</div>:null}
  {isRefund ? <section className={`refund-panel ${refundCompleted?'is-complete':''}`}>
    <div className="refund-panel-head"><div className="refund-panel-title"><span className="refund-panel-icon"><WalletCards size={20}/></span><div><h2>{refundCompleted?'Dana Dikembalikan':'Pesanan Dibatalkan • Refund Menunggu'}</h2>{!refundCompleted?<p className="refund-panel-copy">Isi rekening atau e-wallet tujuan refund.</p>:null}</div></div><span className="refund-badge">{refundCompleted?'SELESAI':'MENUNGGU REFUND'}</span></div>
    {(order as any).cancellation_reason?<p className="refund-reason">Alasan pembatalan: <b>{(order as any).cancellation_reason}</b></p>:null}
    {!refundCompleted ? (hasRefundDestination&&!refundEditing ? <div className="refund-destination"><div><p className="refund-destination-label">Tujuan refund</p><p className="refund-destination-value">{refundDestination.provider} • {refundDestination.account_number}</p><p className="refund-destination-name">a.n. {refundDestination.account_name}</p></div><Button type="button" variant="outline" onClick={()=>setRefundEditing(true)}>Ubah Rekening</Button></div> : <div className="refund-form-card"><p className="refund-form-title">Rekening / e-wallet tujuan refund</p><p className="refund-form-note">Hanya digunakan untuk transfer refund. Jangan pernah masukkan PIN, OTP, password, atau CVV.</p><div className="refund-fields"><select value={refundType} onChange={e=>setRefundType(e.target.value as 'bank'|'ewallet')} className="refund-field"><option value="bank">Rekening Bank</option><option value="ewallet">E-Wallet</option></select><input value={refundProvider} onChange={e=>setRefundProvider(e.target.value)} placeholder={refundType==='bank'?'Nama bank (BCA, BRI, BNI...)':'E-Wallet (GoPay, DANA, OVO...)'} className="refund-field"/><input value={refundAccount} inputMode="numeric" onChange={e=>setRefundAccount(e.target.value.replace(/[^0-9]/g,''))} placeholder={refundType==='bank'?'Nomor rekening':'Nomor HP e-wallet'} className="refund-field"/><input value={refundName} onChange={e=>setRefundName(e.target.value)} placeholder="Nama pemilik rekening/e-wallet" className="refund-field"/></div><div className="refund-actions">{hasRefundDestination?<Button type="button" variant="outline" disabled={saving} onClick={()=>setRefundEditing(false)}>Batal</Button>:null}<Button type="button" disabled={saving} onClick={()=>void saveRefundDestination()}>{saving?'Menyimpan...':'Simpan Tujuan Refund'}</Button></div></div>) : <div className="refund-complete-grid"><div className="refund-complete-item"><span>Metode Refund</span><b>Transfer manual</b></div>{refundDestination.provider?<div className="refund-complete-item"><span>Tujuan Refund</span><b>{refundDestination.provider} • {refundDestination.account_number}</b></div>:null}{refundData.reference?<div className="refund-complete-item"><span>Referensi Transfer</span><b>{refundData.reference}</b></div>:null}{refundData.completed_at?<div className="refund-complete-item"><span>Dikembalikan Pada</span><b>{new Date(refundData.completed_at).toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'})}</b></div>:null}</div>}
  </section> : <section className="order-progress">{steps.map((s,i)=><div className={`progress-step ${i<=idx?'done':''}`} key={s}><span>{i<idx?'✓':i+1}</span><b>{s}</b></div>)}</section>}
  <div className="order-detail-grid"><div className="order-detail-main">
   <section className="order-section"><div className="order-section-head"><h2>Produk Dipesan</h2><span>{order.items?.length||0} item</span></div>{(order.items||[]).map((item:any,i:number)=>{const price=Number(item.product?.price||item.price||0);return <div className="detail-product" key={i}><img src={item.product?.image||item.product?.images?.[0]||'/placeholder.svg'} /><div><b>{item.product?.title||item.title||'Produk'}</b>{item.product?.selected_variant?<span className="text-brand">Varian: {item.product.selected_variant.name}</span>:null}<span>{item.qty||1} × {formatCurrency(price)}</span></div><strong>{formatCurrency(price*Number(item.qty||1))}</strong></div>})}</section>
   <section className="order-section"><div className="order-section-head"><h2>Informasi Pengiriman</h2></div><div className="shipping-info"><div><span>Kurir</span><b>{formatShippingLabel(shipping.courier||shipping.company,shipping.service||shipping.type)}</b></div><div><span>Nomor Resi</span><b>{order.resi||'Belum tersedia'}</b></div><div><span>Status Pengiriman</span><b>{shipmentLabel}</b></div></div>{order.resi&&!isRefund?<button className="track-button" type="button" onClick={()=>{const url=String((order as any).biteship_tracking_url||'').trim()||trackingUrl(formatShippingLabel(shipping.courier||shipping.company,shipping.service||shipping.type),String(order.resi));window.open(url,'_blank','noopener,noreferrer')}}>Lacak Paket →</button>:null}</section>
  </div><aside className="order-summary-card"><p className="account-eyebrow">PEMBAYARAN</p><h2>Ringkasan</h2><div className="summary-meta"><div><CreditCard size={15}/><span>Status pembayaran</span><b className={isUnpaid?'is-pending':paymentExpired?'is-expired':'is-paid'}>{paymentLabel}</b></div>{isRefund?<div><WalletCards size={15}/><span>Status refund</span><b className={refundCompleted?'is-paid':'is-pending'}>{refundCompleted?'Dana Dikembalikan':'Menunggu Transfer'}</b></div>:null}<div><Truck size={15}/><span>Pengiriman</span><b>{isRefund?'Dibatalkan':formatShippingLabel(shipping.courier||shipping.company,shipping.service||shipping.type)}</b></div></div><div className="summary-lines"><div><span>Subtotal Produk</span><b>{formatCurrency(order.subtotal||0)}</b></div><div><span>Ongkir</span><b>{formatCurrency(shippingCost)}</b></div>{freeShippingDiscount>0?<div className="summary-discount"><span>Potongan Ongkir</span><b>-{formatCurrency(freeShippingDiscount)}</b></div>:null}{voucherDiscount>0?<div className="summary-discount"><span>{order.voucher?.type==='shipping'?'Voucher Ongkir':'Voucher Belanja'}</span><b>-{formatCurrency(voucherDiscount)}</b></div>:null}{otherDiscount>0?<div className="summary-discount"><span>Potongan</span><b>-{formatCurrency(otherDiscount)}</b></div>:null}<div className="summary-total"><span>Total Pembayaran</span><b>{formatCurrency(order.total)}</b></div></div>{isUnpaid&&!paymentExpired?<Link className="summary-primary" to={`/payment/${order.id}?amount=${order.total}&name=${encodeURIComponent(order.customer?.name||'Buyer')}&invoice=${order.id}`}>Bayar Sekarang</Link>:null}{isShipped?<Button disabled={saving} onClick={markReceived}>{saving?'Menyimpan...':'Pesanan Diterima'}</Button>:null}{isDone?<Button variant="outline" disabled>Beri Penilaian (segera)</Button>:null}</aside></div>
 </main>
}
export default BuyerOrderDetailPage
