import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../shared/api'
import { money } from '../../shared/format'
import { toast } from '../../shared/toast'
import type { Category } from '../../shared/types'
import { EmptyState, Modal, Spinner } from '../../shared/ui'
import { btnGhost, btnPrimary, card, inputCls, useManageQuery, useToken } from './hooks'

type Promotion = {
  id?: number
  name: string
  percent: number
  category_ids: number[]
  menu_item_ids: number[]
  weekdays: number[]
  start_time: string
  end_time: string
  starts_on: string | null
  ends_on: string | null
  active: boolean
  running?: boolean
}

type Voucher = {
  id?: number
  code: string
  kind: 'percent' | 'amount'
  value: number
  max_discount: number | null
  min_spend: number
  starts_at: string | null
  ends_at: string | null
  usage_limit: number | null
  used_count?: number
  active: boolean
  note: string | null
  usable?: boolean
}

const DAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

function useSave<T extends { id?: number }>(resource: 'promotions' | 'vouchers', onDone: () => void) {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ body, remove }: { body: T; remove?: boolean }) =>
      remove
        ? api(`/manage/${resource}/${body.id}`, { method: 'DELETE', token })
        : api(body.id ? `/manage/${resource}/${body.id}` : `/manage/${resource}`, { method: body.id ? 'PATCH' : 'POST', token, body }),
    onSuccess: (_, v) => {
      toast(v.remove ? 'Đã xoá' : 'Đã lưu')
      void qc.invalidateQueries({ queryKey: ['manage', resource] })
      onDone()
    },
    onError: (e) => toast(e.message, 'error'),
  })
}

