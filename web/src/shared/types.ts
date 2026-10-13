// Khớp với serializers phía Rails (api/app/serializers)
export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled'
export type OrderItemStatus = 'pending' | 'cooking' | 'done' | 'out_of_stock'
export type Role = 'waiter' | 'kitchen' | 'manager' | 'owner'

export type TableRef = { id: number; number: number; label: string; area: string | null }

export type OrderItem = {
  id: number
  order_id: number
  menu_item_id: number
  name: string
  price: number
  quantity: number
  subtotal: number
  note: string | null
  status: OrderItemStatus
  done_at: string | null
}

export type OrderEvent = {
  id: number
  action: string
  from_status: OrderStatus | null
  to_status: OrderStatus | null
  data: Record<string, unknown>
  user: { id: number; name: string; role: Role } | null
  created_at: string
}

export type Order = {
  id: number
  code: string
  status: OrderStatus
  note: string | null
  total: number
  table: TableRef
  table_session_id: number
  verify_code: string
  confirmed_by: { id: number; name: string } | null
  created_at: string
  confirmed_at: string | null
  ready_at: string | null
  completed_at: string | null
  cancelled_at: string | null
  cancel_reason: string | null
  items: OrderItem[]
  events?: OrderEvent[]
}

export type TableSessionInfo = {
  id: number
  verify_code: string
  status: 'open' | 'closed'
  opened_at: string
  closed_at: string | null
}

export type Table = TableRef & {
  seats: number
  status: 'available' | 'occupied'
  session: TableSessionInfo | null
  qr_token?: string
  qr_url?: string
}

export type MenuItem = {
  id: number
  category_id: number
  name: string
  description: string | null
  price: number
  image_url: string | null
  available: boolean
  position: number
}

export type Category = { id: number; name: string; position: number; active: boolean; items?: MenuItem[] }

export type User = { id: number; name: string; email: string; role: Role; active: boolean }

export type StaffCall = {
  id: number
  status: 'open' | 'resolved'
  created_at: string
  table_session_id: number
  table: TableRef
}

// Event realtime (SPEC §1)
export type RealtimeEvents = {
  'order.created': Order
  'order.updated': Order
  'order.confirmed': Order
  'order_item.updated': OrderItem
  'table.call_staff': StaffCall
  'staff_call.resolved': StaffCall
  'table.updated': Table
  'menu_item.updated': MenuItem
  'session.closed': { table_session_id: number }
}
export type RealtimeEventName = keyof RealtimeEvents
