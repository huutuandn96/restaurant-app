import { useState } from 'react'
import { api } from '../../shared/api'
import { hasRole, useAuth } from '../../shared/auth'
import { saveDevice, type StaffDevice } from '../../shared/device'
import { toast } from '../../shared/toast'
import { Modal } from '../../shared/ui'

const input = 'w-full rounded-xl bg-white px-3 py-2.5 text-[16px] outline-none ring-1 ring-stone-200 focus:ring-2 focus:ring-brand-500 sm:text-sm'

// Cài đặt máy + tài khoản (SPEC §4.1): đổi PIN, ghi danh / bỏ ghi danh máy dùng chung
export default function StaffSettings({ device, onDevice, onClose }: { device: StaffDevice | null; onDevice: (d: StaffDevice | null) => void; onClose: () => void }) {
  const { user, token, via } = useAuth()
  const canRegister = hasRole(user, 'manager', 'owner') && via === 'password'
  const [tab, setTab] = useState<'pin' | 'device'>(canRegister ? 'device' : 'pin')

  return (
    <Modal title="Cài đặt" onClose={onClose}>
      {canRegister && (
        <div className="mb-3 flex rounded-xl bg-stone-100 p-1">
          {(['device', 'pin'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`flex-1 rounded-lg py-1.5 text-sm font-semibold ${tab === t ? 'bg-white shadow' : 'text-stone-500'}`}>
              {t === 'device' ? 'Máy dùng chung' : 'PIN của tôi'}
            </button>
          ))}
        </div>
      )}
      {tab === 'pin' ? <ChangePin token={token} onDone={onClose} /> : <DeviceSetup device={device} token={token} onDevice={onDevice} onDone={onClose} />}
    </Modal>
  )
}

function ChangePin({ token, onDone }: { token: string | null; onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const save = async () => {
    setBusy(true)
    try {
      await api('/auth/pin', { method: 'PUT', token, body: { pin, password } })
      toast('Đã đặt PIN mới')
      onDone()
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-stone-500">PIN 4–6 số để đăng nhập nhanh trên máy dùng chung của quán. Không dùng mã dễ đoán như 1234, 0000.</p>
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mật khẩu hiện tại" autoComplete="current-password" className={input} />
      <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="PIN mới" inputMode="numeric" autoComplete="off" className={`${input} tracking-[0.4em]`} />
      <button disabled={busy || pin.length < 4 || !password} onClick={save} className="w-full rounded-xl bg-brand-500 py-3 font-bold text-white disabled:opacity-50">Lưu PIN</button>
    </div>
  )
}

function DeviceSetup({ device, token, onDevice, onDone }: { device: StaffDevice | null; token: string | null; onDevice: (d: StaffDevice | null) => void; onDone: () => void }) {
  const [name, setName] = useState('')
  const [lock, setLock] = useState('')
  const [busy, setBusy] = useState(false)

  if (device) {
    return (
      <div className="space-y-3 text-sm">
        <p>
          Máy này đã ghi danh là <b>{device.name}</b>
          {device.lock_minutes ? `, tự khoá sau ${device.lock_minutes} phút không thao tác` : ''}. Nhân viên đăng nhập bằng PIN.
        </p>
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              await api(`/staff/devices/${device.id}`, { method: 'DELETE', token })
            } catch {
              /* đã thu hồi ở nơi khác — vẫn xoá trên máy */
            }
            saveDevice(null)
            onDevice(null)
            toast('Đã bỏ ghi danh máy này')
            onDone()
          }}
          className="w-full rounded-xl bg-red-50 py-3 font-bold text-red-600 ring-1 ring-red-200"
        >
          Bỏ ghi danh máy này
        </button>
      </div>
    )
  }

  const register = async () => {
    setBusy(true)
    try {
      const d = await api<{ id: number; name: string; lock_minutes: number | null; device_token: string }>('/staff/devices', {
        method: 'POST',
        token,
        body: { name: name.trim(), lock_minutes: lock ? Number(lock) : null },
      })
      const saved = { id: d.id, name: d.name, lock_minutes: d.lock_minutes, token: d.device_token }
      saveDevice(saved)
      onDevice(saved)
      toast(`Đã ghi danh “${d.name}” — từ giờ nhân viên đăng nhập bằng PIN`)
      onDone()
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3 text-sm">
      <p className="text-stone-500">
        Ghi danh máy dùng chung (iPad bếp, điện thoại quầy) để nhân viên đăng nhập bằng PIN. Máy chưa ghi danh vẫn phải dùng email và mật khẩu.
      </p>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên máy (VD: iPad bếp)" className={input} />
      <select value={lock} onChange={(e) => setLock(e.target.value)} className={input}>
        <option value="">Không tự khoá</option>
        {[5, 15, 30, 60].map((m) => <option key={m} value={m}>Tự khoá sau {m} phút không thao tác</option>)}
      </select>
      <button disabled={busy || !name.trim()} onClick={register} className="w-full rounded-xl bg-brand-500 py-3 font-bold text-white disabled:opacity-50">Ghi danh máy này</button>
    </div>
  )
}
