import { useEffect, useState } from 'react'
import { api } from '../../shared/api'
import { hasRole, useAuth } from '../../shared/auth'
import { saveDevice, type StaffDevice } from '../../shared/device'
import { toast } from '../../shared/toast'
import { Modal } from '../../shared/ui'
import { disablePush, enablePush, pushState, type PushState } from '../../shared/push'

const input = 'w-full rounded-xl bg-white px-3 py-2.5 text-[16px] outline-none ring-1 ring-stone-200 focus:ring-2 focus:ring-brand-500 sm:text-sm'

// Cài đặt máy + tài khoản (SPEC §4.1): đổi PIN, ghi danh / bỏ ghi danh máy dùng chung
export default function StaffSettings({ device, onDevice, onClose }: { device: StaffDevice | null; onDevice: (d: StaffDevice | null) => void; onClose: () => void }) {
  const { user, token, via } = useAuth()
  const canRegister = hasRole(user, 'manager', 'owner') && via === 'password'
  const [tab, setTab] = useState<'notify' | 'pin' | 'device'>('notify')
  const tabs = canRegister ? (['notify', 'device', 'pin'] as const) : (['notify', 'pin'] as const)
  const label = { notify: 'Thông báo', device: 'Máy dùng chung', pin: 'PIN của tôi' }

  return (
    <Modal title="Cài đặt" onClose={onClose}>
      <div className="mb-3 flex rounded-xl bg-stone-100 p-1">
        {tabs.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 rounded-lg py-1.5 text-sm font-semibold ${tab === t ? 'bg-white shadow' : 'text-stone-500'}`}>
            {label[t]}
          </button>
        ))}
      </div>
      {tab === 'notify' && <Notifications token={token} />}
      {tab === 'pin' && <ChangePin token={token} onDone={onClose} />}
      {tab === 'device' && <DeviceSetup device={device} token={token} onDevice={onDevice} onDone={onClose} />}
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

const STATE_TEXT: Record<PushState, string> = {
  on: '✅ Máy này đang nhận thông báo kể cả khi tắt màn hình.',
  off: 'Chưa bật. Bật để nhận báo đơn mới / khách gọi / món xong khi màn hình tắt hoặc app đóng.',
  denied: '⛔ Trình duyệt đang chặn thông báo. Mở cài đặt trang (biểu tượng ổ khoá cạnh địa chỉ) → cho phép Thông báo.',
  insecure: '🔒 Thông báo cần HTTPS (hoặc localhost). Đang truy cập qua http://IP nên chưa dùng được — xem README mục Production.',
  unsupported: 'Trình duyệt này chưa hỗ trợ. Trên iPhone/iPad: Chia sẻ → Thêm vào MH chính, rồi mở app từ icon.',
}

// Web Push (SPEC §1.1)
function Notifications({ token }: { token: string | null }) {
  const [state, setState] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    void pushState().then(setState)
  }, [])
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true)
    try {
      await fn()
      toast(ok)
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(false)
      setState(await pushState())
    }
  }
  if (!state) return null
  return (
    <div className="space-y-3 text-sm">
      <p className="rounded-xl bg-stone-50 p-3">{STATE_TEXT[state]}</p>
      {state === 'off' && (
        <button disabled={busy} onClick={() => run(() => enablePush(token), 'Đã bật thông báo')} className="w-full rounded-xl bg-brand-500 py-3 font-bold text-white disabled:opacity-50">
          🔔 Bật thông báo trên máy này
        </button>
      )}
      {state === 'on' && (
        <div className="flex gap-2">
          <button disabled={busy} onClick={() => run(() => disablePush(token), 'Đã tắt thông báo')} className="rounded-xl bg-stone-100 px-4 py-3 font-semibold">Tắt</button>
          <button disabled={busy} onClick={() => run(() => api('/staff/push/test', { method: 'POST', token }), 'Đã gửi thông báo thử')} className="flex-1 rounded-xl bg-stone-900 py-3 font-bold text-white disabled:opacity-50">
            Gửi thử
          </button>
        </div>
      )}
      <p className="text-xs text-stone-500">Mẹo: cài app lên màn hình chính (Chrome: menu → Cài đặt ứng dụng; iPhone: Chia sẻ → Thêm vào MH chính) để mở nhanh, toàn màn hình.</p>
    </div>
  )
}
