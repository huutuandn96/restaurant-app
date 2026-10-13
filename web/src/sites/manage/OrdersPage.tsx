import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../shared/api'
import { dateTime, money, ORDER_STATUS_LABEL, time } from '../../shared/format'
import { toast } from '../../shared/toast'
import { printBill, printKitchenTicket } from '../../shared/print'
import type { Order, OrderStatus, Table } from '../../shared/types'
import { EmptyState, ItemStatus, Modal, OrderBadge, Spinner } from '../../shared/ui'
import { btnGhost, btnPrimary, card, inputBase, todayStr, useManageQuery, useToken } from './hooks'

type OrdersResponse = { orders: Order[]; page: number; per_page: number; total: number }

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'Tất cả' },
  { value: 'pending', label: 'Chưa xác nhận' },
  { value: 'confirmed,preparing', label: 'Đang xử lý' },
  { value: 'ready', label: 'Sẵn sàng' },
  { value: 'completed', label: 'Hoàn thành' },
  { value: 'cancelled', label: 'Đã huỷ' },
  { value: 'ready,completed', label: 'Đã xong' },
]

export default function OrdersPage() {
  const [params, setParams] = useSearchParams()
  const status = params.get('status') ?? ''
  const date = params.get('date') ?? todayStr()
  const tableId = params.get('table_id') ?? ''
  const page = Number(params.get('page') ?? 1)
  const [openId, setOpenId] = useState<number | null>(null)

  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v)
    else next.delete(k)
    if (k !== 'page') next.delete('page')
    setParams(next, { replace: true })
  }

  const qs = new URLSearchParams({ date, page: String(page), ...(status && { status }), ...(tableId && { table_id: tableId }) })
  const { data, isPending } = useManageQuery<OrdersResponse>(['orders', qs.toString()], `/manage/orders?${qs}`)
  const tables = useManageQuery<Table[]>(['tables'], '/manage/tables')
  const pages = data ? Math.max(1, Math.ceil(data.total / data.per_page)) : 1

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">Đơn hàng</h1>

      {/* Bộ lọc — 1 hàng */}
      <div className="flex flex-wrap items-center gap-2">
        <input type="date" value={date} max={todayStr()} onChange={(e) => set('date', e.target.value)} className={`${inputBase} w-auto`} />
        <select value={tableId} onChange={(e) => set('table_id', e.target.value)} className={`${inputBase} w-auto`}>
          <option value="">Tất cả bàn</option>
          {tables.data?.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <div className="no-scrollbar flex gap-1 overflow-x-auto">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => set('status', f.value)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ${status === f.value ? 'bg-stone-900 text-white' : 'bg-white text-stone-600 ring-1 ring-stone-200'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {isPending ? (
        <div className="grid place-items-center py-16"><Spinner /></div>
      ) : !data || data.orders.length === 0 ? (
        <EmptyState icon="🧾" text="Không có đơn nào" />
      ) : (
        <>
          <p className="text-sm text-stone-500">{data.total} đơn</p>
          {/* Bảng (desktop) */}
          <div className={`${card} hidden overflow-x-auto p-0 md:block`}>
            <table className="w-full text-sm">
              <thead className="border-b border-stone-100 text-left text-xs uppercase text-stone-500">
                <tr>
                  <th className="px-4 py-3">Mã</th><th className="px-4 py-3">Bàn</th><th className="px-4 py-3">Giờ</th>
                  <th className="px-4 py-3">Món</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3 text-right">Tổng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {data.orders.map((o) => (
                  <tr key={o.id} onClick={() => setOpenId(o.id)} className="cursor-pointer hover:bg-stone-50">
                    <td className="px-4 py-3 font-mono font-semibold">#{o.code}</td>
                    <td className="px-4 py-3 font-semibold">{o.table.label}</td>
                    <td className="px-4 py-3 text-stone-500">{time(o.created_at)}</td>
                    <td className="max-w-xs truncate px-4 py-3 text-stone-600">{o.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}</td>
                    <td className="px-4 py-3"><OrderBadge status={o.status} /></td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{money(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Thẻ (mobile) */}
          <div className="space-y-2 md:hidden">
            {data.orders.map((o) => (
              <button key={o.id} onClick={() => setOpenId(o.id)} className={`${card} block w-full text-left`}>
                <div className="flex items-center justify-between">
                  <span className="font-bold">{o.table.label} <span className="font-mono text-xs text-stone-400">#{o.code}</span></span>
                  <OrderBadge status={o.status} />
                </div>
                <div className="mt-1 truncate text-sm text-stone-500">{o.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}</div>
                <div className="mt-1 flex justify-between text-sm"><span className="text-stone-400">{time(o.created_at)}</span><b>{money(o.total)}</b></div>
              </button>
            ))}
          </div>
          {pages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button disabled={page <= 1} onClick={() => set('page', String(page - 1))} className={`${btnGhost} disabled:opacity-40`}>←</button>
              <span className="text-sm text-stone-500">Trang {page}/{pages}</span>
              <button disabled={page >= pages} onClick={() => set('page', String(page + 1))} className={`${btnGhost} disabled:opacity-40`}>→</button>
            </div>
          )}
        </>
      )}

      {openId && <OrderDetail id={openId} onClose={() => setOpenId(null)} />}
    </div>
  )
}

