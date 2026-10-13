# Restaurant App — Spec tổng thể

> **Nguồn sự thật duy nhất (single source of truth)** cho toàn bộ dự án.
> - Mọi code phải bám theo file này. Nếu code cần lệch spec → cập nhật spec trước.
> - Bổ sung tính năng mới: thêm vào đúng section tương ứng + ghi vào **Changelog** cuối file.
> - Đánh dấu trạng thái: `[ ]` chưa làm · `[~]` đang làm · `[x]` xong.

**Version:** 1.2 · **Ngày tạo:** 2026-10-13

---

## 0. Quyết định đã chốt

| # | Nội dung | Quyết định |
|---|---|---|
| D1 | Realtime | Socket.IO server riêng (Node) + Redis pub/sub. Rails chỉ publish, client chỉ nhận qua socket, mọi ghi đi qua REST |
| D2 | Order theo bàn | **1 bàn – nhiều order** (mỗi lần gọi thêm = 1 order mới). Thanh toán gộp theo **table session** |
| D3 | QR token | **QR tĩnh, in 1 lần dán cố định trên bàn**. Mỗi lượt khách (table session) sinh **`session_token` + `verify_code` mới**; đóng session khi thanh toán → token/mã cũ hết hiệu lực |
| D4 | FE | React + Vite + **TypeScript** |
| D5 | Vị trí | `/Users/macbook_320/personal/restaurant-app` |
| D6 | Môi trường | Local, chạy toàn bộ bằng Docker Compose; QR dùng `LAN_IP` trong `.env` |
| D7 | Tiền / giờ | VND (integer), timezone `Asia/Ho_Chi_Minh` |
| D8 | Một cổng truy cập | Client chỉ gọi `http://LAN_IP:5173`; Vite proxy `/api` → Rails, `/socket.io` → Socket server (không cần CORS/IP riêng cho API) |

---

## 1. Kiến trúc

```
docker-compose
├── db      PostgreSQL 16                     host :5433 (DB_PORT)
├── redis   Redis 7 (pub/sub, Sidekiq, cache) chỉ nội bộ
├── api     Rails 8.1 API-only                host :3001 (API_PORT)
├── worker  Sidekiq 8
├── socket  Node 22 + Socket.IO + ioredis     host :4000
└── web     React 19 + Vite (3 site)          host :5173  ← cổng duy nhất cho client
```

**Luồng realtime**
1. Client gọi REST → Rails xử lý nghiệp vụ, ghi DB.
2. Rails `PUBLISH restaurant:events {rooms: [...], event, payload}` lên Redis.
3. Socket server subscribe → `io.to(rooms).emit(event, payload)` (gộp room, không gửi trùng).

**Rooms**
| Room | Thành viên |
|---|---|
| `table_session:{id}` | Khách đang ngồi bàn đó |
| `waiters` | Role waiter (+ manager, owner) |
| `kitchen` | Role kitchen |
| `managers` | Role manager, owner |

**Auth socket:** client gửi `auth.token` là JWT do Rails ký bằng `SOCKET_JWT_SECRET`.
- Staff: `{kind: "staff", role, user_id}` → join room theo role.
- Khách: `{kind: "guest", table_session_id}` → join `table_session:{id}`.

**Events**
| Event | Gửi tới | Khi nào |
|---|---|---|
| `order.created` | waiters, managers, table_session | Khách đặt món |
| `order.updated` | waiters, kitchen, managers, table_session | Bất kỳ đổi trạng thái order |
| `order.confirmed` | kitchen (+ như trên) | Phục vụ xác nhận |
| `order_item.updated` | waiters, kitchen, managers, table_session | Bếp done / hết món |
| `table.call_staff` | waiters | Khách bấm "Gọi nhân viên" |
| `table.updated` | waiters, managers | Bàn mở/đóng session |
| `menu_item.updated` | tất cả | Đổi giá / bật tắt món / hết món |

---

## 2. QR theo bàn & định danh bàn chính xác

### 2.1 Token & URL
- Mỗi bàn có `qr_token` ngẫu nhiên (24 ký tự, không đoán được). **Không** dùng số bàn trong URL.
- URL QR: `http://${LAN_IP}:${WEB_PORT}/t/${qr_token}`
- QR **tĩnh**: in 1 lần, dán cố định. `qr_token` chỉ đổi khi manager chủ động bấm "Tạo lại QR" (VD QR bị lộ/hỏng) → khi đó mới cần in lại.
- Cái thay đổi theo mỗi lượt khách là **table session** (`session_token` + `verify_code`), xem §2.2–2.3.

