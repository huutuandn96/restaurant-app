import type React from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, upload } from '../../shared/api'
import { money } from '../../shared/format'
import { toast } from '../../shared/toast'
import type { Category, MenuItem } from '../../shared/types'
import { FoodImage, Modal, Spinner } from '../../shared/ui'
import { btnGhost, btnPrimary, card, inputBase, inputCls, useManageQuery, useToken } from './hooks'

function useMenuMutation<V, R = unknown>(fn: (v: V, token: string) => Promise<R>, ok?: string) {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: V) => fn(v, token),
    onSuccess: () => {
      if (ok) toast(ok)
      void qc.invalidateQueries({ queryKey: ['manage', 'categories'] })
      void qc.invalidateQueries({ queryKey: ['public-menu'] })
    },
    onError: (e) => toast(e.message, 'error'),
  })
}

export default function MenuPage() {
  const { data, isPending } = useManageQuery<Category[]>(['categories'], '/manage/categories')
  const [editItem, setEditItem] = useState<Partial<MenuItem> | null>(null)
  const [editCat, setEditCat] = useState<Partial<Category> | null>(null)
  const [adjustCat, setAdjustCat] = useState<Category | null>(null)
  const toggleItem = useMenuMutation<MenuItem>((i, token) => api(`/manage/menu_items/${i.id}`, { method: 'PATCH', token, body: { available: !i.available } }))

  if (isPending) return <div className="grid place-items-center py-20"><Spinner /></div>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold">Thực đơn</h1>
        <div className="flex gap-2">
          <button onClick={() => setEditCat({ position: data?.length ?? 0, active: true })} className={btnGhost}>+ Danh mục</button>
          <button onClick={() => setEditItem({ category_id: data?.[0]?.id, available: true })} className={btnPrimary}>+ Món mới</button>
        </div>
      </div>

      {data?.map((c) => (
        <section key={c.id} className={`${card} p-0`}>
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold">{c.name}</h2>
              <span className="text-sm text-stone-400">{c.items?.length ?? 0} món</span>
              {!c.active && <span className="rounded-full bg-stone-200 px-2 py-0.5 text-xs font-semibold text-stone-600">Đang ẩn</span>}
            </div>
            <div className="flex gap-2 text-sm">
              <button onClick={() => setAdjustCat(c)} className="rounded-lg px-2 py-1 font-semibold text-brand-700 hover:bg-brand-50">Chỉnh giá</button>
              <button onClick={() => setEditCat(c)} className="rounded-lg px-2 py-1 font-semibold text-stone-600 hover:bg-stone-50">Sửa</button>
              <button onClick={() => setEditItem({ category_id: c.id, available: true })} className="rounded-lg px-2 py-1 font-semibold text-stone-600 hover:bg-stone-50">+ Món</button>
            </div>
          </header>
          <ul className="divide-y divide-stone-100">
            {c.items?.map((i) => (
              <li key={i.id} className={`flex items-center gap-3 px-4 py-2.5 ${i.available ? '' : 'opacity-60'}`}>
                <FoodImage src={i.image_url} alt={i.name} className="h-12 w-12 shrink-0 rounded-lg" />
                <button onClick={() => setEditItem(i)} className="min-w-0 flex-1 text-left">
                  <div className="truncate font-semibold">{i.name}</div>
                  <div className="truncate text-xs text-stone-500">{i.description}</div>
                </button>
                <div className="w-24 text-right font-bold tabular-nums">{money(i.price)}</div>
                <button
                  onClick={() => toggleItem.mutate(i)}
                  className={`w-20 rounded-lg py-1 text-xs font-bold ${i.available ? 'bg-green-50 text-green-700 ring-1 ring-green-200' : 'bg-stone-100 text-stone-500'}`}
                  title={i.available ? 'Đang bán — bấm để báo hết' : 'Đang hết — bấm để bán lại'}
                >
                  {i.available ? 'Đang bán' : 'Hết'}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {editItem && <ItemForm item={editItem} categories={data ?? []} onClose={() => setEditItem(null)} />}
      {editCat && <CategoryForm category={editCat} onClose={() => setEditCat(null)} />}
      {adjustCat && <AdjustPrices category={adjustCat} onClose={() => setAdjustCat(null)} />}
    </div>
  )
}

function ItemForm({ item, categories, onClose }: { item: Partial<MenuItem>; categories: Category[]; onClose: () => void }) {
  const [f, setF] = useState({
    name: item.name ?? '', description: item.description ?? '', price: String(item.price ?? ''),
    category_id: String(item.category_id ?? ''), available: item.available ?? true,
  })
  const [file, setFile] = useState<File | null>(null)
  const [removeImage, setRemoveImage] = useState(false)
  const fileUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
  useEffect(() => () => { if (fileUrl) URL.revokeObjectURL(fileUrl) }, [fileUrl])
  const preview = fileUrl ?? (removeImage ? null : item.image_url ?? null)

  const save = useMenuMutation<void>(async (_, token) => {
    const form = new FormData()
    Object.entries(f).forEach(([k, v]) => form.append(k, String(v)))
    if (file) form.append('image', file)
    if (removeImage && !file) form.append('remove_image', 'true')
    return item.id ? upload(`/manage/menu_items/${item.id}`, form, token) : upload('/manage/menu_items', form, token, 'POST')
  }, item.id ? 'Đã lưu món' : 'Đã thêm món')

  const del = useMenuMutation<void>((_, token) => api(`/manage/menu_items/${item.id}`, { method: 'DELETE', token }), 'Đã xoá / ẩn món')

  const valid = f.name.trim() && f.category_id && f.price !== '' && Number(f.price) >= 0

  return (
    <Modal title={item.id ? 'Sửa món' : 'Món mới'} onClose={onClose}>
      <div className="max-h-[72vh] space-y-3 overflow-y-auto pb-1">
        <div className="flex items-center gap-3">
          <FoodImage src={preview} alt="" className="h-24 w-32 shrink-0 rounded-xl" />
          <div className="space-y-2 text-sm">
            <label className={`${btnGhost} inline-block cursor-pointer py-2`}>
              📷 Chọn ảnh
              <input type="file" accept="image/jpeg,image/png,image/webp,image/heic" className="hidden"
                onChange={(e) => { const x = e.target.files?.[0]; if (x) { if (x.size > 5 * 1024 * 1024) toast('Ảnh tối đa 5MB', 'error'); else { setFile(x); setRemoveImage(false) } } }} />
            </label>
            {(preview && (item.image_url || file)) && (
              <button type="button" onClick={() => { setFile(null); setRemoveImage(true) }} className="block text-red-600 underline">Xoá ảnh</button>
            )}
            <p className="text-xs text-stone-400">JPG/PNG/WEBP/HEIC, ≤ 5MB</p>
          </div>
        </div>
        <Field label="Tên món"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inputCls} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Giá (đ)"><input inputMode="numeric" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value.replace(/\D/g, '') })} className={inputCls} /></Field>
          <Field label="Danh mục">
            <select value={f.category_id} onChange={(e) => setF({ ...f, category_id: e.target.value })} className={inputCls}>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        </div>
        {f.price && <p className="-mt-2 text-xs text-stone-500">= {money(Number(f.price))}</p>}
        <Field label="Mô tả"><textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} className={inputCls} /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.available} onChange={(e) => setF({ ...f, available: e.target.checked })} className="h-4 w-4 accent-brand-500" /> Đang bán</label>
      </div>
      <div className="mt-4 flex gap-2">
        {item.id && (
          <button onClick={() => confirm('Xoá món này? (Món đã có trong đơn sẽ chỉ bị ẩn)') && del.mutate(undefined, { onSuccess: onClose })} className="rounded-xl px-3 font-semibold text-red-600">Xoá</button>
        )}
        <button onClick={onClose} className={`${btnGhost} ml-auto`}>Huỷ</button>
        <button disabled={!valid || save.isPending} onClick={() => save.mutate(undefined, { onSuccess: onClose })} className={btnPrimary}>
          {save.isPending ? 'Đang lưu…' : 'Lưu'}
        </button>
      </div>
    </Modal>
  )
}

function CategoryForm({ category, onClose }: { category: Partial<Category>; onClose: () => void }) {
  const [name, setName] = useState(category.name ?? '')
  const [position, setPosition] = useState(String(category.position ?? 0))
  const [active, setActive] = useState(category.active ?? true)
  const save = useMenuMutation<void>((_, token) => {
    const body = { name, position: Number(position), active }
    return category.id ? api(`/manage/categories/${category.id}`, { method: 'PATCH', token, body }) : api('/manage/categories', { method: 'POST', token, body })
  }, 'Đã lưu danh mục')
  const del = useMenuMutation<void>((_, token) => api(`/manage/categories/${category.id}`, { method: 'DELETE', token }), 'Đã xoá danh mục')
  return (
    <Modal title={category.id ? 'Sửa danh mục' : 'Danh mục mới'} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Tên"><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></Field>
        <Field label="Thứ tự hiển thị"><input inputMode="numeric" value={position} onChange={(e) => setPosition(e.target.value.replace(/\D/g, ''))} className={inputCls} /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 accent-brand-500" /> Hiển thị cho khách</label>
      </div>
      <div className="mt-4 flex gap-2">
        {category.id && <button onClick={() => del.mutate(undefined, { onSuccess: onClose })} className="rounded-xl px-3 font-semibold text-red-600">Xoá</button>}
        <button onClick={onClose} className={`${btnGhost} ml-auto`}>Huỷ</button>
        <button disabled={!name.trim() || save.isPending} onClick={() => save.mutate(undefined, { onSuccess: onClose })} className={btnPrimary}>Lưu</button>
      </div>
    </Modal>
  )
}

// Chỉnh giá hàng loạt theo danh mục (SPEC §5.3) — làm tròn 1.000đ phía server
function AdjustPrices({ category, onClose }: { category: Category; onClose: () => void }) {
  const [mode, setMode] = useState<'percent' | 'amount'>('percent')
  const [sign, setSign] = useState<1 | -1>(1)
  const [value, setValue] = useState('10')
  const v = Number(value || 0) * sign
  const preview = (p: number) => Math.max(0, Math.round((mode === 'percent' ? p * (1 + v / 100) : p + v) / 1000) * 1000)
  const save = useMenuMutation<void>((_, token) =>
    api(`/manage/categories/${category.id}/adjust_prices`, { method: 'POST', token, body: { mode, value: v } }), `Đã cập nhật giá ${category.name}`)

  return (
    <Modal title={`Chỉnh giá · ${category.name}`} onClose={onClose}>
      <div className="flex flex-wrap gap-2">
        <div className="flex overflow-hidden rounded-xl ring-1 ring-stone-200">
          {([1, -1] as const).map((s) => (
            <button key={s} onClick={() => setSign(s)} className={`px-4 py-2 font-bold ${sign === s ? 'bg-stone-900 text-white' : 'bg-white'}`}>{s > 0 ? 'Tăng' : 'Giảm'}</button>
          ))}
        </div>
        <input inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))} className={`${inputBase} w-28`} />
        <div className="flex overflow-hidden rounded-xl ring-1 ring-stone-200">
          {(['percent', 'amount'] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={`px-4 py-2 font-bold ${mode === m ? 'bg-stone-900 text-white' : 'bg-white'}`}>{m === 'percent' ? '%' : 'đ'}</button>
          ))}
        </div>
      </div>
      <ul className="mt-4 max-h-64 divide-y divide-stone-100 overflow-y-auto text-sm">
        {category.items?.map((i) => (
          <li key={i.id} className="flex justify-between py-1.5">
            <span className="truncate">{i.name}</span>
            <span className="tabular-nums"><span className="text-stone-400">{money(i.price)}</span> → <b>{money(preview(i.price))}</b></span>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className={btnGhost}>Huỷ</button>
        <button disabled={!value || save.isPending} onClick={() => save.mutate(undefined, { onSuccess: onClose })} className={btnPrimary}>Áp dụng</button>
      </div>
    </Modal>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs font-semibold text-stone-500">{label}</span>{children}</label>
}
