import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../shared/api'
import { useAuth } from '../../shared/auth'
import { money, normalize } from '../../shared/format'
import { toast } from '../../shared/toast'
import type { Category, MenuItem } from '../../shared/types'
import { Spinner } from '../../shared/ui'

// Bếp bật/tắt tình trạng món (SPEC §6: PATCH /staff/menu_items/:id)
export default function SoldOutPage() {
  const token = useAuth((s) => s.token)
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const menu = useQuery({ queryKey: ['public-menu'], queryFn: () => api<{ categories: Category[] }>('/public/menu') })
  const toggle = useMutation({
    mutationFn: (i: MenuItem) => api<MenuItem>(`/staff/menu_items/${i.id}`, { method: 'PATCH', token, body: { available: !i.available } }),
    onSuccess: (i) => {
      toast(i.available ? `${i.name}: đã có lại` : `${i.name}: đã báo hết`)
      void qc.invalidateQueries({ queryKey: ['public-menu'] })
    },
    onError: (e) => toast(e.message, 'error'),
  })

  const items = useMemo(() => (menu.data?.categories ?? []).flatMap((c) => c.items ?? []), [menu.data])
  const soldOut = items.filter((i) => !i.available)
  const search = normalize(q)
  const others = items.filter((i) => i.available && search && normalize(i.name).includes(search))

  if (menu.isPending) return <div className="grid place-items-center py-16"><Spinner /></div>

  return (
    <div className="p-4">
      <h1 className="text-lg font-bold">Món đang hết ({soldOut.length})</h1>
      <ul className="mt-3 space-y-2">
        {soldOut.length === 0 && <li className="text-sm text-stone-400">Không có món nào đang hết</li>}
        {soldOut.map((i) => (
          <Row key={i.id} item={i} onToggle={() => toggle.mutate(i)} busy={toggle.isPending} />
        ))}
      </ul>

      <h2 className="mt-6 text-lg font-bold">Báo hết món khác</h2>
      <input
        value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm món…"
        className="mt-2 w-full rounded-xl bg-white px-4 py-2.5 text-[16px] outline-none ring-1 ring-stone-200 focus:ring-brand-500"
      />
      <ul className="mt-3 space-y-2">
        {others.map((i) => <Row key={i.id} item={i} onToggle={() => toggle.mutate(i)} busy={toggle.isPending} />)}
      </ul>
    </div>
  )
}

function Row({ item, onToggle, busy }: { item: MenuItem; onToggle: () => void; busy: boolean }) {
  return (
    <li className="flex items-center justify-between rounded-xl bg-white px-4 py-3 ring-1 ring-stone-200">
      <div>
        <div className="font-semibold">{item.name}</div>
        <div className="text-xs text-stone-500">{money(item.price)}</div>
      </div>
      <button
        disabled={busy}
        onClick={onToggle}
        className={`rounded-lg px-3 py-1.5 text-sm font-bold ${item.available ? 'bg-red-50 text-red-600 ring-1 ring-red-200' : 'bg-green-600 text-white'}`}
      >
        {item.available ? 'Báo hết' : 'Có lại'}
      </button>
    </li>
  )
}
