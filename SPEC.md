# Restaurant App — Spec tổng thể

> **Nguồn sự thật duy nhất (single source of truth)** cho toàn bộ dự án.
> - Mọi code phải bám theo file này. Nếu code cần lệch spec → cập nhật spec trước.
> - Bổ sung tính năng mới: thêm vào đúng section tương ứng + ghi vào **Changelog** cuối file.
> - Đánh dấu trạng thái: `[ ]` chưa làm · `[~]` đang làm · `[x]` xong.

**Version:** 1.15 · **Ngày tạo:** 2026-10-13

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
| D7 | Tiền / giờ / ngôn ngữ | VND (integer), timezone `Asia/Ho_Chi_Minh`, thông báo lỗi API tiếng Việt (`config/locales/vi.yml`) |
| D8 | Một cổng truy cập | Client chỉ gọi `http://LAN_IP:5173`; Vite proxy `/api` + `/rails` → Rails, `/socket.io` → Socket server (không cần CORS/IP riêng cho API) |
| D9 | Lưu file | **Active Storage + S3**. Local dùng **RustFS** (S3-compatible, container `s3`) thay MinIO (image MinIO không còn pull được). Ảnh phục vụ qua **Rails proxy** (`/rails/active_storage/...`, URL tương đối). Production dùng AWS S3 (bỏ `S3_ENDPOINT`) hoặc Cloudflare R2 (`S3_ENDPOINT` = endpoint R2, `S3_REGION=auto`), chỉ đổi ENV |
| D10 | Môi trường | `docker-compose.yml` **chỉ cho dev** (RustFS, hot reload, mở port). `docker-compose.prod.yml` cho production (image build sẵn, nginx, không có S3 giả lập), đọc `.env.production`. Xem §8.2 |

---

## 1. Kiến trúc

```
docker-compose
├── db      PostgreSQL 16                     host :5433 (DB_PORT)
├── redis   Redis 7 (pub/sub, Sidekiq, cache) chỉ nội bộ
├── api     Rails 8.1 API-only                host :3001 (API_PORT)
├── worker  Sidekiq 8
├── socket  Node 22 + Socket.IO + ioredis     host :4000 (dev: nodemon --legacy-watch)
├── s3      RustFS (S3 giả lập) + console     host :9001 (S3_CONSOLE_PORT), API nội bộ :9000
├── s3-init AWS CLI tạo bucket rồi thoát
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
| `guests` | Mọi khách đang ngồi (nhận cập nhật menu) |

**Auth socket:** client gửi `auth.token` là JWT do Rails ký bằng `SOCKET_JWT_SECRET`.
- Staff: `{kind: "staff", role, user_id}` → join room theo role.
- Khách: `{kind: "guest", table_session_id}` → join `table_session:{id}` + `guests`.
- REST trả `socket_token` kèm khi login (staff) và khi mở session (khách).

**Client (web/src/shared)**
- `useSocket(token, {handlers, onReconnect})`: 1 kết nối/token; khi kết nối lại hoặc quay lại tab (mobile khoá màn hình) → gọi `onReconnect` để refetch, không bỏ lỡ event.
- `notify(tone)`: âm thanh (Web Audio, không cần file) + rung. Trình duyệt mobile chỉ cho phát sau lần chạm đầu tiên → gọi `unlockAudio()` trong handler click.
- `useAuth` (Zustand persist): token staff/manage dùng chung; API trả 401 → tự logout.
- Trang dev `/dev/realtime`: đăng nhập tài khoản demo và xem log event.

**Events**
| Event | Gửi tới | Khi nào |
|---|---|---|
| `order.created` | waiters, managers, table_session | Khách đặt món |
| `order.updated` | waiters, managers, table_session (+ kitchen nếu đơn đã từng được xác nhận) | Bất kỳ đổi trạng thái order |
| `order.confirmed` | kitchen (+ như trên) | Phục vụ xác nhận |
| `order_item.updated` | waiters, kitchen, managers, table_session | Bếp done / hết món |
| `table.call_staff` | waiters | Khách bấm "Gọi nhân viên" |
| `table.updated` | waiters, managers | Bàn mở/đóng session |
| `menu_item.updated` | waiters, kitchen, managers, guests | Đổi giá / bật tắt món / hết món |
| `staff_call.resolved` | waiters | Phục vụ đã xử lý yêu cầu gọi |
| `session.closed` | table_session | Bàn đã thanh toán → client khách về màn quét lại QR |

---

## 2. QR theo bàn & định danh bàn chính xác

### 2.1 Token & URL
- Mỗi bàn có `qr_token` ngẫu nhiên (24 ký tự, không đoán được). **Không** dùng số bàn trong URL.
- URL QR: `${PUBLIC_URL}/t/${qr_token}` nếu có `PUBLIC_URL` (domain production), không thì `http://${LAN_IP}:${WEB_PORT}/t/${qr_token}`
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

