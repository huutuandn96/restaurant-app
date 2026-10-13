import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, ApiError } from '../../shared/api'
import { ROLE_LABEL, useAuth } from '../../shared/auth'
import { saveDevice, type StaffDevice } from '../../shared/device'
import { unlockAudio } from '../../shared/notify'
import type { Role } from '../../shared/types'
import { Spinner } from '../../shared/ui'

type PinUser = { id: number; name: string; role: Role }

// Màn đăng nhập PIN trên máy đã ghi danh (SPEC §4.1): chọn tên → nhập PIN
export default function PinLogin({ device, onPassword, onRevoked }: { device: StaffDevice; onPassword: () => void; onRevoked: () => void }) {
  const loginPin = useAuth((s) => s.loginPin)
  const users = useQuery({
    queryKey: ['pin-users', device.token],
    queryFn: () => api<{ users: PinUser[]; device: { lock_minutes: number | null } }>('/auth/pin/users', { deviceToken: device.token }),
    retry: false,
  })
  const [picked, setPicked] = useState<PinUser | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Máy đã bị thu hồi → quay về đăng nhập mật khẩu
  useEffect(() => {
    if (users.error instanceof ApiError && users.error.status === 401) {
      saveDevice(null)
      onRevoked()
    }
  }, [users.error, onRevoked])

  const submit = async (value = pin) => {
    if (!picked || value.length < 4) return
    unlockAudio()
    setBusy(true)
    setError('')
    try {
      await loginPin(picked.id, value, device.token)
    } catch (e) {
      setError((e as Error).message)
      setPin('')
    } finally {
      setBusy(false)
    }
  }

  const press = (d: string) => {
    if (busy) return
    const next = (pin + d).slice(0, 6)
    setPin(next)
    if (next.length === 6) void submit(next)
  }

  return (
    <div className="grid min-h-full place-items-center bg-gradient-to-br from-stone-900 to-stone-800 p-4 text-white">
      <div className="w-full max-w-md">
        <div className="mb-4 text-center">
          <div className="text-3xl">🍽️</div>
          <div className="text-sm text-stone-400">📟 {device.name}</div>
        </div>

        {!picked ? (
          <>
            <h1 className="mb-3 text-center text-xl font-bold">Ai đang dùng máy?</h1>
            {users.isPending ? (
              <div className="grid place-items-center py-10"><Spinner /></div>
            ) : users.data?.users.length ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {users.data.users.map((u) => (
                  <button key={u.id} onClick={() => { setPicked(u); setPin(''); setError('') }} className="rounded-2xl bg-white/10 p-4 text-center ring-1 ring-white/10 active:bg-white/20">
                    <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-brand-500 text-lg font-bold">{u.name.slice(0, 1)}</div>
                    <div className="mt-2 truncate font-semibold">{u.name}</div>
                    <div className="text-xs text-stone-400">{ROLE_LABEL[u.role]}</div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-center text-stone-400">Chưa có nhân viên nào đặt PIN. Chủ quán đặt PIN ở Manage → Nhân viên.</p>
            )}
          </>
        ) : (
          <div className="mx-auto max-w-xs">
            <button onClick={() => setPicked(null)} className="mb-3 text-sm text-stone-400">← Chọn người khác</button>
            <h1 className="text-center text-xl font-bold">{picked.name}</h1>
            <div className="my-5 flex justify-center gap-3" aria-label="PIN">
              {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
                <span key={i} className={`h-4 w-4 rounded-full ${i < pin.length ? 'bg-white' : 'bg-white/20'}`} />
              ))}
            </div>
            {error && <p className="mb-3 text-center text-sm font-medium text-red-400">{error}</p>}
            <div className="grid grid-cols-3 gap-3">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => <Key key={d} onClick={() => press(d)}>{d}</Key>)}
              <Key onClick={() => setPin(pin.slice(0, -1))} aria-label="Xoá">⌫</Key>
              <Key onClick={() => press('0')}>0</Key>
              <Key onClick={() => void submit()} disabled={pin.length < 4 || busy} className="bg-brand-500 text-base">OK</Key>
            </div>
          </div>
        )}

        <button onClick={onPassword} className="mt-6 block w-full text-center text-sm text-stone-400 underline">Đăng nhập bằng email & mật khẩu</button>
      </div>
    </div>
  )
}

function Key({ className = 'bg-white/10', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={`h-16 rounded-2xl text-2xl font-bold active:scale-95 disabled:opacity-40 ${className}`} />
}
