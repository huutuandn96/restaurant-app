import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useNow } from '../../shared/useNow'
import type { Order, OrderStatus } from '../../shared/types'
import { EmptyState, Spinner } from '../../shared/ui'
import { useActiveOrders, useCalls, useResolveCall } from './data'
import OrderCard from './OrderCard'
import { CancelOrderDialog, ConfirmOrderDialog } from './ConfirmDialogs'

const TABS: { key: string; label: string; statuses: OrderStatus[]; empty: string }[] = [
  { key: 'pending', label: 'Chờ xác nhận', statuses: ['pending'], empty: 'Không có đơn chờ xác nhận' },
  { key: 'cooking', label: 'Đang làm', statuses: ['confirmed', 'preparing'], empty: 'Bếp đang rảnh' },
  { key: 'ready', label: 'Sẵn sàng', statuses: ['ready'], empty: 'Chưa có món cần mang ra' },
]

export default function WaiterOrdersPage() {
  const now = useNow(30_000)
  const { data, isPending } = useActiveOrders()
  const calls = useCalls()
  const resolve = useResolveCall()
  const [tab, setTab] = useState('pending')
  const [confirming, setConfirming] = useState<Order | null>(null)
  const [cancelling, setCancelling] = useState<Order | null>(null)

  const current = TABS.find((t) => t.key === tab)!
  // Đơn mới nhất lên đầu với "chờ xác nhận"; còn lại cũ nhất lên đầu
  const list = (data ?? []).filter((o) => current.statuses.includes(o.status))
  if (tab === 'pending') list.reverse()

  return (
    <div>
      {/* Khách gọi nhân viên */}
      {(calls.data?.length ?? 0) > 0 && (
        <div className="space-y-2 bg-red-50 px-4 py-3">
          {calls.data!.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-xl bg-white px-3 py-2 ring-1 ring-red-200">
              <Link to={`/staff/tables/${c.table.id}`} className="font-semibold text-red-700">🙋 {c.table.label} gọi nhân viên</Link>
              <button onClick={() => resolve.mutate(c.id)} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white">Đã đến</button>
            </div>
          ))}
        </div>
      )}

      <div className="sticky top-[52px] z-20 flex gap-1 bg-stone-100 px-4 pb-2 pt-3">
        {TABS.map((t) => {
          const n = (data ?? []).filter((o) => t.statuses.includes(o.status)).length
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 whitespace-nowrap rounded-xl px-1 py-2 text-[13px] font-semibold sm:text-sm ${tab === t.key ? 'bg-stone-900 text-white' : 'bg-white text-stone-600 ring-1 ring-stone-200'}`}
            >
              {t.label} {n > 0 && <span className={tab === t.key ? 'text-brand-500' : 'text-red-500'}>({n})</span>}
            </button>
          )
        })}
      </div>

      {isPending ? (
        <div className="grid place-items-center py-16"><Spinner /></div>
      ) : list.length === 0 ? (
        <EmptyState icon="✨" text={current.empty} />
      ) : (
        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              now={now}
              highlight={o.status === 'pending' || o.status === 'ready'}
              actions={
                o.status === 'pending' ? (
                  <>
                    <button onClick={() => setCancelling(o)} className="rounded-xl bg-stone-100 px-4 py-3 font-semibold text-stone-600">Huỷ</button>
                    <button onClick={() => setConfirming(o)} className="flex-1 rounded-xl bg-green-600 py-3 font-bold text-white active:scale-[0.99]">
                      Xác nhận · gửi bếp
                    </button>
                  </>
                ) : (
                  <>
                    {o.status === 'confirmed' && (
                      <button onClick={() => setCancelling(o)} className="rounded-xl bg-stone-100 px-4 py-3 font-semibold text-stone-600">Huỷ</button>
                    )}
                    <Link to={`/staff/tables/${o.table.id}`} className="flex-1 rounded-xl bg-stone-900 py-3 text-center font-semibold text-white">
                      Xem bàn / thanh toán
                    </Link>
                  </>
                )
              }
            />
          ))}
        </div>
      )}

      {confirming && <ConfirmOrderDialog order={confirming} onClose={() => setConfirming(null)} />}
      {cancelling && <CancelOrderDialog order={cancelling} onClose={() => setCancelling(null)} />}
    </div>
  )
}
