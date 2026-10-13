// Service worker cho Staff (SPEC §1.1): nhận Web Push + mở đúng màn khi bấm thông báo.
// Không cache API / dữ liệu đơn — dữ liệu luôn lấy mới. Chỉ có trang dự phòng khi mất mạng.
const OFFLINE = 'staff-offline-v1'
const OFFLINE_HTML = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Mất kết nối</title><body style="font-family:system-ui;background:#1c1917;color:#fff;display:grid;place-items:center;height:100vh;margin:0;text-align:center">
<div><div style="font-size:48px">📡</div><h2>Mất kết nối tới máy chủ</h2><p>Kiểm tra Wi-Fi rồi thử lại.</p>
<button onclick="location.reload()" style="padding:12px 24px;border:0;border-radius:12px;background:#f97316;color:#fff;font-size:16px">Thử lại</button></div>`

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(OFFLINE).then((c) => c.put('/__offline', new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }))))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

// Chỉ xử lý điều hướng trang: lỗi mạng → trang dự phòng
self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return
  event.respondWith(fetch(event.request).catch(() => caches.match('/__offline')))
})

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: event.data?.text() }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Nhà hàng', {
      body: data.body || '',
      tag: data.tag,
      renotify: !!data.tag,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      vibrate: [200, 100, 200],
      data: { url: data.url || '/staff' },
    }),
  )
})

// Bấm thông báo → mở / focus app và chuyển tới đúng màn (VD chi tiết bàn)
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || '/staff', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const client = list.find((c) => c.url.startsWith(self.location.origin + '/staff'))
      // navigate() chỉ chạy với tab do SW quản lý → lỗi thì mở cửa sổ mới
      if (client) return client.focus().then((c) => c.navigate(url)).catch(() => self.clients.openWindow(url))
      return self.clients.openWindow(url)
    }),
  )
})
