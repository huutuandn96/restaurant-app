import { create } from 'zustand'
import { api } from './api'
import { toast } from './toast'
import type { Bill, Order } from './types'

// In phiếu bếp / hoá đơn khổ 80mm qua hộp thoại in của trình duyệt (SPEC §5.4).
// Các lệnh in xếp hàng: in xong (afterprint) mới in phiếu kế tiếp.
export type PrintJob = ({ kind: 'kitchen'; order: Order } | { kind: 'bill'; bill: Bill }) & { id: number; printedAt: string }
type JobInput = { kind: 'kitchen'; order: Order } | { kind: 'bill'; bill: Bill }

let seq = 0
export const usePrintQueue = create<{ queue: PrintJob[] }>(() => ({ queue: [] }))
const enqueue = (job: JobInput) =>
  usePrintQueue.setState((s) => ({ queue: [...s.queue, { ...job, id: ++seq, printedAt: new Date().toISOString() }] }))

export const printKitchenTicket = (order: Order) => enqueue({ kind: 'kitchen', order })

export async function printBill(sessionId: number, token: string | null) {
  try {
    enqueue({ kind: 'bill', bill: await api<Bill>(`/staff/table_sessions/${sessionId}/bill`, { token }) })
  } catch (e) {
    toast((e as Error).message, 'error')
  }
}

// Tuỳ chọn lưu trên từng thiết bị
export function getPref(key: 'auto-kitchen' | 'bill-on-checkout', fallback: boolean) {
  try {
    const v = localStorage.getItem(`print:${key}`)
    return v === null ? fallback : v === '1'
  } catch {
    return fallback
  }
}
export function setPref(key: 'auto-kitchen' | 'bill-on-checkout', value: boolean) {
  try {
    localStorage.setItem(`print:${key}`, value ? '1' : '0')
  } catch {
    /* private mode */
  }
}

