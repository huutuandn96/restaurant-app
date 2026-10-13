import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../shared/api'
import { toast } from '../../shared/toast'
import type { Table } from '../../shared/types'
import { Modal, Spinner } from '../../shared/ui'
import { btnGhost, btnPrimary, card, inputCls, useManageQuery, useToken } from './hooks'

// Bàn & QR (SPEC §2.4): QR tĩnh, in 1 lần; tạo lại QR khi bị lộ/hỏng
export default function TablesPage() {
  const { data, isPending } = useManageQuery<Table[]>(['tables'], '/manage/tables')
  const [edit, setEdit] = useState<Partial<Table> | null>(null)
  const [regen, setRegen] = useState<Table | null>(null)
  const token = useToken()
  const qc = useQueryClient()
  const regenerate = useMutation({
    mutationFn: (t: Table) => api<Table>(`/manage/tables/${t.id}/regenerate_qr`, { method: 'POST', token }),
    onSuccess: (t) => { toast(`Đã tạo QR mới cho ${t.label} — nhớ in lại`); void qc.invalidateQueries({ queryKey: ['manage', 'tables'] }) },
    onError: (e) => toast(e.message, 'error'),
  })

  if (isPending) return <div className="grid place-items-center py-20"><Spinner /></div>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <div>
          <h1 className="text-2xl font-extrabold">Bàn & mã QR</h1>
          <p className="text-sm text-stone-500">QR cố định trên bàn. Khách quét → mở trang gọi món của đúng bàn.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className={btnGhost}>🖨️ In tất cả QR</button>
          <button onClick={() => setEdit({ seats: 4, number: (Math.max(0, ...(data ?? []).map((t) => t.number)) + 1) })} className={btnPrimary}>+ Thêm bàn</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 print:grid-cols-3 print:gap-6">
        {data?.map((t) => (
          <article key={t.id} className={`${card} flex flex-col items-center text-center print:break-inside-avoid print:shadow-none print:ring-2 print:ring-black`}>
            <div className="text-2xl font-extrabold">{t.label}</div>
            <div className="text-xs text-stone-500">{t.area} · {t.seats} chỗ</div>
            <div className="my-3 rounded-xl bg-white p-2 ring-1 ring-stone-100">
              <QRCodeSVG value={t.qr_url!} size={148} level="M" marginSize={1} />
            </div>
            <div className="text-xs font-semibold print:text-sm">Quét để gọi món</div>
            <a href={t.qr_url} target="_blank" rel="noreferrer" className="mt-1 max-w-full truncate text-[10px] text-stone-400 underline print:hidden">{t.qr_url}</a>
            <div className="mt-2 flex items-center gap-1 print:hidden">
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${t.status === 'occupied' ? 'bg-brand-100 text-brand-700' : 'bg-stone-100 text-stone-500'}`}>
                {t.status === 'occupied' ? `Có khách · mã ${t.session?.verify_code}` : 'Trống'}
              </span>
            </div>
            <div className="mt-3 flex gap-1 text-xs font-semibold print:hidden">
              <button onClick={() => setEdit(t)} className="rounded-lg px-2 py-1 text-stone-600 hover:bg-stone-50">Sửa</button>
              <button onClick={() => setRegen(t)} className="rounded-lg px-2 py-1 text-amber-700 hover:bg-amber-50">Tạo lại QR</button>
            </div>
          </article>
        ))}
      </div>

      {edit && <TableForm table={edit} onClose={() => setEdit(null)} />}
      {regen && (
        <Modal title={`Tạo lại QR ${regen.label}?`} onClose={() => setRegen(null)}>
          <p className="text-sm text-stone-600">QR đang dán trên bàn sẽ <b>không dùng được nữa</b>. Chỉ làm khi QR bị lộ, bị chụp lại để phá hoặc bị hỏng. Sau đó cần in và dán QR mới.</p>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setRegen(null)} className={btnGhost}>Huỷ</button>
            <button onClick={() => regenerate.mutate(regen, { onSuccess: () => setRegen(null) })} className="rounded-xl bg-amber-500 px-4 py-2.5 font-bold text-white">Tạo QR mới</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function TableForm({ table, onClose }: { table: Partial<Table>; onClose: () => void }) {
  const token = useToken()
  const qc = useQueryClient()
  const [number, setNumber] = useState(String(table.number ?? ''))
  const [area, setArea] = useState(table.area ?? '')
  const [seats, setSeats] = useState(String(table.seats ?? 4))
  const done = (msg: string) => { toast(msg); void qc.invalidateQueries({ queryKey: ['manage', 'tables'] }); onClose() }
  const save = useMutation({
    mutationFn: () => {
      const body = { number: Number(number), area, seats: Number(seats) }
      return table.id ? api(`/manage/tables/${table.id}`, { method: 'PATCH', token, body }) : api('/manage/tables', { method: 'POST', token, body })
    },
    onSuccess: () => done('Đã lưu bàn'),
    onError: (e) => toast(e.message, 'error'),
  })
  const del = useMutation({
    mutationFn: () => api(`/manage/tables/${table.id}`, { method: 'DELETE', token }),
    onSuccess: () => done('Đã xoá bàn'),
    onError: (e) => toast(e.message, 'error'),
  })
  return (
    <Modal title={table.id ? `Sửa ${table.label}` : 'Thêm bàn'} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <label className="block"><span className="mb-1 block text-xs font-semibold text-stone-500">Số bàn</span>
          <input inputMode="numeric" value={number} onChange={(e) => setNumber(e.target.value.replace(/\D/g, ''))} className={inputCls} /></label>
        <label className="block"><span className="mb-1 block text-xs font-semibold text-stone-500">Số chỗ</span>
          <input inputMode="numeric" value={seats} onChange={(e) => setSeats(e.target.value.replace(/\D/g, ''))} className={inputCls} /></label>
        <label className="col-span-2 block"><span className="mb-1 block text-xs font-semibold text-stone-500">Khu vực</span>
          <input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Tầng 1, Sân vườn…" className={inputCls} /></label>
      </div>
      <div className="mt-4 flex gap-2">
        {table.id && <button onClick={() => del.mutate()} className="rounded-xl px-3 font-semibold text-red-600">Xoá</button>}
        <button onClick={onClose} className={`${btnGhost} ml-auto`}>Huỷ</button>
        <button disabled={!number || save.isPending} onClick={() => save.mutate()} className={btnPrimary}>Lưu</button>
      </div>
    </Modal>
  )
}