### 2.2 Table session
- Quét QR → `POST /api/public/tables/:qr_token/session` → tạo/lấy `table_session` đang mở của bàn → trả về `session_token` (lưu sessionStorage).
- Mọi order của khách gắn `table_id` + `table_session_id` lấy từ **server** (từ session_token), client không tự gửi số bàn → không giả mạo được.
- Mỗi bàn tối đa **1 session `open`**. Nhiều khách cùng bàn quét QR → vào chung session đó (dùng chung giỏ order của bàn).
- Session `open` → `closed` khi phục vụ bấm **"Thanh toán & đóng bàn"** → `session_token` cũ bị vô hiệu, client cũ thấy màn "Vui lòng quét lại QR". Lượt khách sau quét cùng QR → session mới + verify code mới.
- **Chống QR chụp lại / order từ xa**: order mới luôn ở `pending`, chỉ vào bếp khi phục vụ **đến bàn đối chiếu verify code** và bấm Xác nhận. Order không khớp → Huỷ.

### 2.3 Cơ chế để nhân viên biết CHÍNH XÁC bàn nào vừa order
1. **Số bàn do server gắn** (từ token), hiển thị **to, nổi bật** ở đầu mỗi order card trên Staff site: `BÀN 05` + tên khu vực (VD "Tầng 1 – Cửa sổ").
2. **Mã xác nhận 3 số (verify code)** sinh cho mỗi table session:
   - Màn hình khách luôn hiển thị lớn: `Bàn 05 · Mã: 482`.
   - Order card bên staff hiển thị cùng mã `482`.
   - Mã **đổi theo mỗi lượt khách** (mỗi session), QR không đổi.
   - Phục vụ đến bàn, đối chiếu mã trên điện thoại khách ↔ mã trên máy mình trước khi bấm **Xác nhận** → chắc chắn đúng bàn, đúng khách (chống trường hợp ai đó dùng QR chụp lại / ngồi nhầm bàn).
3. **Sơ đồ bàn (Table board)** trên Staff site: lưới các bàn, bàn có order mới **nhấp nháy đỏ** + badge số order chờ; bấm vào bàn → danh sách order của bàn.
4. **Thông báo**: âm thanh + rung + toast `"Bàn 05 vừa đặt 3 món"`; order mới luôn nằm đầu danh sách "Chờ xác nhận", hiển thị "x phút trước".
5. Tất cả order card đều có: số bàn, verify code, mã order (`#A1B2`), giờ đặt.

### 2.4 Manage – in QR
- Trang `/manage/tables`: lưới QR mọi bàn (số bàn to + QR + URL), nút in, nút "Tạo lại QR".
- `make qr`: in URL hiện tại của các bàn ra terminal để test.

---

## 3. Data model

| Bảng | Trường chính |
|---|---|
| `users` | name, email (unique), password_digest, role enum (`waiter`,`kitchen`,`manager`,`owner`), active |
| `tables` | number (unique), name/area, qr_token (unique), status (`available`,`occupied`), seats |
| `table_sessions` | table_id, session_token (unique), verify_code (3 số), status (`open`,`closed`), opened_at, closed_at, closed_by_id |
| `categories` | name, position, active |
| `menu_items` | category_id, name, description, price (int), image_url, available, position |
| `orders` | table_id, table_session_id, code, status, note, total (int), confirmed_by_id, confirmed_at, completed_at, cancelled_at |
| `order_items` | order_id, menu_item_id, name_snapshot, price_snapshot, quantity, note, status, done_at |
| `order_events` | order_id, user_id (nullable), action, from_status, to_status, created_at |
| `staff_calls` | table_session_id, status (`open`,`resolved`), resolved_by_id |

### Trạng thái Order
```
pending ──(waiter xác nhận)──▶ confirmed ──(bếp bắt đầu/done 1 món)──▶ preparing
   │                                                                     │
   └─▶ cancelled ◀──(waiter/manager huỷ)                     (mọi món done/hết)
                                                                         ▼
                                    completed ◀──(thanh toán bàn)──── ready
```
- `completed`: khi session bàn được đóng (thanh toán), tất cả order `ready`/`confirmed`/`preparing` của session → `completed`. Manager có thể đổi trạng thái thủ công.

### Trạng thái Order Item
`pending` → `cooking` → `done` | `out_of_stock`

