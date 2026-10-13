import { useEffect, useRef, useState } from 'react'
import { createPortal, flushSync } from 'react-dom'
import { money } from './format'
import { usePrintQueue } from './print'
import type { Bill, Order } from './types'

// Gắn 1 lần trong StaffApp / ManageApp
export default function PrintHost() {
  const job = usePrintQueue((s) => s.queue[0])
  const ref = useRef<HTMLDivElement>(null)
  // Chiều cao khổ giấy = chiều cao phiếu (giấy cuộn). "80mm auto" không hợp lệ trong @page nên phải đo.
  const [size, setSize] = useState<{ jobId: number; mm: number } | null>(null)

  useEffect(() => {
    if (!job) return
    let finished = false
    const finish = () => {
      if (finished) return
      finished = true
      document.body.classList.remove('printing-receipt')
      window.removeEventListener('afterprint', finish)
      usePrintQueue.setState((s) => ({ queue: s.queue.filter((j) => j.id !== job.id) }))
    }
    document.body.classList.add('printing-receipt')
    window.addEventListener('afterprint', finish)
    // chờ React vẽ phiếu xong, đo chiều cao rồi mới mở hộp thoại in
    const t = window.setTimeout(() => {
      const px = ref.current?.querySelector('.receipt')?.getBoundingClientRect().height ?? 0
      flushSync(() => setSize({ jobId: job.id, mm: Math.ceil((px * 25.4) / 96) + 4 }))
      window.print()
    }, 50)
    // Phòng khi trình duyệt không bắn afterprint: không để hàng đợi kẹt mãi
    const guard = window.setTimeout(finish, 60_000)
    return () => {
      window.clearTimeout(t)
      window.clearTimeout(guard)
      window.removeEventListener('afterprint', finish)
    }
  }, [job])

  if (!job) return null
  return createPortal(
    <div id="print-host" ref={ref}>
      <style>{`@page { size: 80mm ${size?.jobId === job.id ? size.mm : 200}mm; margin: 0 }`}</style>
      {job.kind === 'kitchen' ? <KitchenTicket order={job.order} printedAt={job.printedAt} /> : <BillReceipt bill={job.bill} printedAt={job.printedAt} />}
    </div>,
    document.body,
  )
}

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
const full = (iso: string) =>
  new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })

function KitchenTicket({ order, printedAt }: { order: Order; printedAt: string }) {
  const items = order.items.filter((i) => i.status !== 'out_of_stock')
  return (
    <div className="receipt">
      <div className="r-center r-xl">{order.table.label.toUpperCase()}</div>
      <div className="r-center">PHIẾU BẾP · #{order.code}</div>
      <div className="r-row r-small">
        <span>Đặt {hhmm(order.created_at)}</span>
        <span>{order.confirmed_at ? `Gửi bếp ${hhmm(order.confirmed_at)}` : ''}</span>
      </div>
      {order.confirmed_by && <div className="r-small">Phục vụ: {order.confirmed_by.name}</div>}
      <hr />
      {items.map((i) => (
        <div key={i.id} className="r-item">
          <div className="r-lg">
            <b>{i.quantity} ×</b> {i.name}
          </div>
          {i.note && <div className="r-note">→ {i.note}</div>}
        </div>
      ))}
      {order.note && (
        <>
          <hr />
          <div className="r-note">Ghi chú: {order.note}</div>
        </>
      )}
      <hr />
      <div className="r-center r-small">In lúc {hhmm(printedAt)}</div>
    </div>
  )
}

function BillReceipt({ bill, printedAt }: { bill: Bill; printedAt: string }) {
  const r = bill.restaurant
  return (
    <div className="receipt">
      <div className="r-center r-lg"><b>{r.name}</b></div>
      {r.address && <div className="r-center r-small">{r.address}</div>}
      {r.phone && <div className="r-center r-small">ĐT: {r.phone}</div>}
      <hr />
      <div className="r-center r-lg"><b>{bill.provisional ? 'PHIẾU TẠM TÍNH' : 'HOÁ ĐƠN THANH TOÁN'}</b></div>
      <div className="r-row r-small"><span>Số: {bill.bill_no}</span><span>{bill.table.label}</span></div>
      <div className="r-row r-small"><span>Vào: {full(bill.opened_at)}</span></div>
      {bill.closed_at && <div className="r-row r-small"><span>Ra: {full(bill.closed_at)}</span></div>}
      {bill.cashier && <div className="r-small">Thu ngân: {bill.cashier}</div>}
      <hr />
      <div className="r-row r-small r-head"><span>Món</span><span>Thành tiền</span></div>
      {bill.lines.map((l) => (
        <div key={`${l.name}-${l.price}`} className="r-item">
          <div>{l.name}</div>
          <div className="r-row r-small">
            <span>{l.quantity} × {money(l.price)}</span>
            <span>{money(l.amount)}</span>
          </div>
        </div>
      ))}
      <hr />
      <div className="r-row r-lg"><b>TỔNG CỘNG</b><b>{money(bill.total)}</b></div>
      <hr />
      {bill.provisional && <div className="r-center r-small">(Phiếu tạm tính, chưa thanh toán)</div>}
      <div className="r-center r-small">{r.footer}</div>
      <div className="r-center r-small">In lúc {full(printedAt)}</div>
    </div>
  )
}
