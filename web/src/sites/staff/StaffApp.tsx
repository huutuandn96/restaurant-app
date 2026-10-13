import { useCallback, useState } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { hasRole, ROLE_LABEL, useAuth } from '../../shared/auth'
import { useSocket } from '../../shared/socket'
import { notify, unlockAudio } from '../../shared/notify'
import { toast, Toaster } from '../../shared/toast'
import { getPref, printKitchenTicket } from '../../shared/print'
import PrintHost from '../../shared/PrintHost'
import ConnectionBadge from '../../shared/ConnectionBadge'
import LoginPage from '../../shared/LoginPage'
import type { Order, StaffCall } from '../../shared/types'
import { applyOrder, keys, useActiveOrders, useCalls } from './data'
import WaiterOrdersPage from './WaiterOrdersPage'
import TablesPage from './TablesPage'
import TableDetailPage from './TableDetailPage'
import KitchenPage from './KitchenPage'
import SoldOutPage from './SoldOutPage'
import ReservationsPage from './ReservationsPage'
import PinLogin from './PinLogin'
import StaffSettings from './StaffSettings'
import { loadDevice, type StaffDevice } from '../../shared/device'
import { useIdleLock } from '../../shared/useIdleLock'

export default function StaffApp() {
  const user = useAuth((s) => s.user)
  // Máy dùng chung đã ghi danh → màn PIN (SPEC §4.1)
  const [device, setDevice] = useState<StaffDevice | null>(loadDevice)
  const [usePassword, setUsePassword] = useState(false)
  const showPassword = useCallback(() => setUsePassword(true), [])
  const revoked = useCallback(() => setDevice(null), [])

  if (!user || !hasRole(user, 'waiter', 'kitchen', 'manager', 'owner')) {
    if (device && !usePassword) return <PinLogin device={device} onPassword={showPassword} onRevoked={revoked} />
    return (
      <LoginPage
        title="Staff"
        subtitle="Phục vụ & Bếp"
        demo={['waiter@demo.vn', 'waiter2@demo.vn', 'kitchen@demo.vn', 'manager@demo.vn']}
        allowed={['waiter', 'kitchen', 'manager', 'owner']}
        extra={device && <button type="button" onClick={() => setUsePassword(false)} className="mt-3 w-full text-sm text-stone-500 underline">← Quay lại đăng nhập PIN</button>}
      />
    )
  }
  return <StaffShell device={device} onDevice={(d) => { setDevice(d); setUsePassword(false) }} />
}