### 2.5 Chuyển / gộp bàn
Phục vụ (manager, owner) thao tác ở **Chi tiết bàn → ⇄ Chuyển / gộp bàn**, chọn bàn đích:

| | Bàn đích | Kết quả |
|---|---|---|
| **Chuyển** | Trống | Cả phiên (đơn, lượt gọi) sang bàn đích. **Giữ** `session_token` + `verify_code` → điện thoại khách dùng tiếp, header đổi số bàn. Bàn nguồn trống |
| **Gộp** | Đang có khách | Đơn + lượt gọi của bàn nguồn dồn vào phiên bàn đích (1 hoá đơn). Phiên nguồn `closed` + `merged_into_id` → phiên đích. Bàn nguồn trống |

- Token khách luôn được giải qua `TableSession.resolve`: phiên đã gộp → đi theo `merged_into`. Nên khách bàn nguồn vẫn xem / gọi món tiếp; app khách nhận event `session.merged`, mở lại phiên → nhận token + mã của bàn đích, **giữ giỏ hàng**.
- Quét QR: nếu token đang giữ trỏ tới phiên còn mở (kể cả đã chuyển / gộp sang bàn khác) thì dùng lại phiên đó, không tạo phiên mới ở bàn nguồn.
- Mỗi đơn ghi lịch sử `move_table` / `merge_table` (từ bàn → sang bàn). Realtime: `order.updated` cho từng đơn (bếp thấy số bàn mới), `table.updated` cho 2 bàn, `session.moved` / `session.merged` tới room của khách.
- Không chuyển vào bàn có khách (dùng Gộp) và không gộp vào bàn trống (dùng Chuyển).

---

## 3. Data model

| Bảng | Trường chính |
|---|---|
| `users` | name, email (unique), password_digest, role enum (`waiter`,`kitchen`,`manager`,`owner`), active |
| `tables` | number (unique), name/area, qr_token (unique), status (`available`,`occupied`), seats |
| `table_sessions` | table_id, session_token (unique), verify_code (3 số), status (`open`,`closed`), opened_at, closed_at, closed_by_id |
| `categories` | name, position, active |
| `menu_items` | category_id, name, description, price (int), image (Active Storage), image_url (link ngoài, dự phòng), available, position |
| `orders` | table_id, table_session_id, code, status, note, total (int), confirmed_by_id, confirmed_at, completed_at, cancelled_at |
| `order_items` | order_id, menu_item_id, name_snapshot, price_snapshot, quantity, note, status, done_at |
| `order_events` | order_id, user_id (nullable), action, from_status, to_status, created_at |
| `staff_calls` | table_session_id, status (`open`,`resolved`), resolved_by_id, resolved_at |

> Order có thêm: `ready_at`, `cancel_reason`. `order_events` có thêm `data` (jsonb). Chi tiết: `api/db/migrate/20261013000001_create_core_schema.rb`.

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
- **Doanh thu** = Σ (`total` − `discount`) của order `completed` (theo `completed_at`). `discount` = phần giảm giá hoá đơn phân bổ khi thanh toán (§5.6).
- Báo hết món có option "Hết cả menu" → `menu_items.available = false` + broadcast.
- Mọi đổi trạng thái ghi `order_events`.
- Món đang được bếp xử lý: done hết (tính cả hết món) → order `ready`; còn món chưa xong → `preparing`.
- Huỷ: phục vụ huỷ được đơn `pending`/`confirmed`; manager/owner huỷ được mọi đơn đang hoạt động. Lý do huỷ lưu ở `cancel_reason` (kể cả khi manager đổi trạng thái thủ công).
- Xoá món đã có trong đơn → chỉ ẩn (`available=false`) để giữ lịch sử.
- Chỉnh giá hàng loạt làm tròn tới 1.000đ.
- **Ảnh món**: `has_one_attached :image`, variant `card` 480×360 webp (tạo sẵn bằng Sidekiq khi upload). API trả `image_url` = ảnh upload (proxy path) → nếu không có thì `image_url` link ngoài → nếu không có thì `null` (FE hiện ảnh mặc định). Chỉ nhận JPG/PNG/WEBP/HEIC, tối đa 5MB.

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
- [x] Vào qua QR → tạo session → header: **"Bàn 05 · Mã 482"**
- [x] Tab category ngang (sticky, scroll spy) + search (bỏ dấu tiếng Việt: gõ "lau" ra "Lẩu")
- [x] Card món: ảnh, tên, mô tả ngắn, giá, nút +/−; món hết → mờ, disable (cập nhật realtime)
- [x] Giỏ hàng (bottom sheet, Zustand + sessionStorage, gắn với session): sửa SL, ghi chú từng món + ghi chú cả đơn, tổng tiền, nút **Đặt món**; món vừa hết trong giỏ → chặn đặt
- [x] Trang "Đơn của bàn": mã xác nhận lớn, các order của session, trạng thái realtime từng món, tổng bàn
- [x] Nút **Gọi nhân viên**
- [x] Session đã đóng / token hết hạn → màn "Cảm ơn quý khách, vui lòng quét lại QR"
- [x] Toast realtime: đơn được xác nhận, món xong, món hết

