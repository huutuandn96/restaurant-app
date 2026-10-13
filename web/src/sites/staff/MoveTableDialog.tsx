import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { money } from '../../shared/format'
import { Modal, Spinner } from '../../shared/ui'
import { useMoveTable, useTables, type StaffTable } from './data'

// Chuyển / gộp bàn (SPEC §2.5): bàn trống → chuyển sang; bàn có khách → gộp vào
export default function MoveTableDialog({ from, onClose }: { from: StaffTable | { id: number; label: string }; onClose: () => void }) {
  const { data, isPending } = useTables()
  const move = useMoveTable()
  const navigate = useNavigate()
  const [target, setTarget] = useState<StaffTable | null>(null)

  const others = (data ?? []).filter((t) => t.id !== from.id)
  const empty = others.filter((t) => !t.session)
  const busy = others.filter((t) => t.session)
  const mode = target?.session ? 'merge' : 'move'

  if (target) {
    return (
      <Modal title={mode === 'move' ? 'Chuyển bàn' : 'Gộp bàn'} onClose={onClose}>
        <div className="flex items-center justify-center gap-3 py-2 text-xl font-extrabold">
          <span className="rounded-xl bg-stone-100 px-3 py-2">{from.label}</span>
          <span className="text-stone-400">→</span>
          <span className="rounded-xl bg-brand-50 px-3 py-2 text-brand-700">{target.label}</span>
        </div>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-stone-600">
          {mode === 'move' ? (
            <>
              <li>Mọi đơn của {from.label} chuyển sang {target.label}; bếp thấy số bàn mới.</li>
              <li>Mã xác nhận giữ nguyên, điện thoại khách tự đổi sang {target.label}.</li>
              <li>{from.label} trở về trống.</li>
            </>
          ) : (
            <>
              <li>Đơn và lượt gọi nhân viên của {from.label} dồn vào {target.label}, tính chung một hoá đơn.</li>
              <li>Điện thoại khách {from.label} tự chuyển sang {target.label} (mã xác nhận {target.session?.verify_code}), vẫn gọi món tiếp được.</li>
              <li>{from.label} trở về trống.</li>
            </>
          )}
        </ul>
        <div className="mt-4 flex gap-2">
          <button onClick={() => setTarget(null)} className="rounded-xl bg-stone-100 px-4 py-3 font-semibold text-stone-600">Chọn lại</button>
          <button
            disabled={move.isPending}
            onClick={() =>
              move.mutate({ from: from.id, to: target.id, mode }, { onSuccess: () => { onClose(); navigate(`/staff/tables/${target.id}`) } })
            }
            className="flex-1 rounded-xl bg-brand-500 py-3 font-bold text-white disabled:opacity-60"
          >
            {mode === 'move' ? `Chuyển sang ${target.label}` : `Gộp vào ${target.label}`}
          </button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title={`Chuyển / gộp ${from.label}`} onClose={onClose}>
      {isPending ? (
        <div className="grid place-items-center py-8"><Spinner /></div>
      ) : (
        <div className="max-h-[65vh] space-y-4 overflow-y-auto">
          <Section title="Chuyển sang bàn trống" tables={empty} onPick={setTarget} />
          <Section title="Gộp vào bàn đang có khách" tables={busy} onPick={setTarget} />
        </div>
      )}
    </Modal>
  )
}

function Section({ title, tables, onPick }: { title: string; tables: StaffTable[]; onPick: (t: StaffTable) => void }) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-bold text-stone-600">{title}</h3>
      {tables.length === 0 ? (
        <p className="text-sm text-stone-400">Không có bàn nào</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {tables.map((t) => (
            <button
              key={t.id}
              onClick={() => onPick(t)}
              className={`rounded-xl px-2 py-2.5 text-center ring-1 active:scale-95 ${t.session ? 'bg-orange-50 ring-orange-200' : 'bg-white ring-stone-200'}`}
            >
              <div className="font-bold">{t.label}</div>
              <div className="text-[11px] text-stone-500">{t.session ? money(t.session_total) : `${t.seats} chỗ · ${t.area ?? ''}`}</div>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
