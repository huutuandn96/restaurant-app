import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../shared/api'
import { ROLE_LABEL, useAuth } from '../../shared/auth'
import { toast } from '../../shared/toast'
import type { Role, User } from '../../shared/types'
import { Modal, Spinner } from '../../shared/ui'
import { btnGhost, btnPrimary, card, inputCls, useManageQuery, useToken } from './hooks'

const ROLES: Role[] = ['waiter', 'kitchen', 'manager', 'owner']

// Nhân viên (chỉ owner)
export default function UsersPage() {
  const me = useAuth((s) => s.user)
  const { data, isPending } = useManageQuery<User[]>(['users'], '/manage/users')
  const [edit, setEdit] = useState<Partial<User> | null>(null)
  if (isPending) return <div className="grid place-items-center py-20"><Spinner /></div>
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Nhân viên</h1>
        <button onClick={() => setEdit({ role: 'waiter', active: true })} className={btnPrimary}>+ Thêm</button>
      </div>
      <div className={`${card} divide-y divide-stone-100 p-0`}>
        {data?.map((u) => (
          <button key={u.id} onClick={() => setEdit(u)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-stone-50">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-100 font-bold text-brand-700">{u.name.slice(0, 1)}</div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{u.name} {u.id === me?.id && <span className="text-xs text-stone-400">(bạn)</span>}</div>
              <div className="truncate text-sm text-stone-500">{u.email}</div>
            </div>
            <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-semibold text-stone-600">{ROLE_LABEL[u.role]}</span>
            {u.has_pin && <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-semibold text-violet-700">PIN</span>}
            {!u.active && <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-600">Đã khoá</span>}
          </button>
        ))}
      </div>
      <Devices />
      {edit && <UserForm user={edit} isMe={edit.id === me?.id} onClose={() => setEdit(null)} />}
    </div>
  )
}

function UserForm({ user, isMe, onClose }: { user: Partial<User>; isMe: boolean; onClose: () => void }) {
  const token = useToken()
  const qc = useQueryClient()
  const [f, setF] = useState({ name: user.name ?? '', email: user.email ?? '', role: user.role ?? 'waiter', active: user.active ?? true, password: '', pin: '', clearPin: false })
  const save = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = { name: f.name, email: f.email, password: f.password }
      if (f.pin) body.pin = f.pin
      if (f.clearPin) body.clear_pin = true
      if (!isMe) Object.assign(body, { role: f.role, active: f.active })
      return user.id ? api(`/manage/users/${user.id}`, { method: 'PATCH', token, body }) : api('/manage/users', { method: 'POST', token, body })
    },
    onSuccess: () => { toast('Đã lưu nhân viên'); void qc.invalidateQueries({ queryKey: ['manage', 'users'] }); onClose() },
    onError: (e) => toast(e.message, 'error'),
  })
  const valid = f.name.trim() && f.email.trim() && (user.id || f.password.length >= 6)
  return (
    <Modal title={user.id ? 'Sửa nhân viên' : 'Thêm nhân viên'} onClose={onClose}>
      <div className="space-y-3">
        <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Họ tên" className={inputCls} />
        <input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="Email đăng nhập" className={inputCls} />
        <input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} placeholder={user.id ? 'Mật khẩu mới (bỏ trống nếu giữ nguyên)' : 'Mật khẩu (≥ 6 ký tự)'} className={inputCls} />
        <div className="flex items-center gap-2">
          <input
            value={f.pin}
            onChange={(e) => setF({ ...f, pin: e.target.value.replace(/\D/g, '').slice(0, 6), clearPin: false })}
            placeholder={user.has_pin ? 'PIN mới (bỏ trống nếu giữ nguyên)' : 'PIN 4–6 số (tuỳ chọn)'}
            inputMode="numeric"
            autoComplete="off"
            className={`${inputCls} tracking-widest`}
          />
          {user.has_pin && (
            <label className="flex shrink-0 items-center gap-1 text-xs text-stone-500">
              <input type="checkbox" checked={f.clearPin} onChange={(e) => setF({ ...f, clearPin: e.target.checked, pin: '' })} /> Xoá PIN
            </label>
          )}
        </div>
        <div className="grid grid-cols-4 gap-1">
          {ROLES.map((r) => (
            <button key={r} disabled={isMe} onClick={() => setF({ ...f, role: r })} className={`rounded-lg py-2 text-sm font-semibold disabled:opacity-50 ${f.role === r ? 'bg-stone-900 text-white' : 'bg-stone-100'}`}>{ROLE_LABEL[r]}</button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={isMe} checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} className="h-4 w-4 accent-brand-500" /> Đang hoạt động</label>
        {isMe && <p className="text-xs text-stone-500">Không thể tự đổi quyền hoặc tự khoá tài khoản của mình.</p>}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className={btnGhost}>Huỷ</button>
        <button disabled={!valid || save.isPending} onClick={() => save.mutate()} className={btnPrimary}>Lưu</button>
      </div>
    </Modal>
  )
}

type Device = { id: number; name: string; lock_minutes: number | null; last_used_at: string | null; created_at: string; registered_by: string }

// Máy dùng chung đã ghi danh cho đăng nhập PIN (SPEC §4.1). Ghi danh ở Staff → ⚙︎ trên chính máy đó.
function Devices() {
  const token = useToken()
  const qc = useQueryClient()
  const { data } = useManageQuery<Device[]>(['devices'], '/staff/devices')
  const revoke = useMutation({
    mutationFn: (id: number) => api(`/staff/devices/${id}`, { method: 'DELETE', token }),
    onSuccess: () => { toast('Đã thu hồi máy'); void qc.invalidateQueries({ queryKey: ['manage', 'devices'] }) },
    onError: (e) => toast(e.message, 'error'),
  })
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-bold">Máy đăng nhập PIN</h2>
      <p className="text-sm text-stone-500">Ghi danh trên chính máy đó: đăng nhập Staff bằng tài khoản quản lý → ⚙︎ → Máy dùng chung. Thu hồi khi máy bị mất hoặc không dùng nữa.</p>
      <div className={`${card} divide-y divide-stone-100 p-0`}>
        {!data?.length && <p className="px-4 py-3 text-sm text-stone-400">Chưa có máy nào</p>}
        {data?.map((d) => (
          <div key={d.id} className="flex items-center gap-3 px-4 py-3">
            <span className="text-xl">📟</span>
            <div className="min-w-0 flex-1 text-sm">
              <div className="font-semibold">{d.name}</div>
              <div className="text-stone-500">
                Ghi danh bởi {d.registered_by}{d.lock_minutes ? ` · tự khoá ${d.lock_minutes}′` : ''}
                {d.last_used_at && ` · dùng lần cuối ${new Date(d.last_used_at).toLocaleString('vi-VN')}`}
              </div>
            </div>
            <button onClick={() => confirm(`Thu hồi “${d.name}”?`) && revoke.mutate(d.id)} className="text-sm font-semibold text-red-600">Thu hồi</button>
          </div>
        ))}
      </div>
    </section>
  )
}
