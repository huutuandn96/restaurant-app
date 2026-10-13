import { Link } from 'react-router-dom'
import { money, ORDER_STATUS_LABEL } from '../../shared/format'
import type { OrderStatus } from '../../shared/types'
import { Spinner } from '../../shared/ui'
import { card, useManageQuery } from './hooks'

type Dashboard = {
  date: string
  total_orders: number
  by_status: Record<OrderStatus, number>
  unconfirmed: number
  in_progress: number
  done: number
  cancelled: number
  revenue: number
  pending_revenue: number
  occupied_tables: number
  total_tables: number
  top_items: { name: string; quantity: number }[]
}

// Màu trạng thái luôn đi kèm nhãn chữ (không dùng màu đơn lẻ)
const STATUS_DOT: Record<OrderStatus, string> = {
  pending: 'bg-amber-400',
  confirmed: 'bg-sky-500',
  preparing: 'bg-violet-500',
  ready: 'bg-green-500',
  completed: 'bg-stone-500',
  cancelled: 'bg-red-500',
}

export default function DashboardPage() {
  const { data, isPending } = useManageQuery<Dashboard>(['dashboard'], '/manage/dashboard')
  if (isPending || !data) return <div className="grid place-items-center py-20"><Spinner /></div>

  const maxStatus = Math.max(1, ...Object.values(data.by_status))
  const maxTop = Math.max(1, ...data.top_items.map((t) => t.quantity))

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">Tổng quan hôm nay</h1>
          <p className="text-sm text-stone-500">{new Date(data.date).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })} · cập nhật realtime</p>
        </div>
      </div>

      {/* Hero: doanh thu */}
      <div className="grid gap-3 md:grid-cols-3">
        <div className={`${card} md:col-span-2`}>
          <div className="text-sm font-semibold text-stone-500">Doanh thu (đơn đã thanh toán)</div>
          <div className="mt-1 text-4xl font-extrabold tracking-tight tabular-nums">{money(data.revenue)}</div>
          <div className="mt-1 text-sm text-stone-500">
            + {money(data.pending_revenue)} đang phục vụ (chưa thanh toán)
          </div>
        </div>
        <div className={card}>
          <div className="text-sm font-semibold text-stone-500">Bàn có khách</div>
          <div className="mt-1 text-4xl font-extrabold tabular-nums">
            {data.occupied_tables}<span className="text-xl text-stone-400">/{data.total_tables}</span>
          </div>
          <Link to="/manage/tables" className="mt-1 inline-block text-sm text-brand-600 underline">Xem bàn</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Tổng đơn" value={data.total_orders} />
        <Stat label="Chưa xác nhận" value={data.unconfirmed} dot={STATUS_DOT.pending} link="pending" />
        <Stat label="Đang xử lý" value={data.in_progress} dot={STATUS_DOT.preparing} link="confirmed,preparing" />
        <Stat label="Đã xong" value={data.done} dot={STATUS_DOT.ready} link="ready,completed" />
        <Stat label="Đã huỷ" value={data.cancelled} dot={STATUS_DOT.cancelled} link="cancelled" />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <section className={card}>
          <h2 className="font-bold">Đơn theo trạng thái</h2>
          <ul className="mt-3 space-y-2">
            {(Object.keys(data.by_status) as OrderStatus[]).map((s) => (
              <li key={s} className="grid grid-cols-[7.5rem_1fr_2.5rem] items-center gap-2 text-sm" title={`${ORDER_STATUS_LABEL[s]}: ${data.by_status[s]} đơn`}>
                <span className="flex items-center gap-2 text-stone-600"><span className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT[s]}`} />{ORDER_STATUS_LABEL[s]}</span>
                <span className="h-3 overflow-hidden rounded-full bg-stone-100">
                  <span className={`block h-full rounded-full ${STATUS_DOT[s]}`} style={{ width: `${(data.by_status[s] / maxStatus) * 100}%` }} />
                </span>
                <span className="text-right font-semibold tabular-nums">{data.by_status[s]}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className={card}>
          <h2 className="font-bold">Top món bán chạy</h2>
          {data.top_items.length === 0 ? (
            <p className="mt-3 text-sm text-stone-400">Chưa có dữ liệu</p>
          ) : (
            <ol className="mt-3 space-y-2">
              {data.top_items.map((t, i) => (
                <li key={t.name} className="grid grid-cols-[1.5rem_1fr_3rem] items-center gap-2 text-sm" title={`${t.name}: ${t.quantity} phần`}>
                  <span className="font-bold text-stone-400">{i + 1}</span>
                  <span>
                    <span className="block truncate font-medium">{t.name}</span>
                    <span className="mt-1 block h-2 rounded-full bg-brand-500" style={{ width: `${(t.quantity / maxTop) * 100}%` }} />
                  </span>
                  <span className="text-right font-semibold tabular-nums">{t.quantity}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  )
}

function Stat({ label, value, dot, link }: { label: string; value: number; dot?: string; link?: string }) {
  const body = (
    <>
      <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-500">
        {dot && <span className={`h-2 w-2 rounded-full ${dot}`} />}
        {label}
      </div>
      <div className="mt-1 text-3xl font-extrabold tabular-nums">{value}</div>
    </>
  )
  return link ? (
    <Link to={`/manage/orders?status=${link}`} className={`${card} hover:ring-brand-500`}>{body}</Link>
  ) : (
    <div className={card}>{body}</div>
  )
}
