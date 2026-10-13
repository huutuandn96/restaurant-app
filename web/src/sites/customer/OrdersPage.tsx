import { Link } from 'react-router-dom'
import { money, time } from '../../shared/format'
import { useGuest } from './session'
import { ItemStatus, OrderBadge } from '../../shared/ui'

export default function OrdersPage() {
  const { session, qrToken } = useGuest()
  const orders = [...session.orders].reverse()
  const hasPending = session.orders.some((o) => o.status === 'pending')

  return (
    <div className="min-h-full pb-10">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-stone-100 bg-white/95 px-4 py-3 backdrop-blur">
        <Link to={`/t/${qrToken}`} className="grid h-9 w-9 place-items-center rounded-full bg-stone-100" aria-label="Quay lại">←</Link>
        <div className="flex-1">
          <h1 className="font-bold leading-tight">Đơn của bàn</h1>
          <p className="text-xs text-stone-500">{session.table.label} · {session.table.area}</p>
        </div>
      </header>

      {/* Mã xác nhận (SPEC §2.3) */}
      <div className={`mx-4 mt-4 rounded-2xl p-4 text-center ${hasPending ? 'bg-amber-50 ring-2 ring-amber-300' : 'bg-stone-50 ring-1 ring-stone-200'}`}>
        <p className="text-sm text-stone-600">{hasPending ? 'Đưa mã này cho nhân viên khi đến xác nhận' : 'Mã xác nhận của bàn'}</p>
        <p className="mt-1 font-mono text-5xl font-extrabold tracking-[0.25em] text-stone-900">{session.verify_code}</p>
        <p className="mt-1 text-sm font-semibold text-stone-700">{session.table.label}</p>
      </div>

      {orders.length === 0 ? (
        <div className="px-4 py-16 text-center text-stone-400">
          <p>Bàn chưa có đơn nào</p>
          <Link to={`/t/${qrToken}`} className="mt-4 inline-block rounded-full bg-brand-500 px-5 py-2.5 font-semibold text-white">Xem menu</Link>
        </div>
      ) : (
        <ul className="mt-4 space-y-3 px-4">
          {orders.map((o) => (
            <li key={o.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-mono text-sm font-bold">#{o.code}</span>
                  <span className="ml-2 text-xs text-stone-400">{time(o.created_at)}</span>
                </div>
                <OrderBadge status={o.status} />
              </div>
              <ul className="mt-3 space-y-2">
                {o.items.map((i) => (
                  <li key={i.id} className="flex items-start justify-between gap-2 text-sm">
                    <div className={i.status === 'out_of_stock' ? 'text-stone-400 line-through' : ''}>
                      <span className="font-semibold">{i.quantity}×</span> {i.name}
                      {i.note && <div className="text-xs italic text-stone-500">“{i.note}”</div>}
                    </div>
                    <div className="shrink-0 text-right">
                      <div className={`tabular-nums ${i.status === 'out_of_stock' ? 'text-stone-400 line-through' : ''}`}>{money(i.subtotal)}</div>
                      {o.status !== 'pending' && o.status !== 'cancelled' && <ItemStatus status={i.status} />}
                    </div>
                  </li>
                ))}
              </ul>
              {o.note && <p className="mt-2 rounded-lg bg-stone-50 px-3 py-2 text-xs text-stone-600">Ghi chú: {o.note}</p>}
              {o.cancel_reason && <p className="mt-2 text-xs text-red-600">Lý do huỷ: {o.cancel_reason}</p>}
              <div className="mt-3 flex justify-between border-t border-stone-100 pt-2 text-sm">
                <span className="text-stone-500">Thành tiền</span>
                <span className="font-bold">{money(o.total)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {orders.length > 0 && (
        <div className="mx-4 mt-4 flex items-center justify-between rounded-2xl bg-stone-900 p-4 text-white">
          <span>Tổng cộng bàn</span>
          <span className="text-xl font-extrabold">{money(session.total)}</span>
        </div>
      )}
      <p className="mt-3 px-4 text-center text-xs text-stone-400">Gọi nhân viên để thanh toán</p>
    </div>
  )
}
