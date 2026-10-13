const vnd = new Intl.NumberFormat('vi-VN')

export const money = (n: number) => `${vnd.format(n)}đ`

export const time = (iso: string) =>
  new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })

export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })

export function minutesAgo(iso: string, now = Date.now()) {
  const m = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000))
  if (m < 1) return 'vừa xong'
  if (m < 60) return `${m} phút trước`
  return `${Math.floor(m / 60)} giờ ${m % 60} phút trước`
}

// Bỏ dấu tiếng Việt để search (SPEC §5.1)
export const normalize = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim()

export const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  preparing: 'Đang làm',
  ready: 'Sẵn sàng',
  completed: 'Hoàn thành',
  cancelled: 'Đã huỷ',
}

export const ITEM_STATUS_LABEL: Record<string, string> = {
  pending: 'Chờ làm',
  cooking: 'Đang nấu',
  done: 'Xong',
  out_of_stock: 'Hết món',
}