> Mở trang = `POST` session (quét QR); refetch sau đó = `GET /public/session` (không tự mở session mới cho máy cũ sau khi bàn đã thanh toán).
> Ảnh món: từ S3 qua Rails proxy (§0 D9). Giỏ hàng lưu trong sessionStorage được đồng bộ lại (giá/ảnh/tình trạng) mỗi khi tải menu.

### 5.2 Staff Site — mobile + iPad
- [x] Login email + password (JWT), nút đăng nhập nhanh tài khoản demo
- Thanh điều hướng dưới theo role: phục vụ → **Đơn**, **Bàn**; bếp → **Bếp**, **Món hết**; manager/owner thấy cả 4
- **Phục vụ**
  - [x] Sơ đồ bàn (§2.3.3): đỏ nhấp nháy = có đơn chờ / khách gọi; xanh = có món sẵn sàng; cam nhạt = có khách; trắng = trống. Hiện mã xác nhận, tổng tiền, thời gian ngồi
  - [x] Tabs: Chờ xác nhận / Đang làm / Sẵn sàng (đếm số đơn)
  - [x] Order card: **BÀN xx**, verify code, mã order, giờ, “x phút trước”, món, ghi chú, SL, giá, tổng
  - [x] Xác nhận → **màn đối chiếu mã** (mã to) → “Khớp → Gửi bếp” / “Mã không khớp”
  - [x] Huỷ (chọn lý do)
  - [x] Chi tiết bàn: tất cả order của session + tổng → **Thanh toán & đóng bàn** (cảnh báo nếu còn đơn chưa xác nhận sẽ bị huỷ)
  - [x] Realtime: đơn mới (âm thanh/rung + toast “Bàn 05 vừa đặt 3 món”), đơn sẵn sàng, hết món, khách gọi nhân viên (banner + nút “Đã đến”)
- **Bếp**
  - [x] Board đơn đã xác nhận, xếp theo giờ xác nhận (cũ → mới), đồng hồ chờ (≥15′ vàng, ≥25′ đỏ)
  - [x] Filter: Cần làm / Mới / Đang làm / Đã xong + filter theo bàn
  - [x] Từng món: Bắt đầu / ✓ Xong / Hết (+ hoàn tác Xong) · **Xong cả đơn**
  - [x] Báo hết món: tuỳ chọn “Hết cả menu” (mặc định bật)
  - [x] **Chế độ xem**: *Theo đơn* (mặc định) / *Theo món*, nhớ theo thiết bị
  - [x] **Gom theo món**: gộp mọi phần chưa xong (chờ làm / đang nấu) của các đơn đã gửi bếp theo món → tổng số phần, danh sách bàn (số lượng, ghi chú, mã đơn, phút chờ). Món chờ lâu nhất lên đầu, vẫn lọc theo bàn được
    - **Bắt đầu cả mẻ** (mọi phần chờ làm → đang nấu) · **Xong cả N** · ✓ từng bàn · **Hết** cả món (mọi phần chưa xong, tuỳ chọn ẩn khỏi menu)
    - Thao tác hàng loạt dùng `PATCH /staff/order_items/batch`, mỗi món vẫn ghi lịch sử + realtime như thao tác lẻ
  - [x] Tab **Món hết**: bật lại món đã hết, báo hết món bất kỳ
  - [x] Mọi thao tác realtime về phục vụ + khách

