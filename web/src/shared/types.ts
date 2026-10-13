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
  original_price: number | null // happy hour (SPEC §5.6)
  promotion: string | null
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
  discount: number // phần giảm giá hoá đơn phân bổ khi thanh toán
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
  // Chỉ có ở menu khách khi đang happy hour (SPEC §5.6)
  original_price?: number | null
  promotion?: string | null
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

// Đặt bàn trước (SPEC §5.5)
export type ReservationStatus = 'booked' | 'arrived' | 'cancelled' | 'no_show'
export type Reservation = {
  id: number
  customer_name: string
  phone: string
  party_size: number
  reserved_at: string
  note: string | null
  status: ReservationStatus
  late: boolean
  table: TableRef & { seats: number }
  created_by: { id: number; name: string } | null
  arrived_at: string | null
  cancelled_at: string | null
  created_at: string
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
  'reservation.updated': Reservation
  'menu.refresh': Record<string, never>
  // Chuyển / gộp bàn (SPEC §2.5): table = bàn mới của khách
  'session.moved': { table_session_id: number; table: Table }
  'session.merged': { table_session_id: number; table: Table }
}
export type RealtimeEventName = keyof RealtimeEvents

// Hoá đơn theo phiên bàn (Bills::Build)
export type Bill = {
  bill_no: string
  table_session_id: number
  table: TableRef
  provisional: boolean
  opened_at: string
  closed_at: string | null
  cashier: string | null
  order_codes: string[]
  lines: { name: string; price: number; quantity: number; amount: number; original_price: number | null; promotion: string | null }[]
  subtotal: number
  discounts: { kind: 'voucher' | 'manual'; label: string; amount: number; error?: string | null; reason?: string | null; by?: string | null }[]
  discount_total: number
  total: number
  voucher_code: string | null
  manual_discount: { kind: 'percent' | 'amount'; value: number; reason: string } | null
  restaurant: { name: string; address: string | null; phone: string | null; footer: string }
  printed_at: string
}
