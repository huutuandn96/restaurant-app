import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { MenuItem } from '../../shared/types'

export type CartLine = { item: MenuItem; quantity: number; note: string }

type CartState = {
  sessionToken: string | null
  lines: Record<number, CartLine>
  bindSession: (token: string) => void
  add: (item: MenuItem) => void
  decrement: (itemId: number) => void
  setQuantity: (itemId: number, quantity: number) => void
  setNote: (itemId: number, note: string) => void
  syncItem: (item: MenuItem) => void
  syncMenu: (items: MenuItem[]) => void
  clear: () => void
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      sessionToken: null,
      lines: {},
      // Giỏ gắn với 1 session; đổi session (lượt khách mới) → giỏ rỗng
      bindSession: (token) => set((s) => (s.sessionToken === token ? s : { sessionToken: token, lines: {} })),
      add: (item) =>
        set((s) => {
          const cur = s.lines[item.id]
          return { lines: { ...s.lines, [item.id]: { item, quantity: (cur?.quantity ?? 0) + 1, note: cur?.note ?? '' } } }
        }),
      decrement: (id) =>
        set((s) => {
          const cur = s.lines[id]
          if (!cur) return s
          const lines = { ...s.lines }
          if (cur.quantity <= 1) delete lines[id]
          else lines[id] = { ...cur, quantity: cur.quantity - 1 }
          return { lines }
        }),
      setQuantity: (id, quantity) =>
        set((s) => {
          const lines = { ...s.lines }
          if (quantity <= 0) delete lines[id]
          else if (lines[id]) lines[id] = { ...lines[id], quantity: Math.min(quantity, 99) }
          return { lines }
        }),
      setNote: (id, note) =>
        set((s) => (s.lines[id] ? { lines: { ...s.lines, [id]: { ...s.lines[id], note } } } : s)),
      // Cập nhật giá / tình trạng món từ realtime
      syncItem: (item) =>
        set((s) => (s.lines[item.id] ? { lines: { ...s.lines, [item.id]: { ...s.lines[item.id], item } } } : s)),
      // Giỏ lưu trong sessionStorage có thể giữ giá / ảnh / tình trạng cũ → đồng bộ khi tải menu
      syncMenu: (items) =>
        set((s) => {
          const byId = new Map(items.map((i) => [i.id, i]))
          const lines: Record<number, CartLine> = {}
          for (const [id, line] of Object.entries(s.lines)) {
            const fresh = byId.get(Number(id))
            if (fresh) lines[Number(id)] = { ...line, item: fresh } // món bị xoá khỏi menu → bỏ khỏi giỏ
          }
          return { lines }
        }),
      clear: () => set({ lines: {} }),
    }),
    { name: 'guest-cart', storage: createJSONStorage(() => sessionStorage) },
  ),
)

export const cartCount = (lines: Record<number, CartLine>) => Object.values(lines).reduce((n, l) => n + l.quantity, 0)
export const cartTotal = (lines: Record<number, CartLine>) =>
  Object.values(lines).reduce((n, l) => n + l.item.price * l.quantity, 0)
