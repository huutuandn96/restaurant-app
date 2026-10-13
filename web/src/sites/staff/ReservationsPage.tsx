import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { time } from '../../shared/format'
import type { Reservation, ReservationStatus } from '../../shared/types'
import { EmptyState, Modal, Spinner } from '../../shared/ui'
import { useReservationAction, useReservations, useTables, type ReservationInput } from './data'

const input =
  'w-full rounded-xl bg-white px-3 py-2.5 text-[16px] outline-none ring-1 ring-stone-200 focus:ring-2 focus:ring-brand-500 sm:text-sm'

const pad = (n: number) => String(n).padStart(2, '0')
const dateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const shiftDate = (s: string, days: number) => {
  const d = new Date(`${s}T00:00`)
  d.setDate(d.getDate() + days)
  return dateStr(d)
}

const STATUS: Record<ReservationStatus, { label: string; cls: string }> = {
  booked: { label: 'Chờ khách', cls: 'bg-violet-100 text-violet-700' },
  arrived: { label: 'Đã đến', cls: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Đã huỷ', cls: 'bg-stone-200 text-stone-500' },
  no_show: { label: 'Không đến', cls: 'bg-red-100 text-red-600' },
}

// Đặt bàn trước (SPEC §5.5): nhân viên nhập khi khách gọi điện
export default function ReservationsPage() {
  const [today] = useState(() => dateStr(new Date()))
  const [date, setDate] = useState(today)
  const { data, isPending } = useReservations(date)
  const [editing, setEditing] = useState<Reservation | 'new' | null>(null)

  const booked = data?.filter((r) => r.status === 'booked') ?? []
  const people = booked.reduce((n, r) => n + r.party_size, 0)

  return (
    <div className="p-4">
      <div className="flex items-center gap-2">
        <button onClick={() => setDate(shiftDate(date, -1))} className="grid h-10 w-10 place-items-center rounded-xl bg-white ring-1 ring-stone-200" aria-label="Ngày trước">‹</button>
        <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className={`${input} flex-1 text-center font-semibold`} />
        <button onClick={() => setDate(shiftDate(date, 1))} className="grid h-10 w-10 place-items-center rounded-xl bg-white ring-1 ring-stone-200" aria-label="Ngày sau">›</button>
        {date !== today && <button onClick={() => setDate(today)} className="rounded-xl bg-white px-3 py-2.5 text-sm font-semibold ring-1 ring-stone-200">Hôm nay</button>}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-sm text-stone-500">{booked.length} lượt chờ · {people} khách</span>
        <button onClick={() => setEditing('new')} className="rounded-xl bg-brand-500 px-4 py-2.5 font-bold text-white active:scale-95">+ Đặt bàn</button>
      </div>

      {isPending ? (
        <div className="grid place-items-center py-16"><Spinner /></div>
      ) : !data?.length ? (
        <EmptyState icon="📅" text="Chưa có lượt đặt nào trong ngày" />
      ) : (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {data.map((r) => <ReservationCard key={r.id} r={r} onEdit={() => setEditing(r)} />)}
        </div>
      )}

      {editing && <ReservationForm initial={editing === 'new' ? null : editing} date={date} onClose={() => setEditing(null)} />}
    </div>
  )
}

function ReservationCard({ r, onEdit }: { r: Reservation; onEdit: () => void }) {
  const act = useReservationAction()
  const navigate = useNavigate()
  const st = STATUS[r.status]
  const active = r.status === 'booked'
  return (
    <article className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ${r.late ? 'ring-red-300' : 'ring-stone-200'} ${active ? '' : 'opacity-70'}`}>
      <div className="flex items-start gap-3">
        <div className="text-center">
          <div className="text-2xl font-extrabold tabular-nums">{time(r.reserved_at)}</div>
          <div className="text-xs font-bold text-stone-500">{r.table.label}</div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold">{r.customer_name}</span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${st.cls}`}>{st.label}</span>
            {r.late && <span className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-bold text-white">Trễ</span>}
          </div>
          <div className="text-sm text-stone-600">
            👥 {r.party_size} người · <a href={`tel:${r.phone}`} className="text-brand-600 underline">{r.phone}</a>
          </div>
          {r.note && <div className="mt-1 text-sm italic text-amber-700">“{r.note}”</div>}
        </div>
      </div>
      {active && (
        <div className="mt-3 flex gap-2">
          <button onClick={onEdit} className="rounded-xl bg-stone-100 px-3 py-2 text-sm font-semibold text-stone-600">Sửa</button>
          <button
            disabled={act.isPending}
            onClick={() => confirm(`Huỷ lượt đặt của ${r.customer_name}?`) && act.mutate({ action: 'cancel', id: r.id })}
            className="rounded-xl bg-stone-100 px-3 py-2 text-sm font-semibold text-stone-600"
          >
            Huỷ
          </button>
          {r.late && (
            <button disabled={act.isPending} onClick={() => act.mutate({ action: 'no_show', id: r.id })} className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 ring-1 ring-red-200">
              Không đến
            </button>
          )}
          <button
            disabled={act.isPending}
            onClick={() => act.mutate({ action: 'arrive', id: r.id }, { onSuccess: (x) => navigate(`/staff/tables/${x.table.id}`) })}
            className="flex-1 rounded-xl bg-green-600 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            Khách đã đến
          </button>
        </div>
      )}
    </article>
  )
}

function ReservationForm({ initial, date, onClose }: { initial: Reservation | null; date: string; onClose: () => void }) {
  const tables = useTables()
  const act = useReservationAction()
  const at = initial ? new Date(initial.reserved_at) : null
  const [f, setF] = useState({
    customer_name: initial?.customer_name ?? '',
    phone: initial?.phone ?? '',
    party_size: initial?.party_size ?? 2,
    day: at ? dateStr(at) : date,
    time: at ? `${pad(at.getHours())}:${pad(at.getMinutes())}` : '19:00',
    table_id: initial?.table.id ?? 0,
    note: initial?.note ?? '',
  })
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }))

  const submit = () => {
    const body: ReservationInput = {
      table_id: f.table_id,
      customer_name: f.customer_name.trim(),
      phone: f.phone.trim(),
      party_size: Number(f.party_size),
      reserved_at: new Date(`${f.day}T${f.time}`).toISOString(),
      note: f.note.trim(),
    }
    const v = initial ? { action: 'update' as const, id: initial.id, ...body } : { action: 'create' as const, ...body }
    act.mutate(v, { onSuccess: onClose })
  }

  const fit = (tables.data ?? []).filter((t) => t.seats >= f.party_size)
  const rest = (tables.data ?? []).filter((t) => t.seats < f.party_size)

  return (
    <Modal title={initial ? 'Sửa lượt đặt' : 'Đặt bàn'} onClose={onClose}>
      <div className="max-h-[70vh] space-y-3 overflow-y-auto p-0.5">
        <input value={f.customer_name} onChange={(e) => set('customer_name', e.target.value)} placeholder="Tên khách" className={input} />
        <div className="flex gap-2">
          <input value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="Số điện thoại" inputMode="tel" className={input} />
          <label className="flex shrink-0 items-center gap-1 rounded-xl px-2 ring-1 ring-stone-200">
            👥
            <input type="number" min={1} value={f.party_size} onChange={(e) => set('party_size', Number(e.target.value))} className="w-12 py-2.5 text-[16px] outline-none sm:text-sm" aria-label="Số người" />
          </label>
        </div>
        <div className="flex gap-2">
          <input type="date" value={f.day} onChange={(e) => set('day', e.target.value)} className={input} />
          <input type="time" value={f.time} onChange={(e) => set('time', e.target.value)} className={input} />
        </div>
        <select value={f.table_id} onChange={(e) => set('table_id', Number(e.target.value))} className={input}>
          <option value={0}>— Chọn bàn —</option>
          <optgroup label={`Đủ chỗ cho ${f.party_size} người`}>
            {fit.map((t) => <option key={t.id} value={t.id}>{t.label} · {t.seats} chỗ · {t.area}</option>)}
          </optgroup>
          {rest.length > 0 && (
            <optgroup label="Ít chỗ hơn">
              {rest.map((t) => <option key={t.id} value={t.id}>{t.label} · {t.seats} chỗ · {t.area}</option>)}
            </optgroup>
          )}
        </select>
        <textarea value={f.note} onChange={(e) => set('note', e.target.value)} placeholder="Ghi chú (sinh nhật, ghế em bé…)" rows={2} className={input} />
        <p className="text-xs text-stone-500">Bàn hiện “giữ chỗ” trên sơ đồ từ 60 phút trước giờ đến. Không đặt trùng bàn trong 2 tiếng.</p>
        <button
          disabled={act.isPending || !f.table_id || !f.customer_name.trim() || !f.phone.trim()}
          onClick={submit}
          className="w-full rounded-xl bg-brand-500 py-3 font-bold text-white disabled:opacity-50"
        >
          {initial ? 'Lưu' : 'Đặt bàn'}
        </button>
      </div>
    </Modal>
  )
}
