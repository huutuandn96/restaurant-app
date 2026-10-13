import type React from 'react'
import { useState } from 'react'
import type { OrderItemStatus, OrderStatus } from './types'
import { ITEM_STATUS_LABEL, ORDER_STATUS_LABEL } from './format'

export function FoodImage({ src, alt, className = '' }: { src: string | null; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return <div className={`grid place-items-center bg-brand-50 text-3xl ${className}`}>🍜</div>
  }
  return <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className={`object-cover ${className}`} />
}

export function QtyControl({ qty, onInc, onDec, disabled }: { qty: number; onInc: () => void; onDec: () => void; disabled?: boolean }) {
  if (qty === 0) {
    return (
      <button
        disabled={disabled}
        onClick={onInc}
        aria-label="Thêm"
        className="grid h-9 w-9 place-items-center rounded-full bg-brand-500 text-xl font-semibold text-white shadow-sm active:scale-95 disabled:bg-stone-300"
      >
        +
      </button>
    )
  }
  return (
    <div className="flex items-center gap-1 rounded-full bg-brand-50 p-1 ring-1 ring-brand-100">
      <button onClick={onDec} aria-label="Bớt" className="grid h-7 w-7 place-items-center rounded-full bg-white text-lg font-semibold text-brand-600 active:scale-95">−</button>
      <span className="w-6 text-center text-sm font-bold tabular-nums">{qty}</span>
      <button disabled={disabled} onClick={onInc} aria-label="Thêm" className="grid h-7 w-7 place-items-center rounded-full bg-brand-500 text-lg font-semibold text-white active:scale-95 disabled:bg-stone-300">+</button>
    </div>
  )
}

const ORDER_BADGE: Record<OrderStatus, string> = {
  pending: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-sky-100 text-sky-800',
  preparing: 'bg-violet-100 text-violet-800',
  ready: 'bg-green-100 text-green-800',
  completed: 'bg-stone-100 text-stone-600',
  cancelled: 'bg-red-100 text-red-700',
}

export function OrderBadge({ status }: { status: OrderStatus }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ORDER_BADGE[status]}`}>{ORDER_STATUS_LABEL[status]}</span>
}

const ITEM_BADGE: Record<OrderItemStatus, string> = {
  pending: 'text-stone-400',
  cooking: 'text-violet-600',
  done: 'text-green-600',
  out_of_stock: 'text-red-600',
}

export function ItemStatus({ status }: { status: OrderItemStatus }) {
  return <span className={`text-xs font-semibold ${ITEM_BADGE[status]}`}>{ITEM_STATUS_LABEL[status]}</span>
}

export function Spinner() {
  return <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-100 border-t-brand-500" />
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-stone-100" aria-label="Đóng">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="py-16 text-center text-stone-400">
      <div className="text-4xl">{icon}</div>
      <p className="mt-2">{text}</p>
    </div>
  )
}