### 5.3 Manage Site — mobile + iPad + desktop
- [x] Login (manager/owner). Desktop: sidebar; mobile/iPad: thanh tab ngang trên đầu
- [x] **Dashboard hôm nay** (realtime qua socket): doanh thu (đơn completed) + doanh thu đang phục vụ, bàn có khách, tổng đơn / chưa xác nhận / đang xử lý / đã xong / huỷ (bấm vào → danh sách đơn đã lọc), biểu đồ đơn theo trạng thái, top 5 món
- [x] **Orders**: lọc theo ngày, bàn, trạng thái (giữ trên URL), phân trang 30/trang; bảng (desktop) / thẻ (mobile); chi tiết đơn + lịch sử (ai làm, lúc nào, lý do) + đổi trạng thái kèm lý do
- [x] **Menu**: CRUD danh mục (thứ tự, ẩn/hiện), CRUD món + **upload ảnh lên S3** (xem trước, xoá ảnh), bật/tắt đang bán; **chỉnh giá hàng loạt** theo danh mục (tăng/giảm, %/đ, xem trước trước khi áp dụng)
- [x] **Bàn & QR**: lưới QR mọi bàn, **in tất cả** (CSS in 3 cột, ẩn UI), thêm/sửa/xoá bàn, tạo lại QR (cảnh báo QR cũ mất hiệu lực)
- [x] **Doanh thu (owner)**: nhanh: hôm nay / 7 ngày / tháng này / tháng trước / 12 tháng; hoặc chọn khoảng ngày + nhóm ngày/tháng; KPI + biểu đồ cột (hover xem số) + bảng; **Export CSV** (UTF-8 BOM)
- [x] **Nhân viên (owner)**: thêm, sửa, đổi quyền, đổi mật khẩu, khoá (không tự khoá/đổi quyền chính mình)
- Manager vào trang chỉ dành cho owner → tự về Dashboard

### 5.4 In phiếu bếp & hoá đơn
In qua hộp thoại in của trình duyệt (máy in nhiệt 80mm cài trên thiết bị, hoặc in ra PDF). Không cần phần mềm in riêng.

| Phiếu | Ai in | Khi nào | Nội dung |
|---|---|---|---|
| **Phiếu bếp** | Bếp | Nút 🖨️ In trên từng đơn; hoặc bật **Tự in phiếu** (lưu theo thiết bị) → in ngay khi nhận `order.confirmed` | Bàn (chữ lớn), mã đơn, giờ đặt / gửi bếp, phục vụ xác nhận, món + ghi chú từng món, ghi chú đơn. Bỏ món đã hết |
| **Phiếu tạm tính** | Phục vụ | Nút 🖨️ Tạm tính ở chi tiết bàn (phiên đang mở) | Như hoá đơn, ghi "PHIẾU TẠM TÍNH, chưa thanh toán" |
| **Hoá đơn** | Phục vụ | Tick "In hoá đơn sau khi đóng bàn" (mặc định bật, lưu theo thiết bị) khi Thanh toán | Tên/địa chỉ/SĐT quán, số HĐ `HD` + 6 số (id phiên), bàn, giờ vào/ra, thu ngân, món gộp theo tên + đơn giá (bỏ món hết, đơn huỷ), tổng, lời cảm ơn |
| In lại | Quản lý | Chi tiết đơn ở Manage → **In hoá đơn bàn** / **In phiếu bếp** | Hoá đơn của cả phiên chứa đơn đó |

- Tổng trên hoá đơn = tổng phiên (cùng quy tắc doanh thu).
- Thông tin quán lấy từ ENV `RESTAURANT_NAME`, `RESTAURANT_ADDRESS`, `RESTAURANT_PHONE`, `RESTAURANT_BILL_FOOTER`.
- Kỹ thuật: khổ giấy `80mm × <chiều cao phiếu>` (đo khi in, vì `@page size: 80mm auto` không hợp lệ). Nhiều lệnh in xếp hàng, in xong (`afterprint`) mới in tiếp. Khi in phiếu chỉ hiện phiếu, không ảnh hưởng in QR ở Manage.
- Muốn in **không hiện hộp thoại** trên máy bếp: chạy Chrome với `--kiosk-printing` và đặt máy in nhiệt làm mặc định.

### 5.5 Đặt bàn trước
Nhân viên (phục vụ, quản lý, chủ) nhập khi khách gọi điện — Staff site, tab **📅 Đặt bàn**.

