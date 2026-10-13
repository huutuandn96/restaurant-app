import type React from 'react'
import { Link } from 'react-router-dom'
import { money, minutesAgo } from '../../shared/format'
import { useNow } from '../../shared/useNow'
import { Spinner } from '../../shared/ui'
import { useTables, type StaffTable } from './data'

// Sơ đồ bàn (SPEC §2.3.3): bàn có đơn chờ → nhấp nháy đỏ
export default function TablesPage() {
  const now = useNow(60_000)
  const { data, isPending } = useTables()
  if (isPending) return <div className="grid place-items-center py-16"><Spinner /></div>

  const areas = [...new Set((data ?? []).map((t) => t.area ?? ''))]
  const occupied = data?.filter((t) => t.status === 'occupied').length ?? 0

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-bold">Sơ đồ bàn</h1>
        <span className="text-sm text-stone-500">{occupied}/{data?.length} bàn có khách</span>
      </div>
      <Legend />
      {areas.map((area) => (
        <section key={area} className="mt-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">{area}</h2>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {data!.filter((t) => (t.area ?? '') === area).map((t) => <TableTile key={t.id} t={t} now={now} />)}
          </div>
        </section>
      ))}
    </div>
  )
}

function TableTile({ t, now }: { t: StaffTable; now: number }) {
  const alert = t.pending_orders > 0 || t.open_calls > 0
  const tone = alert
    ? 'bg-red-500 text-white animate-pulse ring-red-600'
    : t.ready_orders > 0
      ? 'bg-green-500 text-white ring-green-600'
      : t.status === 'occupied'
        ? 'bg-brand-100 text-brand-700 ring-brand-500/40'
        : 'bg-white text-stone-400 ring-stone-200'
  return (
    <Link to={`/staff/tables/${t.id}`} className={`relative flex aspect-square flex-col items-center justify-center rounded-2xl p-2 ring-2 ${tone}`}>
      <div className="text-3xl font-extrabold">{String(t.number).padStart(2, '0')}</div>
      {t.session ? (
        <>
          <div className="font-mono text-xs font-bold opacity-90">Mã {t.session.verify_code}</div>
          <div className="text-[11px] opacity-80">{money(t.session_total)}</div>
          <div className="text-[10px] opacity-70">{minutesAgo(t.session.opened_at, now)}</div>
        </>
      ) : (
        <div className="text-xs">Trống</div>
      )}
      <div className="absolute -right-1 -top-1 flex gap-1">
        {t.pending_orders > 0 && <Badge className="bg-amber-400 text-amber-950">{t.pending_orders} chờ</Badge>}
        {t.open_calls > 0 && <Badge className="bg-white text-red-600">🙋</Badge>}
      </div>
    </Link>
  )
}

function Badge({ children, className }: { children: React.ReactNode; className: string }) {
  return <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold shadow ${className}`}>{children}</span>
}

function Legend() {
  const items = [
    ['bg-red-500', 'Đơn chờ / gọi NV'],
    ['bg-green-500', 'Có món sẵn sàng'],
    ['bg-brand-100 ring-1 ring-brand-500/40', 'Có khách'],
    ['bg-white ring-1 ring-stone-300', 'Trống'],
  ]
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500">
      {items.map(([c, l]) => (
        <span key={l} className="flex items-center gap-1.5"><span className={`h-3 w-3 rounded ${c}`} />{l}</span>
      ))}
    </div>
  )
}
