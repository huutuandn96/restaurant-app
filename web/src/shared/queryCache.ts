import type { QueryClient } from '@tanstack/react-query'
import type { Order } from './types'

// Cập nhật 1 order trong mọi list đang cache mà không refetch
export function upsertOrderInLists(qc: QueryClient, order: Order, keyPrefix: unknown[]) {
  qc.setQueriesData<Order[]>({ queryKey: keyPrefix }, (old) => {
    if (!Array.isArray(old)) return old
    const idx = old.findIndex((o) => o.id === order.id)
    if (idx === -1) return [...old, order]
    const next = old.slice()
    next[idx] = order
    return next
  })
}
