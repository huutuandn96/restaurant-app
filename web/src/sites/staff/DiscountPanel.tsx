import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../shared/api'
import { useAuth } from '../../shared/auth'
import { money } from '../../shared/format'
import { toast } from '../../shared/toast'
import type { Bill } from '../../shared/types'
import { Spinner } from '../../shared/ui'

const input = 'min-w-0 rounded-xl bg-white px-3 py-2 text-[16px] outline-none ring-1 ring-stone-200 focus:ring-2 focus:ring-brand-500 sm:text-sm'

type DiscountBody = { voucher_code: string; manual_kind: '' | 'percent' | 'amount'; manual_value: number; reason: string }

// Giảm giá khi thanh toán (SPEC §5.6): voucher + giảm tay, xem trước tổng tiền theo bill server tính
export default function DiscountPanel({ sessionId }: { sessionId: number }) {
  const token = useAuth((s) => s.token)
  const qc = useQueryClient()
  const key = ['staff', 'bill', sessionId]
  const bill = useQuery({ queryKey: key, queryFn: () => api<Bill>(`/staff/table_sessions/${sessionId}/bill`, { token }) })

  const [code, setCode] = useState('')
  const [manualOpen, setManualOpen] = useState(false)
  const [kind, setKind] = useState<'percent' | 'amount'>('percent')
  const [value, setValue] = useState('')
  const [reason, setReason] = useState('')

  const save = useMutation({
    mutationFn: (body: DiscountBody) => api<Bill>(`/staff/table_sessions/${sessionId}/discount`, { method: 'PUT', token, body }),
    onSuccess: (b) => {
      qc.setQueryData(key, b)
      setManualOpen(false)
    },
    onError: (e) => toast(e.message, 'error'),
  })

  if (!bill.data) return <div className="grid place-items-center py-6"><Spinner /></div>
  const b = bill.data
  const current: DiscountBody = {
    voucher_code: b.voucher_code ?? '',
    manual_kind: b.manual_discount?.kind ?? '',
    manual_value: b.manual_discount?.value ?? 0,
    reason: b.manual_discount?.reason ?? '',
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-stone-50 p-3 text-sm">
        <Row label="Tạm tính" value={money(b.subtotal)} />
        {b.discounts.map((d) => (
          <div key={d.kind}>
            <div className="flex items-center justify-between gap-2 text-green-700">
              <span>
                {d.label}
                {d.reason && <span className="text-stone-500"> · {d.reason}</span>}
              </span>
              <span className="flex items-center gap-2">
                −{money(d.amount)}
                <button
                  onClick={() => save.mutate(d.kind === 'voucher' ? { ...current, voucher_code: '' } : { ...current, manual_kind: '', manual_value: 0, reason: '' })}
                  className="text-xs text-stone-400 underline"
                >
                  Bỏ
                </button>
              </span>
            </div>
            {d.error && <div className="text-xs text-amber-700">⚠️ {d.error}</div>}
          </div>
        ))}
        <div className="mt-2 flex items-end justify-between border-t border-stone-200 pt-2">
          <span className="font-semibold">Khách cần trả</span>
          <span className="text-3xl font-extrabold">{money(b.total)}</span>
        </div>
      </div>

      {!b.voucher_code && (
        <div className="flex gap-2">
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Mã voucher" className={`${input} flex-1 uppercase`} />
          <button
            disabled={!code.trim() || save.isPending}
            onClick={() => save.mutate({ ...current, voucher_code: code.trim() }, { onSuccess: () => setCode('') })}
            className="rounded-xl bg-stone-900 px-4 font-semibold text-white disabled:opacity-40"
          >
            Áp dụng
          </button>
        </div>
      )}

      {!b.manual_discount && !manualOpen && (
        <button onClick={() => setManualOpen(true)} className="text-sm font-semibold text-brand-600 underline">+ Giảm giá thêm</button>
      )}
      {manualOpen && (
        <div className="space-y-2 rounded-xl p-3 ring-1 ring-stone-200">
          <div className="flex gap-2">
            <div className="flex shrink-0 rounded-xl bg-stone-100 p-1">
              {(['percent', 'amount'] as const).map((k) => (
                <button key={k} onClick={() => setKind(k)} className={`rounded-lg px-3 py-1 text-sm font-semibold ${kind === k ? 'bg-white shadow' : 'text-stone-500'}`}>
                  {k === 'percent' ? '%' : 'đ'}
                </button>
              ))}
            </div>
            <input value={value} onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder={kind === 'percent' ? 'VD 10' : 'VD 20000'} className={`${input} flex-1`} />
          </div>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Lý do (bắt buộc)" className={`${input} w-full`} />
          <p className="text-xs text-stone-500">Phục vụ giảm tối đa 10%; mức cao hơn cần tài khoản quản lý.</p>
          <div className="flex gap-2">
            <button onClick={() => setManualOpen(false)} className="rounded-xl bg-stone-100 px-4 py-2 text-sm font-semibold">Đóng</button>
            <button
              disabled={!value || !reason.trim() || save.isPending}
              onClick={() => save.mutate({ ...current, manual_kind: kind, manual_value: Number(value), reason: reason.trim() })}
              className="flex-1 rounded-xl bg-stone-900 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              Áp dụng giảm giá
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-stone-500">{label}</span>
      <span>{value}</span>
    </div>
  )
}