// Khuyến mãi (SPEC §5.6): happy hour theo khung giờ + mã voucher
export default function PromotionsPage() {
  const [tab, setTab] = useState<'happy' | 'voucher'>('happy')
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">Khuyến mãi</h1>
      <div className="flex w-fit rounded-xl bg-white p-1 ring-1 ring-stone-200">
        {(['happy', 'voucher'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-4 py-1.5 text-sm font-semibold ${tab === t ? 'bg-brand-500 text-white' : 'text-stone-600'}`}>
            {t === 'happy' ? 'Giảm theo khung giờ' : 'Mã voucher'}
          </button>
        ))}
      </div>
      {tab === 'happy' ? <HappyHours /> : <Vouchers />}
      <p className="text-xs text-stone-500">
        Giảm giá tay trên hoá đơn do phục vụ / quản lý nhập lúc thanh toán (phục vụ tối đa 10%). Doanh thu báo cáo đã trừ mọi khoản giảm.
      </p>
    </div>
  )
}

function HappyHours() {
  const { data, isPending } = useManageQuery<Promotion[]>(['promotions'], '/manage/promotions')
  const cats = useManageQuery<Category[]>(['categories'], '/manage/categories')
  const [edit, setEdit] = useState<Promotion | null>(null)
  const catName = (id: number) => cats.data?.find((c) => c.id === id)?.name ?? `#${id}`
  const itemName = (id: number) => cats.data?.flatMap((c) => c.items ?? []).find((i) => i.id === id)?.name ?? `#${id}`

  if (isPending) return <div className="grid place-items-center py-16"><Spinner /></div>
  return (
    <>
      <div className="flex justify-end">
        <button
          onClick={() => setEdit({ name: '', percent: 20, category_ids: [], menu_item_ids: [], weekdays: [], start_time: '16:00', end_time: '18:00', starts_on: null, ends_on: null, active: true })}
          className={btnPrimary}
        >
          + Thêm chương trình
        </button>
      </div>
      {!data?.length ? (
        <EmptyState icon="⏰" text="Chưa có chương trình giảm giá theo khung giờ" />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {data.map((p) => (
            <button key={p.id} onClick={() => setEdit(p)} className={`${card} text-left hover:ring-brand-300 ${p.active ? '' : 'opacity-60'}`}>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-extrabold text-red-600">−{p.percent}%</span>
                <span className="flex-1 font-bold">{p.name}</span>
                {p.running && <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700">Đang chạy</span>}
                {!p.active && <span className="rounded-full bg-stone-200 px-2 py-0.5 text-xs font-bold text-stone-600">Tắt</span>}
              </div>
              <div className="mt-1 text-sm text-stone-600">
                ⏰ {p.start_time}–{p.end_time} · {p.weekdays.length ? p.weekdays.map((d) => DAYS[d]).join(', ') : 'Mọi ngày'}
              </div>
              <div className="text-sm text-stone-500">
                {p.category_ids.length || p.menu_item_ids.length
                  ? [...p.category_ids.map(catName), ...p.menu_item_ids.map(itemName)].join(', ')
                  : 'Toàn bộ menu'}
              </div>
              {(p.starts_on || p.ends_on) && <div className="text-xs text-stone-400">Từ {p.starts_on ?? '…'} đến {p.ends_on ?? '…'}</div>}
            </button>
          ))}
        </div>
      )}
      {edit && <PromotionForm initial={edit} categories={cats.data ?? []} onClose={() => setEdit(null)} />}
    </>
  )
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ${on ? 'bg-brand-500 text-white ring-brand-500' : 'bg-white text-stone-600 ring-stone-200'}`}>
      {children}
    </button>
  )
}

const toggle = (list: number[], v: number) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

function PromotionForm({ initial, categories, onClose }: { initial: Promotion; categories: Category[]; onClose: () => void }) {
  const [f, setF] = useState(initial)
  const [pickItems, setPickItems] = useState(initial.menu_item_ids.length > 0)
  const save = useSave<Promotion>('promotions', onClose)
  const set = <K extends keyof Promotion>(k: K, v: Promotion[K]) => setF((s) => ({ ...s, [k]: v }))
  // Cập nhật dạng hàm để bấm nhanh nhiều chip không mất lựa chọn
  const flip = (k: 'weekdays' | 'category_ids' | 'menu_item_ids', v: number) => setF((s) => ({ ...s, [k]: toggle(s[k], v) }))
  return (
    <Modal title={f.id ? 'Sửa chương trình' : 'Giảm giá theo khung giờ'} onClose={onClose}>
      <div className="max-h-[70vh] space-y-3 overflow-y-auto p-0.5">
        <input value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Tên (VD: Happy hour bia)" className={inputCls} />
        <div className="flex items-center gap-2">
          <label className="text-sm font-semibold">Giảm</label>
          <input type="number" min={1} max={90} value={f.percent} onChange={(e) => set('percent', Number(e.target.value))} className={`${inputCls} w-24`} />
          <span className="text-sm">%</span>
        </div>
        <div className="flex items-center gap-2">
          <input type="time" value={f.start_time} onChange={(e) => set('start_time', e.target.value)} className={inputCls} />
          <span>→</span>
          <input type="time" value={f.end_time} onChange={(e) => set('end_time', e.target.value)} className={inputCls} />
        </div>
        <div>
          <div className="mb-1 text-sm font-semibold">Ngày trong tuần <span className="font-normal text-stone-400">(không chọn = mọi ngày)</span></div>
          <div className="flex flex-wrap gap-1.5">
            {DAYS.map((d, i) => <Chip key={d} on={f.weekdays.includes(i)} onClick={() => flip('weekdays', i)}>{d}</Chip>)}
          </div>
        </div>
        <div>
          <div className="mb-1 text-sm font-semibold">Áp dụng cho <span className="font-normal text-stone-400">(không chọn = toàn menu)</span></div>
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => <Chip key={c.id} on={f.category_ids.includes(c.id)} onClick={() => flip('category_ids', c.id)}>{c.name}</Chip>)}
          </div>
          <button type="button" onClick={() => setPickItems(!pickItems)} className="mt-2 text-sm text-brand-600 underline">
            {pickItems ? 'Ẩn danh sách món' : '+ Chọn món cụ thể'}
          </button>
          {pickItems && (
            <div className="mt-2 max-h-48 space-y-2 overflow-y-auto rounded-xl bg-stone-50 p-2">
              {categories.map((c) => (
                <div key={c.id} className="flex flex-wrap gap-1.5">
                  {c.items?.map((i) => <Chip key={i.id} on={f.menu_item_ids.includes(i.id)} onClick={() => flip('menu_item_ids', i.id)}>{i.name}</Chip>)}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <label>Từ ngày<input type="date" value={f.starts_on ?? ''} onChange={(e) => set('starts_on', e.target.value || null)} className={inputCls} /></label>
          <label>Đến ngày<input type="date" value={f.ends_on ?? ''} onChange={(e) => set('ends_on', e.target.value || null)} className={inputCls} /></label>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={f.active} onChange={(e) => set('active', e.target.checked)} className="h-4 w-4 accent-brand-500" /> Đang bật
        </label>
        <div className="flex gap-2">
          {f.id && <button onClick={() => confirm('Xoá chương trình?') && save.mutate({ body: f, remove: true })} className={`${btnGhost} text-red-600`}>Xoá</button>}
          <button disabled={save.isPending || !f.name.trim()} onClick={() => save.mutate({ body: f })} className={`${btnPrimary} flex-1`}>Lưu</button>
        </div>
      </div>
    </Modal>
  )
}

function Vouchers() {
  const { data, isPending } = useManageQuery<Voucher[]>(['vouchers'], '/manage/vouchers')
  const [edit, setEdit] = useState<Voucher | null>(null)
  if (isPending) return <div className="grid place-items-center py-16"><Spinner /></div>
  return (
    <>
      <div className="flex justify-end">
        <button
          onClick={() => setEdit({ code: '', kind: 'percent', value: 10, max_discount: null, min_spend: 0, starts_at: null, ends_at: null, usage_limit: null, active: true, note: null })}
          className={btnPrimary}
        >
          + Tạo mã
        </button>
      </div>
      {!data?.length ? (
        <EmptyState icon="🎟️" text="Chưa có mã voucher" />
      ) : (
        <div className={`${card} divide-y divide-stone-100 p-0`}>
          {data.map((v) => (
            <button key={v.id} onClick={() => setEdit(v)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-stone-50">
              <span className="rounded-lg bg-stone-900 px-2 py-1 font-mono text-sm font-bold text-white">{v.code}</span>
              <div className="min-w-0 flex-1 text-sm">
                <div className="font-semibold">
                  Giảm {v.kind === 'percent' ? `${v.value}%` : money(v.value)}
                  {v.max_discount ? ` (tối đa ${money(v.max_discount)})` : ''}
                  {v.min_spend ? ` · đơn từ ${money(v.min_spend)}` : ''}
                </div>
                <div className="text-stone-500">
                  Đã dùng {v.used_count}{v.usage_limit ? `/${v.usage_limit}` : ''}
                  {v.ends_at && ` · HSD ${new Date(v.ends_at).toLocaleDateString('vi-VN')}`}
                  {v.note && ` · ${v.note}`}
                </div>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${v.usable ? 'bg-green-100 text-green-700' : 'bg-stone-200 text-stone-500'}`}>
                {v.usable ? 'Dùng được' : 'Không dùng được'}
              </span>
            </button>
          ))}
        </div>
      )}
      {edit && <VoucherForm initial={edit} onClose={() => setEdit(null)} />}
    </>
  )
}

