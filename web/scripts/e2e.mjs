// E2E smoke test toàn bộ flow (SPEC §12 B7) — chạy: make e2e
// Đi qua đúng 1 cổng web (Vite proxy) như điện thoại thật: REST + Socket.IO + ảnh S3.
import { io } from 'socket.io-client'

const BASE = process.env.BASE || 'http://localhost:5173'
const API = `${BASE}/api/v1`
const TABLE_NUMBER = Number(process.env.TABLE || 10)

let failed = 0
const ok = (cond, label) => {
  console.log(`${cond ? '  ✓' : '  ✗'} ${label}`)
  if (!cond) failed++
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function call(method, path, { body, token, session } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  if (session) headers['X-Session-Token'] = session
  const res = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined })
  const text = await res.text()
  let data = text
  try { data = text ? JSON.parse(text) : null } catch { /* csv */ }
  return { status: res.status, data, headers: res.headers }
}
const login = async (email) => (await call('POST', '/auth/login', { body: { email, password: 'password' } })).data

function listen(name, token) {
  const events = []
  const socket = io(BASE, { auth: { token }, transports: ['websocket'], reconnection: false })
  socket.onAny((event, payload) => events.push({ event, payload }))
  return new Promise((resolve, reject) => {
    socket.on('connect', () => resolve({ name, socket, events, has: (e) => events.some((x) => x.event === e) }))
    socket.on('connect_error', (e) => reject(new Error(`${name}: ${e.message}`)))
  })
}

console.log(`E2E → ${BASE} (bàn ${TABLE_NUMBER})\n`)

console.log('0. Hạ tầng')
const health = await call('GET', '/health')
ok(health.data?.db && health.data?.redis, 'API + PostgreSQL + Redis')

const [waiter, kitchen, manager, owner] = await Promise.all(
  ['waiter@demo.vn', 'kitchen@demo.vn', 'manager@demo.vn', 'owner@demo.vn'].map(login),
)
ok(waiter?.token && kitchen?.token && manager?.token && owner?.token, 'Đăng nhập 4 role')

const tables = (await call('GET', '/manage/tables', { token: manager.token })).data
const table = tables.find((t) => t.number === TABLE_NUMBER)
ok(table?.qr_url?.includes(`/t/${table.qr_token}`), `QR bàn ${TABLE_NUMBER}: ${table?.qr_url}`)
// Bàn đang có khách từ lần chạy trước → đóng để bắt đầu sạch
if (table.session) await call('POST', `/staff/tables/${table.id}/checkout`, { token: waiter.token })

const menu = (await call('GET', '/public/menu')).data
const items = menu.categories.flatMap((c) => c.items).filter((i) => i.available)
const img = await fetch(BASE + items[0].image_url)
ok(img.status === 200 && img.headers.get('content-type')?.startsWith('image/'), `Ảnh món từ S3 (${img.headers.get('content-type')})`)

const dashBefore = (await call('GET', '/manage/dashboard', { token: manager.token })).data

console.log('\n1. Khách quét QR')
const s = (await call('POST', `/public/tables/${table.qr_token}/session`)).data
ok(/^\d{3}$/.test(s.verify_code) && s.table.number === TABLE_NUMBER, `Mở phiên ${s.table.label}, mã ${s.verify_code}`)
const again = (await call('POST', `/public/tables/${table.qr_token}/session`, { session: s.session_token })).data
ok(again.session_token === s.session_token, 'Quét lại → cùng phiên')
ok((await call('POST', '/public/tables/khong-ton-tai/session')).status === 404, 'QR sai → 404')

const [g, w, k, m] = await Promise.all([
  listen('guest', s.socket_token), listen('waiter', waiter.socket_token),
  listen('kitchen', kitchen.socket_token), listen('manager', manager.socket_token),
])

console.log('\n2. Khách đặt món')
const lines = [
  { menu_item_id: items[1].id, quantity: 2, note: 'ít cay' },
  { menu_item_id: items[2].id, quantity: 1 },
]
const created = await call('POST', '/public/orders', { session: s.session_token, body: { items: lines, note: 'E2E' } })
const order = created.data
const expected = items[1].price * 2 + items[2].price
ok(created.status === 201 && order.status === 'pending', `Tạo đơn #${order.code} (pending)`)
ok(order.total === expected, `Tổng tiền ${order.total} = ${expected}`)
await sleep(400)
ok(w.has('order.created') && m.has('order.created'), 'Phục vụ + quản lý nhận order.created')
ok(!k.has('order.created'), 'Bếp CHƯA nhận (chưa xác nhận)')
ok(w.events.find((e) => e.event === 'order.created')?.payload.verify_code === s.verify_code, 'Staff thấy đúng mã xác nhận của bàn')

