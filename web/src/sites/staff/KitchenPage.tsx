import type React from 'react'
import { useMemo, useState } from 'react'
import { useNow } from '../../shared/useNow'
import type { Order, OrderItem } from '../../shared/types'
import { EmptyState, ItemStatus, Modal, Spinner } from '../../shared/ui'
import { useActiveOrders, useDoneOrder, useUpdateItem } from './data'
import { getPref, printKitchenTicket, setPref } from '../../shared/print'
import KitchenByDish from './KitchenByDish'

type View = 'order' | 'dish'
const VIEW_KEY = 'kitchen:view'
function loadView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === 'dish' ? 'dish' : 'order'
  } catch {
    return 'order'
  }
}

const FILTERS = [
  { key: 'todo', label: 'Cần làm', statuses: ['confirmed', 'preparing'] },
  { key: 'confirmed', label: 'Mới', statuses: ['confirmed'] },
  { key: 'preparing', label: 'Đang làm', statuses: ['preparing'] },
  { key: 'ready', label: 'Đã xong', statuses: ['ready'] },
] as const

// Board bếp (SPEC §5.2): xem theo đơn (cũ → mới) hoặc gom theo món; đồng hồ chờ, done từng món / cả đơn, báo hết món
export default function KitchenPage() {
  const now = useNow(15_000)
  const { data, isPending } = useActiveOrders()
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('todo')
  const [tableId, setTableId] = useState<number | 'all'>('all')
  const [soldOut, setSoldOut] = useState<{ order: Order; item: OrderItem } | null>(null)
  const [autoPrint, setAutoPrint] = useState(() => getPref('auto-kitchen', false))
  const [view, setView] = useState<View>(loadView)
  const changeView = (v: View) => {
    setView(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {
      /* private mode */
    }
  }

  const kitchenOrders = useMemo(() => (data ?? []).filter((o) => ['confirmed', 'preparing', 'ready'].includes(o.status)), [data])
  const tables = useMemo(
    () => [...new Map(kitchenOrders.map((o) => [o.table.id, o.table])).values()].sort((a, b) => a.number - b.number),
    [kitchenOrders],
  )
  const statuses: readonly string[] = FILTERS.find((f) => f.key === filter)!.statuses
  const list = kitchenOrders
    .filter((o) => statuses.includes(o.status) && (tableId === 'all' || o.table.id === tableId))
    .sort((a, b) => (a.confirmed_at ?? a.created_at).localeCompare(b.confirmed_at ?? b.created_at))

  return (
    <div>
      <div className="sticky top-[52px] z-20 space-y-2 bg-stone-100 px-4 pb-2 pt-3">
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          <div className="flex shrink-0 rounded-xl bg-white p-1 ring-1 ring-stone-200">
            {(['order', 'dish'] as const).map((v) => (
              <button
                key={v}
                onClick={() => changeView(v)}
                className={`rounded-lg px-3 py-1 text-sm font-semibold ${view === v ? 'bg-brand-500 text-white' : 'text-stone-600'}`}
              >
                {v === 'order' ? 'Theo đơn' : 'Theo món'}
              </button>
            ))}
          </div>
          {view === 'order' && FILTERS.map((f) => {
            const n = kitchenOrders.filter((o) => (f.statuses as readonly string[]).includes(o.status)).length
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold ${filter === f.key ? 'bg-stone-900 text-white' : 'bg-white text-stone-600 ring-1 ring-stone-200'}`}
              >
                {f.label} ({n})
              </button>
            )
          })}
        </div>
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto">
          <label className="flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-semibold text-stone-600 ring-1 ring-stone-200">
            <input
              type="checkbox"
              checked={autoPrint}
              onChange={(e) => {
                setAutoPrint(e.target.checked)
                setPref('auto-kitchen', e.target.checked)
              }}
              className="h-3.5 w-3.5 accent-brand-500"
            />
            🖨️ Tự in phiếu
          </label>
          <TableChip active={tableId === 'all'} onClick={() => setTableId('all')}>Tất cả bàn</TableChip>
          {tables.map((t) => (
            <TableChip key={t.id} active={tableId === t.id} onClick={() => setTableId(t.id)}>{t.label}</TableChip>
          ))}
        </div>
      </div>

      {isPending ? (
        <div className="grid place-items-center py-16"><Spinner /></div>
      ) : view === 'dish' ? (
        <KitchenByDish orders={kitchenOrders.filter((o) => tableId === 'all' || o.table.id === tableId)} now={now} />
      ) : list.length === 0 ? (
        <EmptyState icon="👨‍🍳" text="Không có đơn nào" />
      ) : (
        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((o) => <KitchenCard key={o.id} order={o} now={now} onSoldOut={(item) => setSoldOut({ order: o, item })} />)}
        </div>
      )}

      {soldOut && <SoldOutDialog {...soldOut} onClose={() => setSoldOut(null)} />}
    </div>
  )
}

function TableChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${active ? 'bg-brand-500 text-white' : 'bg-white text-stone-600 ring-1 ring-stone-200'}`}>
      {children}
    </button>
  )
}

function waitTone(minutes: number) {
  if (minutes >= 25) return 'bg-red-600 text-white'
  if (minutes >= 15) return 'bg-amber-400 text-amber-950'
  return 'bg-stone-200 text-stone-700'
}

function KitchenCard({ order, now, onSoldOut }: { order: Order; now: number; onSoldOut: (i: OrderItem) => void }) {
  const update = useUpdateItem()
  const doneAll = useDoneOrder()
  const since = order.confirmed_at ?? order.created_at
  const minutes = Math.max(0, Math.floor((now - new Date(since).getTime()) / 60000))
  const finished = order.items.filter((i) => i.status === 'done' || i.status === 'out_of_stock').length
  const isReady = order.status === 'ready'

  return (
    <article className={`flex flex-col rounded-2xl bg-white shadow-sm ring-1 ${isReady ? 'opacity-70 ring-green-300' : 'ring-stone-200'}`}>
      <header className="flex items-center justify-between rounded-t-2xl bg-stone-900 px-4 py-2.5 text-white">
        <div>
          <span className="text-xl font-extrabold">BÀN {String(order.table.number).padStart(2, '0')}</span>
          <span className="ml-2 font-mono text-xs text-stone-400">#{order.code}</span>
        </div>
        <span className={`rounded-lg px-2 py-0.5 text-sm font-bold tabular-nums ${isReady ? 'bg-green-500 text-white' : waitTone(minutes)}`}>
          {isReady ? 'XONG' : `${minutes}′`}
        </span>
      </header>
      {order.note && <p className="bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800">📝 {order.note}</p>}
      <ul className="flex-1 divide-y divide-stone-100">
        {order.items.map((i) => {
          const off = i.status === 'out_of_stock'
          return (
            <li key={i.id} className={`px-4 py-2.5 ${i.status === 'done' ? 'bg-green-50' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div className={off ? 'text-stone-400 line-through' : ''}>
                  <span className="text-lg font-extrabold">{i.quantity}×</span> <span className="font-semibold">{i.name}</span>
                  {i.note && <div className="text-sm font-medium text-amber-700">“{i.note}”</div>}
                </div>
                <ItemStatus status={i.status} />
              </div>
              {!isReady && (i.status === 'pending' || i.status === 'cooking') && (
                <div className="mt-2 flex gap-2">
                  {i.status === 'pending' && (
                    <button disabled={update.isPending} onClick={() => update.mutate({ id: i.id, status: 'cooking' })} className="rounded-lg bg-violet-100 px-3 py-1.5 text-sm font-semibold text-violet-700">
                      Bắt đầu
                    </button>
                  )}
                  <button disabled={update.isPending} onClick={() => update.mutate({ id: i.id, status: 'done' })} className="flex-1 rounded-lg bg-green-600 py-1.5 text-sm font-bold text-white">
                    ✓ Xong
                  </button>
                  <button onClick={() => onSoldOut(i)} className="rounded-lg bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-600 ring-1 ring-red-200">
                    Hết
                  </button>
                </div>
              )}
              {i.status === 'done' && !isReady && (
                <button onClick={() => update.mutate({ id: i.id, status: 'cooking' })} className="mt-1 text-xs text-stone-400 underline">Hoàn tác</button>
              )}
            </li>
          )
        })}
      </ul>
      <footer className="flex items-center justify-between gap-2 border-t border-stone-100 px-4 py-3">
        <span className="text-sm text-stone-500">{finished}/{order.items.length} món</span>
        <button onClick={() => printKitchenTicket(order)} aria-label="In phiếu bếp" className="ml-auto rounded-xl bg-stone-100 px-3 py-2.5 text-sm font-semibold text-stone-600">
          🖨️ In
        </button>
        {!isReady && (
          <button
            disabled={doneAll.isPending}
            onClick={() => doneAll.mutate(order.id)}
            className="rounded-xl bg-stone-900 px-4 py-2.5 font-bold text-white active:scale-[0.99] disabled:opacity-60"
          >
            Xong cả đơn
          </button>
        )}
      </footer>
    </article>
  )
}

function SoldOutDialog({ order, item, onClose }: { order: Order; item: OrderItem; onClose: () => void }) {
  const update = useUpdateItem()
  const [wholeMenu, setWholeMenu] = useState(true)
  return (
    <Modal title="Báo hết món" onClose={onClose}>
      <p className="text-lg"><b>{item.quantity}× {item.name}</b></p>
      <p className="text-sm text-stone-500">{order.table.label} · đơn #{order.code}</p>
      <label className="mt-4 flex items-start gap-3 rounded-xl bg-stone-50 p-3 ring-1 ring-stone-200">
        <input type="checkbox" checked={wholeMenu} onChange={(e) => setWholeMenu(e.target.checked)} className="mt-1 h-4 w-4 accent-red-600" />
        <span className="text-sm">
          <b>Hết cả menu</b> — ẩn món này với mọi khách (bật lại ở tab “Món hết”)
        </span>
      </label>
      <p className="mt-3 text-xs text-stone-500">Phục vụ và khách sẽ được báo ngay; tiền món này được trừ khỏi đơn.</p>
      <button
        disabled={update.isPending}
        onClick={() => update.mutate({ id: item.id, status: 'out_of_stock', markMenuUnavailable: wholeMenu }, { onSuccess: onClose })}
        className="mt-4 w-full rounded-xl bg-red-600 py-3 font-bold text-white disabled:opacity-60"
      >
        Xác nhận hết món
      </button>
    </Modal>
  )
}
