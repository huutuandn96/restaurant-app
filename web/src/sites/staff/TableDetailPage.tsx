import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { money } from '../../shared/format'
import { useNow } from '../../shared/useNow'
import type { Order } from '../../shared/types'
import { EmptyState, Modal, Spinner } from '../../shared/ui'
import { useCalls, useCheckout, useResolveCall, useTableDetail } from './data'
import OrderCard from './OrderCard'
import { CancelOrderDialog, ConfirmOrderDialog } from './ConfirmDialogs'

export default function TableDetailPage() {
  const id = Number(useParams().id)
  const now = useNow(30_000)
  const navigate = useNavigate()
  const { data, isPending } = useTableDetail(id)
  const calls = useCalls()
  const resolve = useResolveCall()
  const checkout = useCheckout()
  const [confirming, setConfirming] = useState<Order | null>(null)
  const [cancelling, setCancelling] = useState<Order | null>(null)
  const [paying, setPaying] = useState(false)

  if (isPending || !data) return <div className="grid place-items-center py-16"><Spinner /></div>

  const orders = data.orders.filter((o) => o.status !== 'cancelled')
  const pending = data.orders.filter((o) => o.status === 'pending')
  const call = calls.data?.find((c) => c.table.id === id)

  return (
    <div className="p-4">
      <div className="flex items-center gap-3">
        <Link to="/staff/tables" className="grid h-9 w-9 place-items-center rounded-full bg-white ring-1 ring-stone-200">←</Link>
        <div className="flex-1">
          <h1 className="text-2xl font-extrabold">{data.label}</h1>
          <p className="text-sm text-stone-500">{data.area} · {data.seats} chỗ</p>
        </div>
        {data.session && (
          <div className="rounded-xl bg-stone-900 px-3 py-1.5 text-center text-white">
            <div className="text-[10px] uppercase text-stone-400">Mã</div>
            <div className="font-mono text-xl font-bold tracking-widest">{data.session.verify_code}</div>
          </div>
        )}
      </div>

      {call && (
        <div className="mt-3 flex items-center justify-between rounded-xl bg-red-50 px-3 py-2 ring-1 ring-red-200">
          <span className="font-semibold text-red-700">🙋 Khách đang gọi nhân viên</span>
          <button onClick={() => resolve.mutate(call.id)} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white">Đã đến</button>
        </div>
      )}

      {!data.session ? (
        <EmptyState icon="🪑" text="Bàn trống — chưa có khách quét QR" />
      ) : (
        <>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {data.orders.length === 0 && <EmptyState icon="🧾" text="Khách chưa đặt món" />}
            {data.orders.map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                now={now}
                highlight={o.status === 'pending'}
                actions={
                  o.status === 'pending' ? (
                    <>
                      <button onClick={() => setCancelling(o)} className="rounded-xl bg-stone-100 px-4 py-2.5 font-semibold text-stone-600">Huỷ</button>
                      <button onClick={() => setConfirming(o)} className="flex-1 rounded-xl bg-green-600 py-2.5 font-bold text-white">Xác nhận · gửi bếp</button>
                    </>
                  ) : undefined
                }
              />
            ))}
          </div>

          <div className="sticky bottom-20 mt-4 rounded-2xl bg-stone-900 p-4 text-white shadow-xl">
            <div className="flex items-center justify-between">
              <span>Tổng bàn ({orders.length} đơn)</span>
              <span className="text-2xl font-extrabold">{money(data.session_total)}</span>
            </div>
            <button
              onClick={() => setPaying(true)}
              className="mt-3 w-full rounded-xl bg-brand-500 py-3 text-lg font-bold active:scale-[0.99]"
            >
              Thanh toán & đóng bàn
            </button>
          </div>
        </>
      )}

      {paying && (
        <Modal title={`Thanh toán ${data.label}`} onClose={() => setPaying(false)}>
          <div className="text-center">
            <div className="text-sm text-stone-500">Khách cần thanh toán</div>
            <div className="my-2 text-4xl font-extrabold">{money(data.session_total)}</div>
          </div>
          {pending.length > 0 && (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              ⚠️ Còn {pending.length} đơn chưa xác nhận — sẽ bị huỷ khi đóng bàn.
            </p>
          )}
          <p className="mt-2 text-xs text-stone-500">Đóng bàn: các đơn chuyển sang Hoàn thành, mã xác nhận cũ hết hiệu lực. QR trên bàn giữ nguyên.</p>
          <button
            disabled={checkout.isPending}
            onClick={() => checkout.mutate(id, { onSuccess: () => { setPaying(false); navigate('/staff/tables') } })}
            className="mt-4 w-full rounded-xl bg-green-600 py-3 text-lg font-bold text-white disabled:opacity-60"
          >
            Đã thu tiền · Đóng bàn
          </button>
        </Modal>
      )}
      {confirming && <ConfirmOrderDialog order={confirming} onClose={() => setConfirming(null)} />}
      {cancelling && <CancelOrderDialog order={cancelling} onClose={() => setCancelling(null)} />}
    </div>
  )
}