console.log('\n3. Phục vụ xác nhận tại bàn')
ok((await call('POST', `/staff/orders/${order.id}/confirm`, { token: kitchen.token })).status === 403, 'Bếp không được xác nhận (403)')
const confirmed = (await call('POST', `/staff/orders/${order.id}/confirm`, { token: waiter.token })).data
ok(confirmed.status === 'confirmed', 'Xác nhận → confirmed')
await sleep(400)
ok(k.has('order.confirmed'), 'Bếp nhận order.confirmed')
ok(g.has('order.confirmed'), 'Khách nhận order.confirmed')

console.log('\n4. Bếp làm món')
const [i1, i2] = confirmed.items
await call('PATCH', `/staff/order_items/${i1.id}`, { token: kitchen.token, body: { status: 'done' } })
const afterOut = (await call('PATCH', `/staff/order_items/${i2.id}`, { token: kitchen.token, body: { status: 'out_of_stock' } })).data
ok(afterOut.status === 'ready', 'Món 1 xong + món 2 hết → đơn ready')
ok(afterOut.total === items[1].price * 2, 'Tổng tiền đã trừ món hết')
await sleep(400)
ok(g.events.filter((e) => e.event === 'order_item.updated').length >= 2, 'Khách nhận cập nhật từng món')
ok(w.events.some((e) => e.event === 'order_item.updated' && e.payload.status === 'out_of_stock'), 'Phục vụ nhận báo hết món')

console.log('\n5. Gọi nhân viên & thanh toán')
await call('POST', '/public/staff_calls', { session: s.session_token })
await sleep(300)
ok(w.has('table.call_staff'), 'Phục vụ nhận "gọi nhân viên"')
const board = (await call('GET', '/staff/tables', { token: waiter.token })).data.find((t) => t.id === table.id)
ok(board.ready_orders === 1 && board.open_calls === 1, 'Sơ đồ bàn: 1 đơn sẵn sàng, 1 lượt gọi')
const prov = (await call('GET', `/staff/table_sessions/${order.table_session_id}/bill`, { token: waiter.token })).data
ok(prov.provisional && prov.total === afterOut.total && prov.lines.length === 1, `Phiếu tạm tính ${prov.bill_no}: ${prov.total}`)
ok((await call('GET', `/staff/table_sessions/${order.table_session_id}/bill`, { token: kitchen.token })).status === 403, 'Bếp không in hoá đơn (403)')
const closedRes = (await call('POST', `/staff/tables/${table.id}/checkout`, { token: waiter.token })).data
const finalBill = (await call('GET', `/staff/table_sessions/${closedRes.closed_session_id}/bill`, { token: waiter.token })).data
ok(!finalBill.provisional && finalBill.cashier && finalBill.total === afterOut.total, `Hoá đơn sau thanh toán (thu ngân: ${finalBill.cashier})`)
await sleep(400)
ok(g.has('session.closed'), 'Khách nhận session.closed')
ok(k.events.some((e) => e.event === 'order.updated' && e.payload.status === 'completed'), 'Bếp nhận completed (gỡ khỏi board)')
ok((await call('GET', '/public/session', { session: s.session_token })).status === 410, 'Token cũ → 410')
const next = (await call('POST', `/public/tables/${table.qr_token}/session`, { session: s.session_token })).data
ok(next.session_token !== s.session_token, `Quét lại cùng QR → phiên mới, mã ${next.verify_code}`)

console.log('\n6. Quản lý')
const dashAfter = (await call('GET', '/manage/dashboard', { token: manager.token })).data
ok(dashAfter.revenue - dashBefore.revenue === afterOut.total, `Doanh thu hôm nay +${afterOut.total}`)
const detail = (await call('GET', `/manage/orders/${order.id}`, { token: manager.token })).data
ok(detail.events.map((e) => e.action).join(',') === 'create,confirm,item_done,item_out_of_stock,complete', `Lịch sử: ${detail.events.map((e) => e.action).join(' → ')}`)
ok((await call('GET', '/manage/reports/revenue', { token: manager.token })).status === 403, 'Manager không xem được báo cáo (403)')
// fetch().text() tự bỏ BOM → đọc byte thô để kiểm tra Excel mở đúng tiếng Việt
const csvRes = await fetch(`${API}/manage/reports/revenue?group=day&format=csv`, { headers: { Authorization: `Bearer ${owner.token}` } })
const csvBytes = new Uint8Array(await csvRes.arrayBuffer())
const hasBom = csvBytes[0] === 0xef && csvBytes[1] === 0xbb && csvBytes[2] === 0xbf
ok(csvRes.status === 200 && hasBom && new TextDecoder().decode(csvBytes).startsWith('Ngày'), 'Owner xuất CSV (UTF-8 BOM)')

// Dọn: đóng phiên vừa mở ở bước kiểm tra quét lại
await call('POST', `/staff/tables/${table.id}/checkout`, { token: waiter.token })
;[g, w, k, m].forEach((x) => x.socket.disconnect())

console.log(failed ? `\n✗ ${failed} kiểm tra thất bại` : '\n✓ Tất cả kiểm tra đều đạt')
process.exit(failed ? 1 : 0)
