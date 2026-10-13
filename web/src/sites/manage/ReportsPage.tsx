import { useState } from 'react'
import { download } from '../../shared/api'
import { money } from '../../shared/format'
import { toast } from '../../shared/toast'
import { Spinner } from '../../shared/ui'
import { btnGhost, btnPrimary, card, inputBase, todayStr, useManageQuery, useToken } from './hooks'

type Row = { period: string; orders: number; revenue: number }
type Report = { from: string; to: string; group: 'day' | 'month'; rows: Row[]; total_orders: number; total_revenue: number }

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const PRESETS = [
  { label: 'Hôm nay', range: () => [todayStr(), todayStr(), 'day'] },
  { label: '7 ngày', range: () => { const d = new Date(); d.setDate(d.getDate() - 6); return [iso(d), todayStr(), 'day'] } },
  { label: 'Tháng này', range: () => { const d = new Date(); return [iso(new Date(d.getFullYear(), d.getMonth(), 1)), todayStr(), 'day'] } },
  { label: 'Tháng trước', range: () => { const d = new Date(); return [iso(new Date(d.getFullYear(), d.getMonth() - 1, 1)), iso(new Date(d.getFullYear(), d.getMonth(), 0)), 'day'] } },
  { label: '12 tháng', range: () => { const d = new Date(); return [iso(new Date(d.getFullYear(), d.getMonth() - 11, 1)), todayStr(), 'month'] } },
] as const

// Doanh thu (chỉ owner) — SPEC §5.3: ngày / khoảng ngày / tháng + CSV
export default function ReportsPage() {
  const token = useToken()
  const [[from, to, group], setRange] = useState<[string, string, string]>(PRESETS[2].range() as [string, string, string])
  const [hover, setHover] = useState<number | null>(null)
  const qs = new URLSearchParams({ from, to, group })
  const { data, isPending, error } = useManageQuery<Report>(['report', qs.toString()], `/manage/reports/revenue?${qs}`, from <= to)

  const exportCsv = () =>
    download(`/manage/reports/revenue?${qs}&format=csv`, token, `doanh-thu_${from}_${to}_${group}.csv`).catch((e) => toast(e.message, 'error'))

  const max = Math.max(1, ...(data?.rows.map((r) => r.revenue) ?? [1]))
  const avg = data && data.rows.length ? data.total_revenue / data.rows.length : 0

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">Doanh thu</h1>

      <div className="flex flex-wrap items-end gap-2">
        <div className="no-scrollbar flex gap-1 overflow-x-auto">
          {PRESETS.map((p) => (
            <button key={p.label} onClick={() => setRange(p.range() as [string, string, string])} className="shrink-0 rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-stone-600 ring-1 ring-stone-200 hover:bg-stone-50">{p.label}</button>
          ))}
        </div>
        <input type="date" value={from} max={to} onChange={(e) => setRange([e.target.value, to, group])} className={`${inputBase} w-auto`} />
        <span className="pb-2 text-stone-400">→</span>
        <input type="date" value={to} min={from} max={todayStr()} onChange={(e) => setRange([from, e.target.value, group])} className={`${inputBase} w-auto`} />
        <select value={group} onChange={(e) => setRange([from, to, e.target.value])} className={`${inputBase} w-auto`}>
          <option value="day">Theo ngày</option>
          <option value="month">Theo tháng</option>
        </select>
        <button onClick={exportCsv} className={`${btnPrimary} ml-auto`}>⬇ Xuất CSV</button>
      </div>

      {error && <p className="text-red-600">{error.message}</p>}
      {isPending || !data ? (
        <div className="grid place-items-center py-16"><Spinner /></div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className={card}><div className="text-sm font-semibold text-stone-500">Tổng doanh thu</div><div className="mt-1 text-3xl font-extrabold tabular-nums">{money(data.total_revenue)}</div></div>
            <div className={card}><div className="text-sm font-semibold text-stone-500">Số đơn hoàn thành</div><div className="mt-1 text-3xl font-extrabold tabular-nums">{data.total_orders}</div></div>
            <div className={card}><div className="text-sm font-semibold text-stone-500">Trung bình / {group === 'month' ? 'tháng' : 'ngày'}</div><div className="mt-1 text-3xl font-extrabold tabular-nums">{money(Math.round(avg / 1000) * 1000)}</div></div>
          </div>

          {/* Biểu đồ cột 1 series, tooltip khi hover */}
          {data.rows.length > 0 && (
            <section className={card}>
              <h2 className="font-bold">Doanh thu theo {group === 'month' ? 'tháng' : 'ngày'}</h2>
              <div className="relative mt-4 flex h-56 items-end gap-[2px] border-b border-stone-200" onMouseLeave={() => setHover(null)}>
                {data.rows.map((r, i) => (
                  <div key={r.period} className="group relative flex h-full flex-1 items-end" onMouseEnter={() => setHover(i)} onClick={() => setHover(i)}>
                    <div className={`w-full rounded-t-[4px] ${hover === i ? 'bg-brand-600' : 'bg-brand-500'}`} style={{ height: `${Math.max(1, (r.revenue / max) * 100)}%` }} />
                    {hover === i && (
                      <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-stone-900 px-3 py-2 text-xs text-white shadow-lg">
                        <div className="font-semibold">{r.period}</div>
                        <div>{money(r.revenue)} · {r.orders} đơn</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-1 flex justify-between text-xs text-stone-400">
                <span>{data.rows[0].period}</span><span>{data.rows[data.rows.length - 1].period}</span>
              </div>
            </section>
          )}

          {/* Bảng số liệu */}
          <section className={`${card} overflow-x-auto p-0`}>
            <table className="w-full text-sm">
              <thead className="border-b border-stone-100 text-left text-xs uppercase text-stone-500">
                <tr><th className="px-4 py-3">{group === 'month' ? 'Tháng' : 'Ngày'}</th><th className="px-4 py-3 text-right">Số đơn</th><th className="px-4 py-3 text-right">Doanh thu</th></tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {data.rows.length === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center text-stone-400">Không có doanh thu trong khoảng này</td></tr>}
                {[...data.rows].reverse().map((r) => (
                  <tr key={r.period}><td className="px-4 py-2.5">{r.period}</td><td className="px-4 py-2.5 text-right tabular-nums">{r.orders}</td><td className="px-4 py-2.5 text-right font-semibold tabular-nums">{money(r.revenue)}</td></tr>
                ))}
              </tbody>
              {data.rows.length > 0 && (
                <tfoot className="border-t-2 border-stone-200 font-bold">
                  <tr><td className="px-4 py-3">Tổng</td><td className="px-4 py-3 text-right tabular-nums">{data.total_orders}</td><td className="px-4 py-3 text-right tabular-nums">{money(data.total_revenue)}</td></tr>
                </tfoot>
              )}
            </table>
          </section>
          <button onClick={exportCsv} className={`${btnGhost} sm:hidden`}>⬇ Xuất CSV</button>
        </>
      )}
    </div>
  )
}