### Quy tắc nghiệp vụ
- Giá lưu **snapshot** trong order_item.
- `orders.total` = Σ (price_snapshot × quantity) của item **không** `out_of_stock`.
- **Doanh thu** = Σ total của order `completed` (theo `completed_at`).
- Báo hết món có option "Hết cả menu" → `menu_items.available = false` + broadcast.
- Mọi đổi trạng thái ghi `order_events`.

---

## 4. Phân quyền

| Quyền | waiter | kitchen | manager | owner |
|---|:-:|:-:|:-:|:-:|
| Staff site – phục vụ | ✓ | | ✓ | ✓ |
| Staff site – bếp | | ✓ | ✓ | ✓ |
| Manage site (dashboard, orders, menu, bàn) | | | ✓ | ✓ |
| Báo cáo doanh thu + CSV | | | | ✓ |
| Quản lý tài khoản nhân viên | | | | ✓ |

---

## 5. Chi tiết từng site

Routing FE: `/t/:qrToken` (khách) · `/staff/*` · `/manage/*`

### 5.1 User Site — mobile only
- [ ] Vào qua QR → tạo session → header: **"Bàn 05 · Mã 482"**
- [ ] Tab category ngang (sticky) + search (debounce 300ms, bỏ dấu tiếng Việt)
- [ ] Card món: ảnh, tên, mô tả ngắn, giá, nút +/−; món hết → mờ, disable
- [ ] Giỏ hàng (bottom sheet, Zustand + persist theo session): sửa SL, ghi chú từng món, tổng tiền, nút **Đặt món**
- [ ] Trang "Đơn của bàn": các order của session, trạng thái realtime từng món
- [ ] Nút **Gọi nhân viên**
- [ ] Session đã đóng / token hết hạn → màn "Vui lòng quét lại QR"

### 5.2 Staff Site — mobile + iPad
- [ ] Login email + password (JWT)
- **Phục vụ**
  - [ ] Sơ đồ bàn (§2.3.3)
  - [ ] Tabs: Chờ xác nhận / Đang làm / Sẵn sàng mang ra
  - [ ] Order card: **BÀN xx**, verify code, mã order, giờ, món, SL, giá, tổng
  - [ ] Xác nhận → gửi bếp · Huỷ (kèm lý do)
  - [ ] Chi tiết bàn: tất cả order của session + tổng → **Thanh toán & đóng bàn** (completed + đóng session, QR giữ nguyên)
  - [ ] Nhận realtime: order mới (âm thanh/rung), bếp done, hết món, gọi nhân viên
- **Bếp**
  - [ ] Board order đã xác nhận, cũ → mới, đồng hồ thời gian chờ
  - [ ] Filter theo order / bàn / trạng thái
  - [ ] Done từng món · Done cả order · Hết món từng item (option hết cả menu)
  - [ ] Mọi thao tác realtime về phục vụ + khách

### 5.3 Manage Site — mobile + iPad + desktop
- [ ] Login (manager/owner)
- [ ] **Dashboard hôm nay** (realtime): tổng order, chưa xác nhận, đang xử lý, done (ready+completed), huỷ, doanh thu (completed), bàn đang có khách, top 5 món
- [ ] **Orders**: list + filter (trạng thái, ngày, bàn), chi tiết + lịch sử events, đổi trạng thái
- [ ] **Menu**: CRUD category, CRUD món, bật/tắt, sửa giá; chỉnh giá hàng loạt theo category (± % hoặc ± số tiền)
- [ ] **Bàn**: CRUD bàn, lưới QR (in 1 lần), tạo lại QR thủ công khi cần
- [ ] **Báo cáo (owner)**: doanh thu theo ngày / khoảng ngày / tháng; bảng trên web + **Export CSV** (UTF-8 BOM)
- [ ] **Nhân viên (owner)**: CRUD user, đổi role, khoá

---

## 6. API (prefix `/api/v1`)

**Public (khách)**
- `POST /public/tables/:qr_token/session` → {session_token, table, verify_code}
- `GET  /public/menu` → categories + items
- `GET  /public/session` (header `X-Session-Token`) → session + orders
- `POST /public/orders` → tạo order
- `POST /public/staff_calls`

**Auth**: `POST /auth/login`, `GET /auth/me`

**Staff**
- `GET /staff/tables` · `GET /staff/tables/:id` (session + orders)
- `POST /staff/tables/:id/checkout` (đóng session; lượt sau sinh session + verify code mới)
- `GET /staff/orders?status=&table_id=`
- `POST /staff/orders/:id/confirm` · `/cancel` · `/done`
- `PATCH /staff/order_items/:id` (status: cooking/done/out_of_stock, mark_menu_unavailable)
- `POST /staff/staff_calls/:id/resolve`

