import { useCallback, useEffect, useRef, useState } from 'react'
import { Route, Routes, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '../../shared/api'
import { useSocket } from '../../shared/socket'
import { notify, unlockAudio } from '../../shared/notify'
import type { MenuItem, Order } from '../../shared/types'
import { fetchSession, GuestContext, openSession, type GuestSession } from './session'
import { useCart } from './cart'
import type { MenuData } from './MenuPage'
import MenuPage from './MenuPage'
import OrdersPage from './OrdersPage'
import { Spinner } from '../../shared/ui'
import { Toaster, toast } from '../../shared/toast'

const isClosedError = (e: unknown) => e instanceof ApiError && (e.status === 410 || e.status === 401)

export default function CustomerApp() {
  const { qrToken = '' } = useParams()
  const qc = useQueryClient()
  const bindSession = useCart((s) => s.bindSession)
  const syncItem = useCart((s) => s.syncItem)
  const [closed, setClosed] = useState(false)

  // 1) Quét QR → mở/lấy session
  const opened = useQuery({
    queryKey: ['guest-open', qrToken],
    queryFn: () => openSession(qrToken),
    staleTime: Infinity,
    retry: false,
  })
  const token = opened.data?.session_token

  // 2) Sau đó chỉ đọc session (không tạo mới)
  const sessionQ = useQuery({
    queryKey: ['guest-session', token],
    queryFn: () => fetchSession(token!),
    enabled: !!token && !closed,
    initialData: opened.data,
    retry: (n, e) => !isClosedError(e) && n < 2,
  })

  // Gộp bàn đổi sang token của phiên đích → giữ nguyên giỏ hàng thay vì xoá như phiên mới
  const keepCart = useRef(false)
  useEffect(() => {
    if (!token) return
    if (keepCart.current) {
      keepCart.current = false
      useCart.setState({ sessionToken: token })
    } else bindSession(token)
  }, [token, bindSession])

  useEffect(() => {
    if (isClosedError(sessionQ.error)) setClosed(true)
  }, [sessionQ.error])

  const refetch = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ['guest-session', token] })
  }, [qc, token])

  const onOrder = (o: Order) => {
    qc.setQueryData<GuestSession>(['guest-session', token], (old) => {
      if (!old) return old
      const exists = old.orders.some((x) => x.id === o.id)
      const orders = exists ? old.orders.map((x) => (x.id === o.id ? o : x)) : [...old.orders, o]
      const total = orders.filter((x) => x.status !== 'cancelled').reduce((n, x) => n + x.total, 0)
      return { ...old, orders, total }
    })
  }

  const status = useSocket(closed ? null : opened.data?.socket_token, {
    onReconnect: refetch,
    handlers: {
      'order.created': onOrder,
      'order.updated': onOrder,
      'order.confirmed': (o) => {
        onOrder(o)
        toast(`Nhân viên đã xác nhận đơn #${o.code}, bếp đang chuẩn bị`)
        notify('ready')
      },
      'order_item.updated': (i) => {
        if (i.status === 'done') toast(`${i.name} đã xong, sắp mang ra`)
        if (i.status === 'out_of_stock') {
          toast(`Rất tiếc, ${i.name} đã hết`, 'error')
          notify('alert')
        }
      },
      'menu_item.updated': (item: MenuItem) => {
        syncItem(item)
        qc.setQueryData<MenuData>(['public-menu'], (old) =>
          old && {
            categories: old.categories.map((c) => ({
              ...c,
              items: c.items?.map((i) => (i.id === item.id ? item : i)),
            })),
          },
        )
      },
      'session.closed': () => setClosed(true),
      // Quản lý đổi happy hour → giá menu đổi (SPEC §5.6)
      'menu.refresh': () => void qc.invalidateQueries({ queryKey: ['public-menu'] }),
      // Chuyển bàn: cùng phiên, chỉ đổi số bàn (SPEC §2.5)
      'session.moved': (p) => {
        toast(`Bàn của bạn đã chuyển sang ${p.table.label}`)
        notify('ready')
        refetch()
      },
      // Gộp bàn: mở lại bằng token cũ → server trả phiên đích (token + mã mới)
      'session.merged': (p) => {
        toast(`Bàn đã được gộp vào ${p.table.label}, bạn vẫn gọi món bình thường`)
        notify('ready')
        keepCart.current = true
        void qc.invalidateQueries({ queryKey: ['guest-open', qrToken] })
      },
    },
  })

  if (opened.isPending) {
    return (
      <div className="grid h-full place-items-center">
        <Spinner />
      </div>
    )
  }

  if (opened.isError) {
    return (
      <Message
        icon="🔍"
        title="Không tìm thấy bàn"
        text="Mã QR không hợp lệ. Vui lòng quét lại mã QR trên bàn hoặc gọi nhân viên."
      />
    )
  }

  if (closed) {
    return (
      <Message
        icon="🙏"
        title="Cảm ơn quý khách!"
        text="Bàn đã thanh toán. Nếu muốn gọi thêm món, vui lòng quét lại mã QR trên bàn."
        action={{ label: 'Quét lại / Mở bàn mới', onClick: () => window.location.reload() }}
      />
    )
  }

  const session = sessionQ.data ?? opened.data
  return (
    <GuestContext.Provider value={{ qrToken, session, refetch, closed }}>
      <div className="mx-auto min-h-full max-w-md bg-white shadow-sm" onClick={unlockAudio}>
        <Routes>
          <Route index element={<MenuPage socketStatus={status} />} />
          <Route path="orders" element={<OrdersPage />} />
        </Routes>
      </div>
      <Toaster />
    </GuestContext.Provider>
  )
}

function Message({ icon, title, text, action }: { icon: string; title: string; text: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="mx-auto grid h-full max-w-md place-items-center p-8 text-center">
      <div>
        <div className="text-6xl">{icon}</div>
        <h1 className="mt-4 text-2xl font-bold">{title}</h1>
        <p className="mt-2 text-stone-500">{text}</p>
        {action && (
          <button onClick={action.onClick} className="mt-6 rounded-full bg-brand-500 px-6 py-3 font-semibold text-white active:scale-95">
            {action.label}
          </button>
        )}
      </div>
    </div>
  )
}