function StaffShell({ device, onDevice }: { device: StaffDevice | null; onDevice: (d: StaffDevice | null) => void }) {
  const { user, socketToken, logout } = useAuth()
  const [settings, setSettings] = useState(false)
  useIdleLock(device?.lock_minutes, logout)
  const qc = useQueryClient()
  const isWaiter = hasRole(user, 'waiter', 'manager', 'owner')
  const isKitchen = hasRole(user, 'kitchen', 'manager', 'owner')

  const orders = useActiveOrders()
  const calls = useCalls(isWaiter)

  const refetchAll = useCallback(() => void qc.invalidateQueries({ queryKey: ['staff'] }), [qc])
  const onOrder = (o: Order) => applyOrder(qc, o)

  const status = useSocket(socketToken, {
    onReconnect: refetchAll,
    handlers: {
      'order.created': (o) => {
        onOrder(o)
        if (isWaiter) {
          notify('new')
          toast(`🔔 ${o.table.label} vừa đặt ${o.items.reduce((n, i) => n + i.quantity, 0)} món`)
        }
      },
      'order.confirmed': (o) => {
        onOrder(o)
        if (isKitchen && !isWaiter) {
          notify('new')
          toast(`🍳 Đơn mới: ${o.table.label} (#${o.code})`)
        }
        // Thiết bị bếp bật "Tự in phiếu" → in ngay khi đơn được gửi xuống bếp
        if (isKitchen && getPref('auto-kitchen', false)) printKitchenTicket(o)
      },
      'reservation.updated': () => {
        void qc.invalidateQueries({ queryKey: ['staff', 'reservations'] })
        void qc.invalidateQueries({ queryKey: keys.tables })
      },
      'order.updated': (o) => {
        const prev = qc.getQueryData<Order[]>(keys.orders)?.find((x) => x.id === o.id)
        onOrder(o)
        if (isWaiter && o.status === 'ready' && prev && prev.status !== 'ready') {
          notify('ready')
          toast(`✅ ${o.table.label}: đơn #${o.code} sẵn sàng mang ra`)
        }
      },
      'order_item.updated': (i) => {
        if (isWaiter && i.status === 'out_of_stock') {
          const o = qc.getQueryData<Order[]>(keys.orders)?.find((x) => x.id === i.order_id)
          notify('alert')
          toast(`⚠️ Hết món: ${i.name}${o ? ` (${o.table.label})` : ''}`, 'error')
        }
      },
      'table.call_staff': (c: StaffCall) => {
        if (!isWaiter) return
        qc.setQueryData<StaffCall[]>(keys.calls, (old) => (old?.some((x) => x.id === c.id) ? old : [...(old ?? []), c]))
        void qc.invalidateQueries({ queryKey: keys.tables })
        notify('alert')
        toast(`🙋 ${c.table.label} gọi nhân viên`)
      },
      'staff_call.resolved': (c) => qc.setQueryData<StaffCall[]>(keys.calls, (old) => old?.filter((x) => x.id !== c.id)),
      'table.updated': () => void qc.invalidateQueries({ queryKey: keys.tables }),
      'menu_item.updated': () => void qc.invalidateQueries({ queryKey: ['public-menu'] }),
    },
  })

  const pendingCount = orders.data?.filter((o) => o.status === 'pending').length ?? 0
  const kitchenCount = orders.data?.filter((o) => ['confirmed', 'preparing'].includes(o.status)).length ?? 0
  const callCount = calls.data?.length ?? 0

  const nav = [
    isWaiter && { to: '/staff/orders', label: 'Đơn', icon: '🧾', badge: pendingCount },
    isWaiter && { to: '/staff/tables', label: 'Bàn', icon: '🪑', badge: callCount },
    isWaiter && { to: '/staff/reservations', label: 'Đặt bàn', icon: '📅', badge: 0 },
    isKitchen && { to: '/staff/kitchen', label: 'Bếp', icon: '🍳', badge: kitchenCount },
    isKitchen && { to: '/staff/sold-out', label: 'Món hết', icon: '🚫', badge: 0 },
  ].filter(Boolean) as { to: string; label: string; icon: string; badge: number }[]

  return (
    <div className="flex min-h-full flex-col bg-stone-100" onClick={unlockAudio}>
      <header className="sticky top-0 z-30 flex items-center justify-between bg-stone-900 px-4 py-2.5 text-white">
        <div>
          <div className="text-sm font-bold">{user!.name}</div>
          <div className="text-xs text-stone-400">{ROLE_LABEL[user!.role]}</div>
        </div>
        <div className="flex items-center gap-3">
          <ConnectionBadge status={status} />
          <button onClick={() => setSettings(true)} className="text-lg leading-none text-stone-400" aria-label="Cài đặt">⚙︎</button>
          <button onClick={logout} className="text-xs text-stone-400 underline">{device ? '🔒 Khoá' : 'Đăng xuất'}</button>
        </div>
      </header>

      <main className="flex-1 pb-20">
        <Routes>
          <Route index element={<Navigate to={isWaiter ? '/staff/orders' : '/staff/kitchen'} replace />} />
          {isWaiter && <Route path="orders" element={<WaiterOrdersPage />} />}
          {isWaiter && <Route path="tables" element={<TablesPage />} />}
          {isWaiter && <Route path="tables/:id" element={<TableDetailPage />} />}
          {isWaiter && <Route path="reservations" element={<ReservationsPage />} />}
          {isKitchen && <Route path="kitchen" element={<KitchenPage />} />}
          {isKitchen && <Route path="sold-out" element={<SoldOutPage />} />}
          <Route path="*" element={<Navigate to="/staff" replace />} />
        </Routes>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-stone-200 bg-white pb-[env(safe-area-inset-bottom)]">
        {nav.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive }) => `relative flex flex-1 flex-col items-center py-2 text-xs font-semibold ${isActive ? 'text-brand-600' : 'text-stone-500'}`}
          >
            <span className="text-xl">{n.icon}</span>
            {n.label}
            {n.badge > 0 && (
              <span className="absolute right-[calc(50%-1.75rem)] top-1 grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">
                {n.badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
      <Toaster />
      <PrintHost />
      {settings && <StaffSettings device={device} onDevice={onDevice} onClose={() => setSettings(false)} />}
    </div>
  )
}