const STATUSES: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled']
const ACTION_LABEL: Record<string, string> = {
  create: 'Khách đặt món', confirm: 'Xác nhận', cancel: 'Huỷ', done: 'Bếp xong cả đơn', complete: 'Thanh toán',
  set_status: 'Quản lý đổi trạng thái', item_cooking: 'Bắt đầu nấu', item_done: 'Món xong', item_out_of_stock: 'Hết món', move_table: 'Chuyển bàn', merge_table: 'Gộp bàn',
}

function OrderDetail({ id, onClose }: { id: number; onClose: () => void }) {
  const token = useToken()
  const qc = useQueryClient()
  const { data: o } = useManageQuery<Order>(['order', id], `/manage/orders/${id}`)
  const [next, setNext] = useState<OrderStatus | ''>('')
  const [reason, setReason] = useState('')
  const change = useMutation({
    mutationFn: () => api<Order>(`/manage/orders/${id}`, { method: 'PATCH', token, body: { status: next, reason } }),
    onSuccess: () => {
      toast('Đã cập nhật trạng thái')
      setNext('')
      setReason('')
      void qc.invalidateQueries({ queryKey: ['manage'] })
    },
    onError: (e) => toast(e.message, 'error'),
  })

  return (
    <Modal title={o ? `Đơn #${o.code} · ${o.table.label}` : 'Đơn hàng'} onClose={onClose}>
      {!o ? <div className="grid place-items-center py-10"><Spinner /></div> : (
        <div className="max-h-[70vh] space-y-4 overflow-y-auto">
          <div className="flex items-center justify-between">
            <OrderBadge status={o.status} />
            <span className="text-sm text-stone-500">Mã bàn {o.verify_code} · {dateTime(o.created_at)}</span>
          </div>
          <ul className="divide-y divide-stone-100 text-sm">
            {o.items.map((i) => (
              <li key={i.id} className="flex justify-between gap-2 py-2">
                <span className={i.status === 'out_of_stock' ? 'text-stone-400 line-through' : ''}>
                  <b>{i.quantity}×</b> {i.name}{i.note && <span className="block text-xs italic text-stone-500">“{i.note}”</span>}
                </span>
                <span className="text-right"><span className="block tabular-nums">{money(i.subtotal)}</span><ItemStatus status={i.status} /></span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between border-t border-stone-100 pt-2 font-bold"><span>Tổng</span><span>{money(o.total)}</span></div>
          {o.discount > 0 && (
            <div className="flex justify-between text-sm text-green-700"><span>Giảm giá hoá đơn (phân bổ)</span><span>−{money(o.discount)} → {money(o.total - o.discount)}</span></div>
          )}
          {o.note && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Ghi chú: {o.note}</p>}
          {o.cancel_reason && <p className="text-sm text-red-600">Lý do huỷ: {o.cancel_reason}</p>}
          <div className="flex flex-wrap gap-2">
            {o.status !== 'cancelled' && (
              <button onClick={() => void printBill(o.table_session_id, token)} className={btnGhost}>🖨️ In hoá đơn bàn</button>
            )}
            <button onClick={() => printKitchenTicket(o)} className={btnGhost}>🖨️ In phiếu bếp</button>
          </div>

          <section>
            <h3 className="mb-2 text-sm font-bold">Lịch sử</h3>
            <ol className="space-y-1.5 border-l-2 border-stone-200 pl-3 text-sm">
              {o.events?.map((e) => (
                <li key={e.id}>
                  <span className="font-medium">{ACTION_LABEL[e.action] ?? e.action}</span>
                  {typeof e.data?.name === 'string' && <span className="text-stone-500"> · {e.data.name}</span>}
                  {typeof e.data?.to === 'string' && <span className="text-stone-500"> · {String(e.data.from)} → {e.data.to}</span>}
                  {e.to_status && e.from_status !== e.to_status && <span className="text-stone-500"> → {ORDER_STATUS_LABEL[e.to_status]}</span>}
                  <div className="text-xs text-stone-400">{time(e.created_at)}{e.user && ` · ${e.user.name}`}{typeof e.data?.reason === 'string' && ` · ${e.data.reason}`}</div>
                </li>
              ))}
            </ol>
          </section>

          <section className="rounded-xl bg-stone-50 p-3">
            <h3 className="mb-2 text-sm font-bold">Đổi trạng thái</h3>
            <div className="flex flex-wrap gap-2">
              <select value={next} onChange={(e) => setNext(e.target.value as OrderStatus)} className={`${inputBase} flex-1`}>
                <option value="">— Chọn —</option>
                {STATUSES.filter((s) => s !== o.status).map((s) => <option key={s} value={s}>{ORDER_STATUS_LABEL[s]}</option>)}
              </select>
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Lý do (tuỳ chọn)" className={`${inputBase} flex-1`} />
              <button disabled={!next || change.isPending} onClick={() => change.mutate()} className={btnPrimary}>Lưu</button>
            </div>
          </section>
        </div>
      )}
    </Modal>
  )
}
