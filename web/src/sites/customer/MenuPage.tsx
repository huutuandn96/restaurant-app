import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '../../shared/api'
import { money, normalize } from '../../shared/format'
import type { Category, MenuItem } from '../../shared/types'
import type { SocketStatus } from '../../shared/socket'
import { useGuest } from './session'
import { cartCount, cartTotal, useCart } from './cart'
import CartSheet from './CartSheet'
import { FoodImage, QtyControl, Spinner } from '../../shared/ui'
import { toast } from '../../shared/toast'

export type MenuData = { categories: Category[] }

export default function MenuPage({ socketStatus }: { socketStatus: SocketStatus }) {
  const { session, qrToken } = useGuest()
  const menu = useQuery({ queryKey: ['public-menu'], queryFn: () => api<MenuData>('/public/menu'), staleTime: 60_000, refetchInterval: 5 * 60_000 }) // happy hour đổi giá theo giờ
  const lines = useCart((s) => s.lines)
  const syncMenu = useCart((s) => s.syncMenu)
  useEffect(() => {
    if (menu.data) syncMenu(menu.data.categories.flatMap((c) => c.items ?? []))
  }, [menu.data, syncMenu])
  const [search, setSearch] = useState('')
  const q = normalize(useDeferredValue(search))
  const [active, setActive] = useState<number | null>(null)
  const [cartOpen, setCartOpen] = useState(false)
  const sectionRefs = useRef<Record<number, HTMLElement | null>>({})
  const tabsRef = useRef<HTMLDivElement>(null)

  const categories = menu.data?.categories ?? []
  const activeId = active ?? categories[0]?.id ?? null
  const results = useMemo(() => {
    if (!q) return []
    return categories.flatMap((c) => c.items ?? []).filter((i) => normalize(`${i.name} ${i.description ?? ''}`).includes(q))
  }, [categories, q])

  // Scroll spy: tab category đang xem
  useEffect(() => {
    if (q || !categories.length) return
    const obs = new IntersectionObserver(
      (entries) => {
        const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (top) setActive(Number(top.target.getAttribute('data-cat')))
      },
      { rootMargin: '-120px 0px -60% 0px' },
    )
    Object.values(sectionRefs.current).forEach((el) => el && obs.observe(el))
    return () => obs.disconnect()
  }, [categories, q])

  useEffect(() => {
    tabsRef.current?.querySelector(`[data-tab="${active}"]`)?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [active])

  const jumpTo = (id: number) => {
    const el = sectionRefs.current[id]
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 112, behavior: 'smooth' })
  }

  const callStaff = useMutation({
    mutationFn: () => api('/public/staff_calls', { method: 'POST', sessionToken: session.session_token }),
    onSuccess: () => toast('Đã gọi nhân viên, vui lòng đợi trong giây lát'),
    onError: (e) => toast(e.message, 'error'),
  })

  const count = cartCount(lines)
  const activeOrders = session.orders.filter((o) => !['completed', 'cancelled'].includes(o.status)).length

  return (
    <div className="pb-28">
      {/* Header */}
      <header className="bg-gradient-to-br from-brand-500 to-brand-700 px-4 pb-5 pt-5 text-white">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm/5 opacity-90">Xin chào quý khách 👋</p>
            <h1 className="text-2xl font-extrabold tracking-tight">{session.table.label}</h1>
            <p className="text-sm opacity-90">{session.table.area}</p>
          </div>
          <div className="rounded-2xl bg-white/15 px-3 py-2 text-center ring-1 ring-white/30 backdrop-blur">
            <div className="text-[10px] font-semibold uppercase tracking-wider opacity-90">Mã xác nhận</div>
            <div className="font-mono text-2xl font-extrabold tracking-[0.2em]">{session.verify_code}</div>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Link
            to={`/t/${qrToken}/orders`}
            className="relative flex-1 rounded-xl bg-white/15 py-2.5 text-center text-sm font-semibold ring-1 ring-white/30 active:bg-white/25"
          >
            🧾 Đơn của bàn
            {activeOrders > 0 && (
              <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-white px-1 text-xs font-bold text-brand-600">
                {activeOrders}
              </span>
            )}
          </Link>
          <button
            onClick={() => callStaff.mutate()}
            disabled={callStaff.isPending}
            className="flex-1 rounded-xl bg-white py-2.5 text-sm font-semibold text-brand-700 active:scale-[0.98] disabled:opacity-60"
          >
            🔔 Gọi nhân viên
          </button>
        </div>
        {socketStatus === 'disconnected' && (
          <p className="mt-3 rounded-lg bg-black/20 px-3 py-1.5 text-xs">Mất kết nối, đang thử lại…</p>
        )}
      </header>

      {/* Search + tabs (sticky) */}
      <div className="sticky top-0 z-20 bg-white/95 pb-2 pt-3 shadow-[0_1px_0_rgb(0_0_0/0.05)] backdrop-blur">
        <div className="px-4">
          <div className="flex items-center gap-2 rounded-xl bg-stone-100 px-3 py-2.5">
            <span className="text-stone-400">🔍</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm món: pho, lau, bia…"
              className="w-full bg-transparent text-[16px] outline-none placeholder:text-stone-400"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-stone-400" aria-label="Xoá">✕</button>
            )}
          </div>
        </div>
        {!q && (
          <div ref={tabsRef} className="no-scrollbar mt-2 flex gap-2 overflow-x-auto px-4">
            {categories.map((c) => (
              <button
                key={c.id}
                data-tab={c.id}
                onClick={() => jumpTo(c.id)}
                className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                  activeId === c.id ? 'bg-brand-500 text-white' : 'bg-stone-100 text-stone-600'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {menu.isPending && (
        <div className="grid place-items-center py-16">
          <Spinner />
        </div>
      )}

      {q ? (
        <section className="px-4 pt-3">
          <p className="mb-2 text-sm text-stone-500">{results.length} kết quả cho “{search}”</p>
          {results.length === 0 && <p className="py-10 text-center text-stone-400">Không tìm thấy món phù hợp</p>}
          <ul className="divide-y divide-stone-100">
            {results.map((i) => (
              <ItemRow key={i.id} item={i} />
            ))}
          </ul>
        </section>
      ) : (
        categories.map((c) => (
          <section key={c.id} data-cat={c.id} ref={(el) => void (sectionRefs.current[c.id] = el)} className="px-4 pt-4">
            <h2 className="text-lg font-bold">{c.name}</h2>
            <ul className="divide-y divide-stone-100">
              {c.items?.map((i) => (
                <ItemRow key={i.id} item={i} />
              ))}
            </ul>
          </section>
        ))
      )}

      {/* Cart bar */}
      {count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            onClick={() => setCartOpen(true)}
            className="flex w-full items-center justify-between rounded-2xl bg-stone-900 px-4 py-3.5 text-white shadow-xl active:scale-[0.99]"
          >
            <span className="flex items-center gap-2">
              <span className="grid h-7 min-w-7 place-items-center rounded-full bg-brand-500 px-1.5 text-sm font-bold">{count}</span>
              <span className="font-semibold">Xem giỏ hàng</span>
            </span>
            <span className="font-bold">{money(cartTotal(lines))}</span>
          </button>
        </div>
      )}

      {cartOpen && <CartSheet onClose={() => setCartOpen(false)} />}
    </div>
  )
}

function ItemRow({ item }: { item: MenuItem }) {
  const qty = useCart((s) => s.lines[item.id]?.quantity ?? 0)
  const add = useCart((s) => s.add)
  const dec = useCart((s) => s.decrement)
  return (
    <li className={`flex gap-3 py-3 ${item.available ? '' : 'opacity-50'}`}>
      <FoodImage src={item.image_url} alt={item.name} className="h-24 w-24 shrink-0 rounded-xl" />
      <div className="flex min-w-0 flex-1 flex-col">
        <h3 className="font-semibold leading-tight">{item.name}</h3>
        {item.description && <p className="mt-0.5 line-clamp-2 text-sm text-stone-500">{item.description}</p>}
        <div className="mt-auto flex items-end justify-between pt-2">
          <span>
            {item.original_price ? (
              <>
                <span className="mr-1 rounded bg-red-500 px-1 py-0.5 text-[10px] font-bold text-white">{item.promotion}</span>
                <span className="block">
                  <span className="font-bold text-red-600">{money(item.price)}</span>
                  <span className="ml-1.5 text-xs text-stone-400 line-through">{money(item.original_price)}</span>
                </span>
              </>
            ) : (
              <span className="font-bold text-brand-600">{money(item.price)}</span>
            )}
          </span>
          {item.available ? (
            <QtyControl qty={qty} onInc={() => add(item)} onDec={() => dec(item.id)} />
          ) : (
            <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-500">Hết món</span>
          )}
        </div>
      </div>
    </li>
  )
}
