import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { api } from '../../shared/api'
import { money } from '../../shared/format'
import type { Order } from '../../shared/types'
import { useGuest } from './session'
import { cartTotal, useCart } from './cart'
import { FoodImage, QtyControl } from './ui'
import { toast } from './toast'

export default function CartSheet({ onClose }: { onClose: () => void }) {
  const { session, qrToken, refetch } = useGuest()
  const navigate = useNavigate()
  const { lines, add, decrement, setNote, clear } = useCart()
  const [note, setOrderNote] = useState('')
  const list = Object.values(lines)
  const unavailable = list.filter((l) => !l.item.available)

  const place = useMutation({
    mutationFn: () =>
      api<Order>('/public/orders', {
        method: 'POST',
        sessionToken: session.session_token,
        body: {
          note,
          items: list.map((l) => ({ menu_item_id: l.item.id, quantity: l.quantity, note: l.note })),
        },
      }),
    onSuccess: () => {
      clear()
      refetch()
      onClose()
      toast(`Đã gửi đơn! Nhân viên sẽ đến bàn xác nhận với mã ${session.verify_code}`)
      navigate(`/t/${qrToken}/orders`)
    },
    onError: (e) => toast(e.message, 'error'),
  })

  return (
    <div className="fixed inset-0 z-40 mx-auto flex max-w-md flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative flex max-h-[88vh] flex-col rounded-t-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
          <h2 className="text-lg font-bold">Giỏ hàng · {session.table.label}</h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-stone-100" aria-label="Đóng">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-4">
          {list.length === 0 && <p className="py-12 text-center text-stone-400">Giỏ hàng trống</p>}
          <ul className="divide-y divide-stone-100">
            {list.map(({ item, quantity, note: lineNote }) => (
              <li key={item.id} className="py-3">
                <div className="flex gap-3">
                  <FoodImage src={item.image_url} alt={item.name} className="h-14 w-14 shrink-0 rounded-lg" />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold leading-tight">{item.name}</div>
                    <div className="text-sm text-stone-500">{money(item.price)}</div>
                    {!item.available && <div className="text-xs font-semibold text-red-600">Món này vừa hết, vui lòng bỏ ra</div>}
                  </div>
                  <QtyControl qty={quantity} onInc={() => add(item)} onDec={() => decrement(item.id)} disabled={!item.available} />
                </div>
                <input
                  value={lineNote}
                  onChange={(e) => setNote(item.id, e.target.value)}
                  placeholder="Ghi chú: ít cay, không hành…"
                  maxLength={100}
                  className="mt-2 w-full rounded-lg bg-stone-50 px-3 py-2 text-[16px] outline-none ring-1 ring-stone-200 focus:ring-brand-500"
                />
              </li>
            ))}
          </ul>
          {list.length > 0 && (
            <textarea
              value={note}
              onChange={(e) => setOrderNote(e.target.value)}
              placeholder="Ghi chú cho cả đơn (tuỳ chọn)"
              rows={2}
              maxLength={200}
              className="mb-3 w-full rounded-lg bg-stone-50 px-3 py-2 text-[16px] outline-none ring-1 ring-stone-200 focus:ring-brand-500"
            />
          )}
        </div>

        <div className="border-t border-stone-100 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="mb-3 flex justify-between text-lg">
            <span className="font-semibold">Tạm tính</span>
            <span className="font-extrabold text-brand-600">{money(cartTotal(lines))}</span>
          </div>
          <button
            disabled={list.length === 0 || unavailable.length > 0 || place.isPending}
            onClick={() => place.mutate()}
            className="w-full rounded-2xl bg-brand-500 py-4 text-lg font-bold text-white shadow-lg active:scale-[0.99] disabled:bg-stone-300"
          >
            {place.isPending ? 'Đang gửi…' : 'Đặt món'}
          </button>
          <p className="mt-2 text-center text-xs text-stone-400">Nhân viên sẽ đến bàn xác nhận trước khi chuyển xuống bếp</p>
        </div>
      </div>
    </div>
  )
}
