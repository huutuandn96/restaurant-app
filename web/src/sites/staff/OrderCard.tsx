import type React from 'react'
import { money, minutesAgo, time } from '../../shared/format'
import type { Order } from '../../shared/types'
import { ItemStatus, OrderBadge } from '../../shared/ui'

// Card đơn cho phục vụ: BÀN xx to + mã xác nhận (SPEC §2.3.5)
export default function OrderCard({ order, now, actions, highlight }: { order: Order; now: number; actions?: React.ReactNode; highlight?: boolean }) {
  return (
    <article className={`flex flex-col rounded-2xl bg-white p-4 shadow-sm ring-1 ${highlight ? 'ring-2 ring-amber-400' : 'ring-stone-200'}`}>
      <header className="flex items-start justify-between gap-2">
        <div>
          <div className="text-2xl font-extrabold leading-none tracking-tight">BÀN {String(order.table.number).padStart(2, '0')}</div>
          <div className="mt-1 text-xs text-stone-500">{order.table.area} · #{order.code} · {time(order.created_at)}</div>
        </div>
        <div className="text-right">
          <div className="rounded-lg bg-stone-900 px-2 py-1 font-mono text-lg font-bold tracking-widest text-white">{order.verify_code}</div>
          <div className="mt-1 text-[10px] font-semibold uppercase text-stone-400">mã xác nhận</div>
        </div>
      </header>
      <div className="mt-2 flex items-center gap-2">
        <OrderBadge status={order.status} />
        <span className={`text-xs ${order.status === 'pending' ? 'font-semibold text-amber-700' : 'text-stone-400'}`}>{minutesAgo(order.created_at, now)}</span>
      </div>
      <ul className="mt-3 flex-1 divide-y divide-stone-100 text-sm">
        {order.items.map((i) => (
          <li key={i.id} className="flex items-start justify-between gap-2 py-1.5">
            <div className={i.status === 'out_of_stock' ? 'text-stone-400 line-through' : ''}>
              <span className="font-bold">{i.quantity}×</span> {i.name}
              {i.note && <div className="text-xs italic text-amber-700">“{i.note}”</div>}
            </div>
            <div className="shrink-0 text-right">
              <div className="tabular-nums text-stone-600">{money(i.subtotal)}</div>
              {order.status !== 'pending' && <ItemStatus status={i.status} />}
            </div>
          </li>
        ))}
      </ul>
      {order.note && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Ghi chú: {order.note}</p>}
      <div className="mt-3 flex items-center justify-between border-t border-stone-100 pt-2">
        <span className="text-sm text-stone-500">Tổng</span>
        <span className="text-lg font-extrabold">{money(order.total)}</span>
      </div>
      {actions && <div className="mt-3 flex gap-2">{actions}</div>}
    </article>
  )
}
