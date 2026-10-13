import { useState } from 'react'
import { useAuth, ROLE_LABEL } from './shared/auth'
import { useSocket } from './shared/socket'
import { notify, unlockAudio } from './shared/notify'
import ConnectionBadge from './shared/ConnectionBadge'
import type { RealtimeEventName } from './shared/types'
import { time } from './shared/format'

// Trang dev để kiểm tra realtime (B3). Không phải màn hình nghiệp vụ.
const DEMO = ['waiter@demo.vn', 'kitchen@demo.vn', 'manager@demo.vn', 'owner@demo.vn']
const EVENTS: RealtimeEventName[] = [
  'order.created', 'order.updated', 'order.confirmed', 'order_item.updated', 'table.call_staff',
  'staff_call.resolved', 'table.updated', 'menu_item.updated', 'session.closed',
]

type LogLine = { at: string; event: string; summary: string }

function summarize(payload: Record<string, unknown>) {
  const table = (payload.table as { label?: string } | undefined)?.label
  return [table, payload.code, payload.name, payload.status].filter(Boolean).join(' · ')
}

export default function DevRealtimePage() {
  const { user, socketToken, login, logout } = useAuth()
  const [log, setLog] = useState<LogLine[]>([])
  const [reconnects, setReconnects] = useState(0)
  const [error, setError] = useState('')

  const handlers = Object.fromEntries(
    EVENTS.map((e) => [
      e,
      (p: Record<string, unknown>) => {
        setLog((l) => [{ at: new Date().toISOString(), event: e, summary: summarize(p) }, ...l].slice(0, 50))
        notify(e === 'order.created' ? 'new' : e === 'table.call_staff' ? 'alert' : 'ready')
      },
    ]),
  )
  const status = useSocket(socketToken, { handlers, onReconnect: () => setReconnects((n) => n + 1) })

  if (!user) {
    return (
      <main className="mx-auto max-w-md p-6">
        <h1 className="text-xl font-bold">Dev · Realtime</h1>
        <p className="mt-1 text-sm text-stone-500">Đăng nhập tài khoản demo để nghe event</p>
        <div className="mt-4 grid gap-2">
          {DEMO.map((email) => (
            <button
              key={email}
              className="rounded-lg bg-white p-3 text-left ring-1 ring-stone-200 active:bg-stone-100"
              onClick={() => {
                unlockAudio()
                login(email, 'password').catch((e) => setError(e.message))
              }}
            >
              {email}
            </button>
          ))}
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-md p-6" onClick={unlockAudio}>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Dev · Realtime</h1>
        <ConnectionBadge status={status} />
      </div>
      <p className="mt-1 text-sm text-stone-500">
        {user.name} ({ROLE_LABEL[user.role]}) · reconnect: {reconnects} ·{' '}
        <button className="underline" onClick={logout}>Đăng xuất</button>
      </p>
      <p className="mt-2 text-xs text-stone-400">Chạm màn hình 1 lần để bật âm thanh.</p>
      <ul className="mt-4 space-y-2">
        {log.length === 0 && <li className="text-sm text-stone-400">Chưa có event…</li>}
        {log.map((l, i) => (
          <li key={i} className="rounded-lg bg-white p-3 text-sm ring-1 ring-stone-200">
            <div className="flex justify-between">
              <span className="font-mono font-semibold">{l.event}</span>
              <span className="text-stone-400">{time(l.at)}</span>
            </div>
            <div className="text-stone-600">{l.summary}</div>
          </li>
        ))}
      </ul>
    </main>
  )
}
