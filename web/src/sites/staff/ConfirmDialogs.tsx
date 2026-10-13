import { useState } from 'react'
import type { Order } from '../../shared/types'
import { Modal } from '../../shared/ui'
import { useCancelOrder, useConfirmOrder } from './data'

// Xác nhận tại bàn: đối chiếu mã trên điện thoại khách (SPEC §2.3.2)
export function ConfirmOrderDialog({ order, onClose }: { order: Order; onClose: () => void }) {
  const confirm = useConfirmOrder()
  return (
    <Modal title={`Xác nhận ${order.table.label}`} onClose={onClose}>
      <p className="text-sm text-stone-600">Đối chiếu mã trên điện thoại khách:</p>
      <div className="my-4 text-center font-mono text-6xl font-extrabold tracking-[0.25em]">{order.verify_code}</div>
      <p className="text-center text-sm text-stone-500">
        {order.table.label} · {order.table.area} · {order.items.reduce((n, i) => n + i.quantity, 0)} món
      </p>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <button onClick={onClose} className="rounded-xl bg-stone-100 py-3 font-semibold">Mã không khớp</button>
        <button
          disabled={confirm.isPending}
          onClick={() => confirm.mutate(order.id, { onSuccess: onClose })}
          className="rounded-xl bg-green-600 py-3 font-bold text-white disabled:opacity-60"
        >
          Khớp → Gửi bếp
        </button>
      </div>
    </Modal>
  )
}

const REASONS = ['Mã không khớp / đặt nhầm bàn', 'Khách đổi ý', 'Khách đặt trùng', 'Hết món']

export function CancelOrderDialog({ order, onClose }: { order: Order; onClose: () => void }) {
  const cancel = useCancelOrder()
  const [reason, setReason] = useState(REASONS[0])
  return (
    <Modal title={`Huỷ đơn #${order.code} · ${order.table.label}`} onClose={onClose}>
      <div className="grid gap-2">
        {REASONS.map((r) => (
          <label key={r} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ring-1 ${reason === r ? 'bg-red-50 ring-red-300' : 'ring-stone-200'}`}>
            <input type="radio" checked={reason === r} onChange={() => setReason(r)} className="accent-red-600" />
            <span className="text-sm">{r}</span>
          </label>
        ))}
      </div>
      <button
        disabled={cancel.isPending}
        onClick={() => cancel.mutate({ id: order.id, reason }, { onSuccess: onClose })}
        className="mt-4 w-full rounded-xl bg-red-600 py-3 font-bold text-white disabled:opacity-60"
      >
        Huỷ đơn
      </button>
    </Modal>
  )
}