**Manage**
- `GET /manage/dashboard`
- `GET/PATCH /manage/orders(/:id)`
- CRUD `/manage/categories`, `/manage/menu_items`, `POST /manage/categories/:id/adjust_prices`
- CRUD `/manage/tables`, `POST /manage/tables/:id/regenerate_qr`
- `GET /manage/reports/revenue?from=&to=&group=day|month(&format=csv)` (owner)
- CRUD `/manage/users` (owner)

---

## 7. Tech stack
- **BE**: Rails 8.1 API (Ruby 3.3), bcrypt, jwt, pundit, sidekiq 8, rack-cors, redis, rqrcode, rspec + factory_bot
- **FE**: React 19 + Vite + TS, TailwindCSS, React Router, TanStack Query, Zustand, socket.io-client, qrcode.react
- **Socket**: Node 22, socket.io, ioredis, jsonwebtoken

## 8. ENV (`.env.example`)
```
LAN_IP=192.168.1.10
WEB_PORT=5173
API_PORT=3001
SOCKET_PORT=4000
DB_PORT=5433
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=restaurant_development
REDIS_URL=redis://redis:6379/0
JWT_SECRET=change_me
SOCKET_JWT_SECRET=change_me_too
TZ=Asia/Ho_Chi_Minh
```

## 9. Seed data
- Users (mật khẩu `password`): `owner@demo.vn`, `manager@demo.vn`, `waiter@demo.vn`, `kitchen@demo.vn`
- 10 bàn (Tầng 1: 1–6, Tầng 2: 7–10)
- 6 category: Khai vị, Món chính, Lẩu, Đồ uống, Tráng miệng, Combo — ~35 món tiếng Việt
- Lịch sử order 30 ngày (completed) cho báo cáo
- Hôm nay: vài session mở + order ở đủ trạng thái

## 10. Makefile
```
make setup        # .env + detect IP + build + db:prepare + up
make up | down | restart | logs [s=api]
make migrate | seed | reset-db
make console      # rails c
make bash s=api
make test
make ip           # detect LAN IP (macOS) → ghi vào .env
make qr           # in URL QR các bàn
make urls         # in URL truy cập (localhost + LAN)
make ps           # trạng thái container
```

## 11. Cấu trúc thư mục
```
restaurant-app/
├── SPEC.md  README.md  Makefile  docker-compose.yml  .env.example
├── api/      Rails 8
├── socket/   Node Socket.IO
└── web/      React — src/sites/{customer,staff,manage}, src/shared
```

## 12. Lộ trình triển khai
- [x] **B1** Khung Docker + Makefile + Rails + React + socket chạy được `make setup`
- [ ] **B2** Models, migrations, seed, auth, API
- [ ] **B3** Realtime (publisher + socket rooms + auth)
- [ ] **B4** User Site
- [ ] **B5** Staff Site (phục vụ + bếp + sơ đồ bàn)
- [ ] **B6** Manage Site (dashboard, orders, menu, bàn/QR, báo cáo CSV, nhân viên)
- [ ] **B7** Test E2E qua LAN trên điện thoại + README

## 13. Backlog (phase sau)
- Thanh toán online (VietQR/MoMo), in bill / in phiếu bếp
- Gộp / chuyển bàn, đặt bàn trước, khuyến mãi / voucher
- Bếp: chế độ gom theo món
- Login PIN cho nhân viên, PWA, push notification
- Đa chi nhánh, quản lý kho nguyên liệu

---

## Changelog
| Ngày | Version | Thay đổi |
|---|---|---|
| 2026-10-13 | 1.0 | Khởi tạo spec. Chốt D1–D7. Thêm cơ chế định danh bàn (table session + verify code + sơ đồ bàn) |
| 2026-10-13 | 1.1 | Sửa D3: QR tĩnh không đổi; chỉ session_token + verify_code đổi theo mỗi lượt khách. Thêm quy tắc 1 session open/bàn và chống order từ xa |
| 2026-10-13 | 1.2 | B1 xong. Thêm D8 (Vite proxy 1 cổng). Port host: API 3001, DB 5433 (tránh xung đột). Chốt version: Rails 8.1, React 19, Node 22, Sidekiq 8. Định dạng message Redis + claims JWT socket |