function VoucherForm({ initial, onClose }: { initial: Voucher; onClose: () => void }) {
  const [f, setF] = useState(initial)
  const save = useSave<Voucher>('vouchers', onClose)
  const set = <K extends keyof Voucher>(k: K, v: Voucher[K]) => setF((s) => ({ ...s, [k]: v }))
  const num = (v: string) => (v === '' ? null : Number(v))
  return (
    <Modal title={f.id ? `Mã ${f.code}` : 'Tạo mã voucher'} onClose={onClose}>
      <div className="max-h-[70vh] space-y-3 overflow-y-auto p-0.5 text-sm">
        <input value={f.code} onChange={(e) => set('code', e.target.value.toUpperCase())} placeholder="Mã (VD: KM10)" className={`${inputCls} font-mono uppercase`} />
        <div className="flex gap-2">
          <select value={f.kind} onChange={(e) => set('kind', e.target.value as Voucher['kind'])} className={inputCls}>
            <option value="percent">Giảm %</option>
            <option value="amount">Giảm số tiền</option>
          </select>
          <input type="number" value={f.value} onChange={(e) => set('value', Number(e.target.value))} className={inputCls} aria-label="Mức giảm" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label>Giảm tối đa (đ)<input type="number" value={f.max_discount ?? ''} onChange={(e) => set('max_discount', num(e.target.value))} placeholder="Không giới hạn" className={inputCls} /></label>
          <label>Đơn tối thiểu (đ)<input type="number" value={f.min_spend} onChange={(e) => set('min_spend', Number(e.target.value))} className={inputCls} /></label>
          <label>Số lượt dùng<input type="number" value={f.usage_limit ?? ''} onChange={(e) => set('usage_limit', num(e.target.value))} placeholder="Không giới hạn" className={inputCls} /></label>
          <label>Hết hạn<input type="date" value={f.ends_at?.slice(0, 10) ?? ''} onChange={(e) => set('ends_at', e.target.value ? new Date(`${e.target.value}T23:59:59`).toISOString() : null)} className={inputCls} /></label>
        </div>
        <input value={f.note ?? ''} onChange={(e) => set('note', e.target.value)} placeholder="Ghi chú (VD: khai trương)" className={inputCls} />
        <label className="flex items-center gap-2 font-semibold">
          <input type="checkbox" checked={f.active} onChange={(e) => set('active', e.target.checked)} className="h-4 w-4 accent-brand-500" /> Đang bật
        </label>
        <div className="flex gap-2">
          {f.id && <button onClick={() => confirm('Xoá mã?') && save.mutate({ body: f, remove: true })} className={`${btnGhost} text-red-600`}>Xoá</button>}
          <button disabled={save.isPending || !f.code.trim()} onClick={() => save.mutate({ body: f })} className={`${btnPrimary} flex-1`}>Lưu</button>
        </div>
      </div>
    </Modal>
  )
}