- Lượt đặt: tên khách, SĐT, số người, ngày giờ đến, bàn, ghi chú. Trạng thái: `booked` → `arrived` / `cancelled` / `no_show`.
- Danh sách theo ngày (mặc định hôm nay, ‹ › đổi ngày), đếm số lượt chờ + số khách. Thao tác: **Sửa**, **Huỷ**, **Khách đã đến**, **Không đến** (chỉ hiện khi đã trễ).
- **Chặn trùng**: một bàn không có 2 lượt `booked` cách nhau dưới `RESERVATION_DURATION_MINUTES` (mặc định 120). Không đặt vào giờ đã qua.
- **Giữ chỗ trên sơ đồ bàn**: bàn trống có lượt `booked` trong khoảng [giờ đến − `RESERVATION_HOLD_MINUTES` (60), giờ đến + 30′] hiện màu tím “📅 19:00 · Anh Minh (4)”, quá giờ hiện “trễ”. Không chặn khách vãng lai quét QR — phục vụ tự điều phối.
- **Khách đã đến** → mở phiên cho bàn (khách quét QR là vào đúng phiên) và chuyển sang chi tiết bàn. Bàn đang có khách khác → báo lỗi, sửa lượt đặt sang bàn khác trước.
- Form chọn bàn gợi ý bàn đủ chỗ cho số người trước.
- Realtime: `reservation.updated` tới `waiters` + `managers`.

### 5.6 Khuyến mãi
Ba loại, cấu hình ở **Manage → 🎟️ Khuyến mãi** (manager, owner):

**1. Giảm giá món theo khung giờ (happy hour)** — bảng `promotions`
- Tên, % giảm (1–90), khung giờ `HH:MM–HH:MM` (hỗ trợ qua nửa đêm), ngày trong tuần (rỗng = mọi ngày), khoảng ngày (tuỳ chọn), áp cho danh mục / món cụ thể (rỗng = toàn menu), bật/tắt.
- Menu khách hiện giá đã giảm, giá gốc gạch ngang + nhãn “Happy hour … -20%”. Trùng nhiều chương trình → lấy % cao nhất. Giá giảm làm tròn 100đ.
- Đặt món: `price_snapshot` = giá đã giảm, lưu thêm `original_price` + `promotion_name`. Hoá đơn ghi tên chương trình cạnh món.
- Menu khách tự tải lại mỗi 5 phút; sửa chương trình → event `menu.refresh` để khách tải lại ngay.

**2. Mã voucher** — bảng `vouchers`
- Mã (chữ hoa, 3–20 ký tự), giảm % (có thể đặt trần `max_discount`) hoặc số tiền, đơn tối thiểu, thời gian hiệu lực, số lượt tối đa, bật/tắt, ghi chú.
- Nhập ở bước thanh toán; 1 voucher / phiên bàn. Mã hết hạn / hết lượt / bị tắt → từ chối. Chưa đủ đơn tối thiểu → giữ mã nhưng giảm 0 và báo lý do.
- Lượt dùng (`used_count`) chỉ tăng khi **đã thanh toán** và voucher thực sự giảm. Mã đã dùng thì không xoá được (chỉ tắt).

**3. Giảm giá trên hoá đơn (giảm tay)** — cột trên `table_sessions`
- Phục vụ / quản lý nhập % hoặc số tiền + **lý do bắt buộc** ở modal thanh toán. Phục vụ tối đa `MANUAL_DISCOUNT_MAX_PERCENT` (10%) tổng bàn, quản lý / chủ không giới hạn.

**Tính tiền**: tạm tính (tổng phiên) → trừ voucher → giảm tay tính trên phần còn lại → **khách cần trả**. Modal thanh toán và phiếu tạm tính / hoá đơn hiện đủ các dòng.
**Khi thanh toán** (`Discounts::Finalize`): chốt số tiền giảm vào `table_sessions.discount_total`, phân bổ theo tỉ lệ về `orders.discount` của các đơn hoàn thành.
**Doanh thu** (dashboard, báo cáo, CSV) = Σ(`total` − `discount`) — xem §3.

---

## 6. API (prefix `/api/v1`)

**Public (khách)** — header `X-Session-Token`
- `POST /public/tables/:qr_token/session` → {session_token, socket_token, verify_code, table, orders, total}. Gửi kèm token cũ còn mở của đúng bàn → dùng lại
- `GET  /public/menu` → categories + items
- `GET  /public/session` (header `X-Session-Token`) → session + orders
- `POST /public/orders` → tạo order
- `POST /public/staff_calls`

**Auth**: `POST /auth/login`, `GET /auth/me` → {user, token, socket_token}

