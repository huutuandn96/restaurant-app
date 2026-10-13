import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { api } from '../../shared/api'
import { useAuth } from '../../shared/auth'
import { toast } from '../../shared/toast'
import type { Order, OrderItemStatus, StaffCall, Table } from '../../shared/types'

export type StaffTable = Table & { pending_orders: number; ready_orders: number; open_calls: number; session_total: number }
export type TableDetail = Table & { orders: Order[]; session_total: number }

export const keys = {
  orders: ['staff', 'orders'] as const,
  tables: ['staff', 'tables'] as const,
  table: (id: number) => ['staff', 'table', id] as const,
  calls: ['staff', 'calls'] as const,
}

const useToken = () => useAuth((s) => s.token)

// Mọi đơn đang hoạt động (pending → ready). Waiter và bếp lọc phía client.
export function useActiveOrders() {
  const token = useToken()
  return useQuery({ queryKey: keys.orders, queryFn: () => api<Order[]>('/staff/orders', { token }) })
}

export function useTables(enabled = true) {
  const token = useToken()
  return useQuery({ queryKey: keys.tables, queryFn: () => api<StaffTable[]>('/staff/tables', { token }), enabled })
}

export function useTableDetail(id: number) {
  const token = useToken()
  return useQuery({ queryKey: keys.table(id), queryFn: () => api<TableDetail>(`/staff/tables/${id}`, { token }) })
}

export function useCalls(enabled = true) {
  const token = useToken()
  return useQuery({ queryKey: keys.calls, queryFn: () => api<StaffCall[]>('/staff/staff_calls', { token }), enabled })
}

// Cập nhật cache khi có order mới / đổi trạng thái (từ API hoặc realtime)
export function applyOrder(qc: QueryClient, order: Order) {
  const active = !['completed', 'cancelled'].includes(order.status)
  qc.setQueryData<Order[]>(keys.orders, (old) => {
    if (!old) return old
    const rest = old.filter((o) => o.id !== order.id)
    return active ? [...rest, order].sort((a, b) => a.created_at.localeCompare(b.created_at)) : rest
  })
  qc.setQueryData<TableDetail>(keys.table(order.table.id), (old) => {
    if (!old) return old
    const exists = old.orders.some((o) => o.id === order.id)
    const orders = exists ? old.orders.map((o) => (o.id === order.id ? order : o)) : [...old.orders, order]
    return { ...old, orders, session_total: orders.filter((o) => o.status !== 'cancelled').reduce((n, o) => n + o.total, 0) }
  })
  void qc.invalidateQueries({ queryKey: keys.tables })
}

function useOrderMutation<V>(fn: (v: V, token: string | null) => Promise<Order>, success?: string) {
  const qc = useQueryClient()
  const token = useToken()
  return useMutation({
    mutationFn: (v: V) => fn(v, token),
    onSuccess: (order) => {
      applyOrder(qc, order)
      if (success) toast(success)
    },
    onError: (e) => toast(e.message, 'error'),
  })
}

export const useConfirmOrder = () =>
  useOrderMutation<number>((id, token) => api(`/staff/orders/${id}/confirm`, { method: 'POST', token }), 'Đã xác nhận, đơn đã chuyển xuống bếp')

export const useCancelOrder = () =>
  useOrderMutation<{ id: number; reason: string }>(
    ({ id, reason }, token) => api(`/staff/orders/${id}/cancel`, { method: 'POST', token, body: { reason } }),
    'Đã huỷ đơn',
  )

export const useDoneOrder = () =>
  useOrderMutation<number>((id, token) => api(`/staff/orders/${id}/done`, { method: 'POST', token }), 'Đã xong cả đơn')

export const useUpdateItem = () =>
  useOrderMutation<{ id: number; status: OrderItemStatus; markMenuUnavailable?: boolean }>(({ id, status, markMenuUnavailable }, token) =>
    api(`/staff/order_items/${id}`, { method: 'PATCH', token, body: { status, mark_menu_unavailable: !!markMenuUnavailable } }),
  )

// Gom theo món: cập nhật nhiều món (nhiều đơn) trong 1 request
export function useBatchItems() {
  const qc = useQueryClient()
  const token = useToken()
  return useMutation({
    mutationFn: (v: { ids: number[]; status: OrderItemStatus; markMenuUnavailable?: boolean }) =>
      api<Order[]>('/staff/order_items/batch', {
        method: 'PATCH',
        token,
        body: { ids: v.ids, status: v.status, mark_menu_unavailable: !!v.markMenuUnavailable },
      }),
    onSuccess: (orders) => orders.forEach((o) => applyOrder(qc, o)),
    onError: (e) => toast(e.message, 'error'),
  })
}

export function useCheckout() {
  const qc = useQueryClient()
  const token = useToken()
  return useMutation({
    mutationFn: (tableId: number) =>
      api<Table & { closed_session_id: number }>(`/staff/tables/${tableId}/checkout`, { method: 'POST', token }),
    onSuccess: (t) => {
      toast(`${t.label} đã thanh toán & đóng bàn`)
      void qc.invalidateQueries({ queryKey: ['staff'] })
    },
    onError: (e) => toast(e.message, 'error'),
  })
}

export function useResolveCall() {
  const qc = useQueryClient()
  const token = useToken()
  return useMutation({
    mutationFn: (id: number) => api<StaffCall>(`/staff/staff_calls/${id}/resolve`, { method: 'POST', token }),
    onSuccess: (c) => {
      qc.setQueryData<StaffCall[]>(keys.calls, (old) => old?.filter((x) => x.id !== c.id))
      void qc.invalidateQueries({ queryKey: keys.tables })
    },
    onError: (e) => toast(e.message, 'error'),
  })
}
