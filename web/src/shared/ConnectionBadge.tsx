import type { SocketStatus } from './socket'

const STYLE: Record<SocketStatus, [string, string]> = {
  connected: ['bg-green-500', 'Realtime'],
  connecting: ['bg-amber-400 animate-pulse', 'Đang kết nối'],
  disconnected: ['bg-red-500 animate-pulse', 'Mất kết nối'],
  unauthorized: ['bg-red-500', 'Hết phiên'],
}

export default function ConnectionBadge({ status }: { status: SocketStatus }) {
  const [dot, label] = STYLE[status]
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-2 py-0.5 text-xs font-medium text-stone-600 ring-1 ring-stone-200">
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {label}
    </span>
  )
}