**Staff**
- `GET /staff/tables` · `GET /staff/tables/:id` (session + orders)
- `POST /staff/tables/:id/checkout` (đóng session; lượt sau sinh session + verify code mới)
- `POST /staff/tables/:id/move {to_table_id}` · `POST /staff/tables/:id/merge {into_table_id}` (§2.5)
- `GET /staff/orders?status=&table_id=`
- `POST /staff/orders/:id/confirm` · `/cancel` · `/done`
- `PATCH /staff/order_items/:id` (status: cooking/done/out_of_stock, mark_menu_unavailable)
- `PATCH /staff/order_items/batch {ids[], status, mark_menu_unavailable}` — gom theo món (kitchen, manager, owner). Từ chối cả lô nếu có món thuộc đơn chưa xác nhận / đã kết thúc; trả về các đơn bị ảnh hưởng
- `GET /staff/reservations?date=` · `POST /staff/reservations` · `PATCH /staff/reservations/:id` · `POST /staff/reservations/:id/arrive|cancel|no_show` (§5.5). `GET /staff/tables` trả thêm `reservation` (lượt đang giữ bàn)
- `GET /staff/staff_calls` · `POST /staff/staff_calls/:id/resolve`
- `PATCH /staff/menu_items/:id {available}` (bật lại món đã hết)
- `PUT /staff/table_sessions/:id/discount {voucher_code, manual_kind: percent|amount, manual_value, reason}` — đặt lại toàn bộ giảm giá của phiên, trả về bill (§5.6)
- `GET /staff/table_sessions/:id/bill` — dữ liệu in hoá đơn / tạm tính (waiter, manager, owner). Checkout trả thêm `closed_session_id`

**Manage**
- `GET /manage/dashboard`
- `GET/PATCH /manage/orders(/:id)`
- CRUD `/manage/categories`, `/manage/menu_items`, `POST /manage/categories/:id/adjust_prices`
- Ảnh món: `PATCH /manage/menu_items/:id` multipart field `image`; `remove_image=true` để xoá
- CRUD `/manage/tables`, `POST /manage/tables/:id/regenerate_qr`
- `GET /manage/reports/revenue?from=&to=&group=day|month(&format=csv)` (owner; mặc định đầu tháng → hôm nay)
- `GET /manage/orders?status=&date=&table_id=&page=` (30/trang)
- CRUD `/manage/users` (owner)
- CRUD `/manage/promotions` · `/manage/vouchers` (manager, owner — §5.6)

---

## 7. Tech stack
- **BE**: Rails 8.1 API (Ruby 3.3), bcrypt, jwt, sidekiq 8, rack-cors, redis, rqrcode, rspec + factory_bot
- **FE**: React 19 + Vite + TS, TailwindCSS, React Router, TanStack Query, Zustand, socket.io-client, qrcode.react
- **Socket**: Node 22, socket.io, ioredis, jsonwebtoken

## 8. ENV

### 8.1 Dev (`.env.example`)
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

S3_ENDPOINT=http://s3:9000      # bỏ trống khi dùng AWS S3
S3_ACCESS_KEY=s3admin
S3_SECRET_KEY=s3admin123
S3_BUCKET=restaurant-dev
S3_REGION=ap-southeast-1
S3_CONSOLE_PORT=9001

RESTAURANT_NAME=Nhà hàng Demo         # in trên hoá đơn (§5.4)
RESTAURANT_ADDRESS=
RESTAURANT_PHONE=
RESTAURANT_BILL_FOOTER=Cảm ơn quý khách, hẹn gặp lại!

