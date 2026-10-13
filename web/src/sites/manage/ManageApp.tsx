import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { hasRole, ROLE_LABEL, useAuth } from '../../shared/auth'
import { useSocket } from '../../shared/socket'
import { Toaster } from '../../shared/toast'
import PrintHost from '../../shared/PrintHost'
import ConnectionBadge from '../../shared/ConnectionBadge'
import LoginPage from '../../shared/LoginPage'
import DashboardPage from './DashboardPage'
import OrdersPage from './OrdersPage'
import MenuPage from './MenuPage'
import TablesPage from './TablesPage'
import ReportsPage from './ReportsPage'
import UsersPage from './UsersPage'
import PromotionsPage from './PromotionsPage'

export default function ManageApp() {
  const user = useAuth((s) => s.user)
  const via = useAuth((s) => s.via)
  // Phiên PIN (máy dùng chung) không vào Manage (SPEC §4.1)
  if (!hasRole(user, 'manager', 'owner') || via === 'pin') {
    return (
      <LoginPage
        title="Quản lý"
        subtitle="Dành cho quản lý & chủ nhà hàng"
        demo={['manager@demo.vn', 'owner@demo.vn']}
        allowed={['manager', 'owner']}
        notice={via === 'pin' ? 'Bạn đang đăng nhập bằng PIN. Trang quản lý cần email và mật khẩu.' : undefined}
      />
    )
  }
  return <Shell />
}

function Shell() {
  const { user, socketToken, logout } = useAuth()
  const qc = useQueryClient()
  const isOwner = user!.role === 'owner'

  // Mọi thay đổi đơn / bàn / menu → làm mới dữ liệu manage (dashboard realtime)
  const refresh = () => void qc.invalidateQueries({ queryKey: ['manage'] })
  const status = useSocket(socketToken, {
    onReconnect: refresh,
    handlers: {
      'order.created': refresh,
      'order.updated': refresh,
      'order.confirmed': refresh,
      'table.updated': refresh,
      'menu_item.updated': refresh,
    },
  })

  const nav = [
    { to: '/manage/dashboard', label: 'Tổng quan', icon: '📊' },
    { to: '/manage/orders', label: 'Đơn hàng', icon: '🧾' },
    { to: '/manage/menu', label: 'Thực đơn', icon: '🍜' },
    { to: '/manage/tables', label: 'Bàn & QR', icon: '🪑' },
    { to: '/manage/promotions', label: 'Khuyến mãi', icon: '🎟️' },
    ...(isOwner
      ? [
          { to: '/manage/reports', label: 'Doanh thu', icon: '💰' },
          { to: '/manage/users', label: 'Nhân viên', icon: '👥' },
        ]
      : []),
  ]

  return (
    <div className="min-h-full bg-stone-100 lg:flex">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-stone-200 bg-white p-4 lg:flex print:hidden">
        <div className="mb-6 text-xl font-extrabold">🍽️ Quản lý</div>
        <nav className="flex flex-col gap-1">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 font-semibold ${isActive ? 'bg-brand-50 text-brand-700' : 'text-stone-600 hover:bg-stone-50'}`}
            >
              <span>{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto space-y-2 border-t border-stone-100 pt-4 text-sm">
          <ConnectionBadge status={status} />
          <div className="font-semibold">{user!.name}</div>
          <div className="text-stone-500">{ROLE_LABEL[user!.role]}</div>
          <button onClick={logout} className="text-stone-500 underline">Đăng xuất</button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Top bar (mobile/tablet) */}
        <header className="sticky top-0 z-30 border-b border-stone-200 bg-white lg:hidden print:hidden">
          <div className="flex items-center justify-between px-4 py-2.5">
            <div className="font-extrabold">🍽️ Quản lý</div>
            <div className="flex items-center gap-3">
              <ConnectionBadge status={status} />
              <span className="text-xs text-stone-500">{ROLE_LABEL[user!.role]}</span>
              <button onClick={logout} className="text-xs text-stone-500 underline">Thoát</button>
            </div>
          </div>
          <nav className="no-scrollbar flex gap-1 overflow-x-auto px-3 pb-2">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) => `shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ${isActive ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600'}`}
              >
                {n.icon} {n.label}
              </NavLink>
            ))}
          </nav>
        </header>

        <main className="mx-auto max-w-6xl p-4 lg:p-6">
          <Routes>
            <Route index element={<Navigate to="/manage/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="menu" element={<MenuPage />} />
            <Route path="tables" element={<TablesPage />} />
            <Route path="promotions" element={<PromotionsPage />} />
            {isOwner && <Route path="reports" element={<ReportsPage />} />}
            {isOwner && <Route path="users" element={<UsersPage />} />}
            <Route path="*" element={<Navigate to="/manage/dashboard" replace />} />
          </Routes>
        </main>
      </div>
      <Toaster />
      <PrintHost />
    </div>
  )
}
