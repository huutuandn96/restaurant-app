import { useState } from 'react'
import type { Order, OrderItem } from '../../shared/types'
import { EmptyState, Modal } from '../../shared/ui'
import { useBatchItems, useUpdateItem } from './data'

type Line = { item: OrderItem; order: Order; since: string }
type Group = { menuItemId: number; name: string; quantity: number; cooking: number; oldest: string; lines: Line[] }

// Gom các món chưa xong của mọi đơn đã gửi bếp theo món (SPEC §5.2): nấu 1 mẻ cho nhiều bàn.
function groupByDish(orders: Order[]): Group[] {
  const map = new Map<number, Group>()
  for (const order of orders) {
    if (order.status !== 'confirmed' && order.status !== 'preparing') continue
    const since = order.confirmed_at ?? order.created_at
    for (const item of order.items) {
      if (item.status !== 'pending' && item.status !== 'cooking') continue
      const g = map.get(item.menu_item_id) ?? { menuItemId: item.menu_item_id, name: item.name, quantity: 0, cooking: 0, oldest: since, lines: [] }
      g.quantity += item.quantity
      if (item.status === 'cooking') g.cooking += item.quantity
      if (since < g.oldest) g.oldest = since
      g.lines.push({ item, order, since })
      map.set(item.menu_item_id, g)
    }
  }
  const groups = [...map.values()]
  groups.forEach((g) => g.lines.sort((a, b) => a.since.localeCompare(b.since)))
  // Món chờ lâu nhất lên trước
  return groups.sort((a, b) => a.oldest.localeCompare(b.oldest))
}

const minutesSince = (iso: string, now: number) => Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000))

function waitTone(minutes: number) {
  if (minutes >= 25) return 'bg-red-600 text-white'
  if (minutes >= 15) return 'bg-amber-400 text-amber-950'
  return 'bg-stone-200 text-stone-700'
}

export default function KitchenByDish({ orders, now }: { orders: Order[]; now: number }) {
  const groups = groupByDish(orders)
  const [soldOut, setSoldOut] = useState<Group | null>(null)
  if (groups.length === 0) return <EmptyState icon="👨‍🍳" text="Không còn món nào cần làm" />
  return (
    <>
      <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
        {groups.map((g) => <DishCard key={g.menuItemId} group={g} now={now} onSoldOut={() => setSoldOut(g)} />)}
      </div>
      {soldOut && <DishSoldOutDialog group={soldOut} onClose={() => setSoldOut(null)} />}
    </>
  )
}

function DishCard({ group, now, onSoldOut }: { group: Group; now: number; onSoldOut: () => void }) {
  const batch = useBatchItems()
  const update = useUpdateItem()
  const minutes = minutesSince(group.oldest, now)
  const ids = group.lines.map((l) => l.item.id)
  const pendingIds = group.lines.filter((l) => l.item.status === 'pending').map((l) => l.item.id)
  const busy = batch.isPending || update.isPending

  return (
    <article className="flex flex-col rounded-2xl bg-white shadow-sm ring-1 ring-stone-200">
      <header className="flex items-center gap-3 rounded-t-2xl bg-stone-900 px-4 py-2.5 text-white">
        <span className="text-3xl font-extrabold tabular-nums">{group.quantity}×</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-lg font-bold">{group.name}</div>
          <div className="text-xs text-stone-400">
            {group.lines.length} bàn/đơn{group.cooking > 0 && ` · ${group.cooking} đang nấu`}
          </div>
        </div>
        <span className={`rounded-lg px-2 py-0.5 text-sm font-bold tabular-nums ${waitTone(minutes)}`}>{minutes}′</span>
      </header>

      <ul className="flex-1 divide-y divide-stone-100">
        {group.lines.map(({ item, order, since }) => (
          <li key={item.id} className="flex items-center gap-3 px-4 py-2">
            <div className="min-w-0 flex-1">
              <div>
                <span className="font-bold">BÀN {String(order.table.number).padStart(2, '0')}</span>
                <span className="ml-1.5 text-lg font-extrabold">{item.quantity}×</span>
                <span className="ml-1.5 text-xs text-stone-400">#{order.code} · {minutesSince(since, now)}′</span>
                {item.status === 'cooking' && <span className="ml-1.5 text-xs font-semibold text-violet-600">đang nấu</span>}
              </div>
              {item.note && <div className="text-sm font-medium text-amber-700">“{item.note}”</div>}
            </div>
            <button
              disabled={busy}
              onClick={() => update.mutate({ id: item.id, status: 'done' })}
              aria-label={`Xong ${item.name} bàn ${order.table.number}`}
              className="rounded-lg bg-green-50 px-3 py-1.5 text-sm font-bold text-green-700 ring-1 ring-green-200"
            >
              ✓
            </button>
          </li>
        ))}
      </ul>

      <footer className="flex gap-2 border-t border-stone-100 px-4 py-3">
        <button onClick={onSoldOut} className="rounded-xl bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-600 ring-1 ring-red-200">
          Hết
        </button>
        {pendingIds.length > 0 && (
          <button
            disabled={busy}
            onClick={() => batch.mutate({ ids: pendingIds, status: 'cooking' })}
            className="rounded-xl bg-violet-100 px-3 py-2.5 text-sm font-semibold text-violet-700"
          >
            Bắt đầu cả mẻ
          </button>
        )}
        <button
          disabled={busy}
          onClick={() => batch.mutate({ ids, status: 'done' })}
          className="flex-1 rounded-xl bg-green-600 py-2.5 font-bold text-white active:scale-[0.99] disabled:opacity-60"
        >
          ✓ Xong cả {group.quantity}
        </button>
      </footer>
    </article>
  )
}

function DishSoldOutDialog({ group, onClose }: { group: Group; onClose: () => void }) {
  const batch = useBatchItems()
  const [wholeMenu, setWholeMenu] = useState(true)
  return (
    <Modal title="Báo hết món" onClose={onClose}>
      <p className="text-lg"><b>{group.name}</b></p>
      <p className="text-sm text-stone-500">
        {group.quantity} phần ở {group.lines.map((l) => l.order.table.label).filter((v, i, a) => a.indexOf(v) === i).join(', ')}
      </p>
      <label className="mt-4 flex items-start gap-3 rounded-xl bg-stone-50 p-3 ring-1 ring-stone-200">
        <input type="checkbox" checked={wholeMenu} onChange={(e) => setWholeMenu(e.target.checked)} className="mt-1 h-4 w-4 accent-red-600" />
        <span className="text-sm">
          <b>Hết cả menu</b> — ẩn món này với mọi khách (bật lại ở tab “Món hết”)
        </span>
      </label>
      <p className="mt-3 text-xs text-stone-500">Mọi phần chưa xong của món này đều bị báo hết; phục vụ và khách được báo ngay, tiền được trừ khỏi từng đơn.</p>
      <button
        disabled={batch.isPending}
        onClick={() =>
          batch.mutate(
            { ids: group.lines.map((l) => l.item.id), status: 'out_of_stock', markMenuUnavailable: wholeMenu },
            { onSuccess: onClose },
          )
        }
        className="mt-4 w-full rounded-xl bg-red-600 py-3 font-bold text-white disabled:opacity-60"
      >
        Xác nhận hết {group.quantity} phần
      </button>
    </Modal>
  )
}