RESERVATION_DURATION_MINUTES=120   # §5.5 chặn đặt trùng
RESERVATION_HOLD_MINUTES=60        # §5.5 giữ chỗ trên sơ đồ
MANUAL_DISCOUNT_MAX_PERCENT=10     # §5.6 mức giảm tay tối đa của phục vụ
```

### 8.2 Production (`.env.production.example` → `.env.production`, không commit)
`docker-compose.prod.yml`, project `restaurant-prod`:

| Service | Dev | Production |
|---|---|---|
| api | `Dockerfile.dev`, mount code | `api/Dockerfile` multi-stage, `RAILS_ENV=production`, user non-root, tự `db:prepare` khi khởi động, healthcheck `/api/v1/health` |
| worker | mount code | dùng chung image api, chạy sau khi api healthy |
| web | Vite dev server | `web/Dockerfile.prod`: build tĩnh + **nginx** (`web/nginx.conf`) proxy `/api`, `/rails`, `/socket.io` (giữ D8: 1 cổng) |
| socket | nodemon | `node`, chỉ dependencies |
| db / redis | mở port ra host | không mở port, `restart: unless-stopped` |
| s3 / s3-init | RustFS | **không có**; dùng AWS S3 hoặc R2 |

Biến riêng của production:
```
PUBLIC_URL=                      # domain in QR, VD https://order.nhahang.vn; trống → LAN_IP:WEB_PORT
WEB_PORT=80
FORCE_SSL=false                  # true khi chạy sau HTTPS (Cloudflare Tunnel / reverse proxy)
SECRET_KEY_BASE= JWT_SECRET= SOCKET_JWT_SECRET=   # openssl rand -hex 64, bắt buộc
POSTGRES_PASSWORD=               # bắt buộc
S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com   # R2; trống = AWS S3
S3_REGION=auto                   # R2; AWS: ap-southeast-1
S3_ACCESS_KEY= S3_SECRET_KEY= S3_BUCKET=
```
- Thiếu secret bắt buộc → compose báo lỗi, không chạy.
- Endpoint S3-compatible: `storage.yml` đặt `request_checksum_calculation`/`response_checksum_validation` = `when_required`.
- Bucket để private được (ảnh đi qua Rails proxy, D9).
- HTTPS/domain ngoài phạm vi compose: đặt Cloudflare Tunnel hoặc reverse proxy phía trước cổng `WEB_PORT`.

## 9. Seed data
- Users (mật khẩu `password`): `owner@demo.vn`, `manager@demo.vn`, `waiter@demo.vn`, `waiter2@demo.vn`, `kitchen@demo.vn`
- 10 bàn (Tầng 1: 1–6, Tầng 2: 7–10)
- 6 category: Khai vị, Món chính, Lẩu, Đồ uống, Tráng miệng, Combo — 34 món tiếng Việt, ảnh demo `api/db/seed_images/*.png` upload lên S3 khi seed
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
make s3           # link + tài khoản S3 console
make e2e          # test end-to-end toàn bộ flow
make prod-env | prod-up | prod-down | prod-logs | prod-ps | prod-migrate | prod-seed | prod-console | prod-qr   # production
```

## 11. Cấu trúc thư mục
```
restaurant-app/
├── SPEC.md  README.md  Makefile
├── docker-compose.yml       .env.example              dev
├── docker-compose.prod.yml  .env.production.example   production
├── api/      Rails 8
├── socket/   Node Socket.IO
└── web/      React — src/sites/{customer,staff,manage}, src/shared
```

## 12. Lộ trình triển khai
- [x] **B1** Khung Docker + Makefile + Rails + React + socket chạy được `make setup`
- [x] **B2** Models, migrations, seed, auth, API, publisher realtime phía server, rspec services
- [x] **B3** Realtime phía client: hook socket React, auto reconnect + refetch, âm thanh/rung, trang `/dev/realtime`
- [x] **B4** User Site
- [x] **B5** Staff Site (phục vụ + bếp + sơ đồ bàn)
- [x] **B6** Manage Site (dashboard, orders, menu, bàn/QR, báo cáo CSV, nhân viên)
- [x] **B7** Test E2E qua LAN + README

> **MVP hoàn tất (B1–B7).** Tính năng mới đi theo Backlog §13: thêm vào spec trước, mỗi tính năng một nhánh và một PR vào `develop`.

**Kiểm thử**
- `make test`: RSpec cho service, model và request (order flow, checkout, báo cáo, phân quyền, ảnh).
- `make e2e` (`web/scripts/e2e.mjs`): 40 điểm kiểm tra đi qua đúng cổng web như điện thoại thật, gồm REST, Socket.IO theo từng role và ảnh S3. Chạy `make e2e BASE=http://LAN_IP:5173` để test qua LAN.
- Mỗi PR: `make test` + `make e2e` đều phải đạt.
- PR đụng tới production: build và chạy thử `docker-compose.prod.yml` rồi chạy e2e vào stack đó (`make e2e BASE=http://host.docker.internal:<WEB_PORT>`).

## 13. Backlog (phase sau)
- Thanh toán online (VietQR/MoMo)
- Login PIN cho nhân viên, PWA, push notification
- Đa chi nhánh, quản lý kho nguyên liệu

---

## Changelog
| Ngày | Version | Thay đổi |
|---|---|---|
| 2026-10-13 | 1.0 | Khởi tạo spec. Chốt D1–D7. Thêm cơ chế định danh bàn (table session + verify code + sơ đồ bàn) |
| 2026-10-13 | 1.1 | Sửa D3: QR tĩnh không đổi; chỉ session_token + verify_code đổi theo mỗi lượt khách. Thêm quy tắc 1 session open/bàn và chống order từ xa |
| 2026-10-13 | 1.2 | B1 xong. Thêm D8 (Vite proxy 1 cổng). Port host: API 3001, DB 5433 (tránh xung đột). Chốt version: Rails 8.1, React 19, Node 22, Sidekiq 8. Định dạng message Redis + claims JWT socket |
| 2026-10-13 | 1.3 | B2 xong. Phân quyền dùng `allow_roles` thay Pundit. Publisher realtime phía server làm luôn trong B2 → B3 chỉ còn phía client. Thêm room `guests`, event `staff_call.resolved`, `session.closed`, API bật lại món, danh sách gọi nhân viên. Bổ sung quy tắc nghiệp vụ |
| 2026-10-13 | 1.4 | B3 xong. Bếp nhận cả event completed/cancelled của đơn đã xác nhận (để gỡ khỏi board). Mô tả lớp realtime phía client + trang `/dev/realtime` |
| 2026-10-13 | 1.5 | B4 xong (User Site). Ảnh demo chuyển sang SVG local (loremflickr trả 401). Ghi rõ quy tắc POST/GET session phía khách |
| 2026-10-13 | 1.6 | Thêm D9: Active Storage + S3, local dùng RustFS (MinIO không còn image). Upload/xoá ảnh món qua API manage. Ảnh demo chuyển lên S3. Vite proxy thêm `/rails`. Giỏ hàng tự đồng bộ với menu |
| 2026-10-13 | 1.7 | B5 xong (Staff Site). Màn đối chiếu mã khi xác nhận, sơ đồ bàn màu theo trạng thái, board bếp có đồng hồ chờ, tab Món hết. Socket dev chuyển sang nodemon polling (node --watch không nhận thay đổi file qua bind mount trên macOS) |
| 2026-10-13 | 1.8 | B6 xong (Manage Site). Lỗi validation tiếng Việt, mật khẩu tối thiểu 6 ký tự, lưu lý do huỷ khi manager đổi trạng thái |
| 2026-10-13 | 1.9 | B7 xong: `make e2e` (30 kiểm tra REST + realtime + ảnh), đã chạy qua LAN và trên bản clone sạch (`make setup` từ đầu). README đầy đủ (test trên điện thoại, kịch bản test, xử lý sự cố). Sửa `make help`. MVP hoàn tất |
| 2026-10-13 | 1.10 | Thêm D10: tách `docker-compose.prod.yml` (nginx, image production, không RustFS) và `.env.production.example`. Hỗ trợ Cloudflare R2. Thêm `PUBLIC_URL` cho QR, `FORCE_SSL`, lệnh `make prod-*`. Đã chạy thử stack prod trên máy (thay R2 bằng RustFS), e2e 30/30 |
| 2026-10-13 | 1.11 | Thêm §5.4 In phiếu bếp & hoá đơn (80mm, qua trình duyệt): phiếu bếp thủ công / tự in, phiếu tạm tính, hoá đơn khi thanh toán, in lại từ Manage. API `GET /staff/table_sessions/:id/bill`, checkout trả `closed_session_id`. ENV `RESTAURANT_*`. e2e 33 kiểm tra |
| 2026-10-13 | 1.12 | Bếp: chế độ xem *Theo món* (gom các phần chưa xong theo món, bắt đầu / xong / hết cả mẻ). API `PATCH /staff/order_items/batch`. e2e 34 kiểm tra |
| 2026-10-13 | 1.13 | Thêm §2.5 Chuyển / gộp bàn: `table_sessions.merged_into_id`, `TableSession.resolve` cho token khách, API move/merge, event `session.moved` / `session.merged`, app khách tự đổi bàn và giữ giỏ hàng. e2e 35 kiểm tra |
| 2026-10-13 | 1.14 | Thêm §5.5 Đặt bàn trước (nhân viên nhập): bảng `reservations`, chặn trùng 2 giờ, giữ chỗ trên sơ đồ bàn, khách đến → mở phiên. Tab Đặt bàn ở Staff site, seed lượt đặt demo. e2e 37 kiểm tra |
| 2026-10-13 | 1.15 | Thêm §5.6 Khuyến mãi: happy hour theo khung giờ (giá menu + snapshot giá gốc), mã voucher, giảm tay trên hoá đơn (phục vụ ≤10%). Phân bổ giảm giá vào `orders.discount`; doanh thu = Σ(total − discount). Trang Manage Khuyến mãi, seed demo. e2e 40 kiểm tra |
