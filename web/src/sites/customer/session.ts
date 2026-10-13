import { createContext, useContext } from 'react'
import { api } from '../../shared/api'
import type { Order, Table } from '../../shared/types'

export type GuestSession = {
  session_token: string
  socket_token: string
  verify_code: string
  table: Table
  orders: Order[]
  total: number
}

const storageKey = (qrToken: string) => `guest:${qrToken}`

export const loadToken = (qrToken: string) => {
  try {
    return sessionStorage.getItem(storageKey(qrToken))
  } catch {
    return null
  }
}

export const saveToken = (qrToken: string, token: string) => {
  try {
    sessionStorage.setItem(storageKey(qrToken), token)
  } catch {
    /* private mode */
  }
}

// Quét QR / mở trang: lấy session đang mở của bàn (dùng lại token cũ nếu còn hợp lệ)
export async function openSession(qrToken: string) {
  const s = await api<GuestSession>(`/public/tables/${qrToken}/session`, {
    method: 'POST',
    sessionToken: loadToken(qrToken),
  })
  saveToken(qrToken, s.session_token)
  return s
}

// Refetch sau đó: chỉ đọc, KHÔNG tạo session mới → bàn đã thanh toán sẽ trả 410
export const fetchSession = (sessionToken: string) => api<GuestSession>('/public/session', { sessionToken })

type Ctx = { qrToken: string; session: GuestSession; refetch: () => void; closed: boolean }
export const GuestContext = createContext<Ctx | null>(null)
export const useGuest = () => {
  const c = useContext(GuestContext)
  if (!c) throw new Error('useGuest outside GuestContext')
  return c
}
