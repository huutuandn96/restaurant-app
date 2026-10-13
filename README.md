# restaurant-app

App gọi món cho nhà hàng gồm 3 site:

| Site | Dành cho | Thiết bị | Đường dẫn |
|---|---|---|---|
| **User** | Khách quét QR tại bàn để gọi món | Điện thoại | `/t/<mã QR của bàn>` |
| **Staff** | Phục vụ và bếp | Điện thoại, iPad | `/staff` |
| **Manage** | Quản lý và chủ | Điện thoại, iPad, máy tính | `/manage` |

> Spec tổng thể nằm ở [SPEC.md](SPEC.md). Mọi thay đổi phải bám theo spec, và khi bổ sung tính năng thì cập nhật spec cùng Changelog.

---

## 1. Chạy lần đầu

Yêu cầu: **Docker Desktop** (có Compose v2) và `make`. Không cần cài Ruby hay Node trên máy.

```bash
git clone git@github.com:huutuandn96/restaurant-app.git
cd restaurant-app
make setup
```

`make setup` sẽ:
1. Tạo `.env` từ `.env.example`.
2. Tự tìm IP LAN của máy (macOS) và ghi vào `LAN_IP`.
3. Build image.
4. Tạo DB, chạy migration và seed dữ liệu demo, bao gồm upload ảnh món lên S3.
5. Chạy toàn bộ container và in ra các đường dẫn truy cập.

Lần đầu mất khoảng 3–5 phút. Khi xong, bạn chạy `make e2e` để kiểm tra mọi thứ đã hoạt động.

## 2. Test trên điện thoại (cùng Wi-Fi)

1. Điện thoại và máy tính phải dùng **cùng một mạng Wi-Fi**.
2. Chạy `make urls` để xem địa chỉ LAN, ví dụ `http://192.168.1.10:5173`.
3. Chạy `make qr` để lấy link của từng bàn. Hoặc mở **Manage → Bàn & QR** rồi dùng điện thoại quét QR trên màn hình, hoặc bấm **In tất cả QR**.
4. Nếu điện thoại không mở được trang:
   - Đổi mạng Wi-Fi thì IP cũng đổi. Chạy `make ip && make up` để cập nhật. **QR in ra sẽ đổi theo IP**, nên cần in lại.
   - macOS Firewall có thể đang chặn. Vào *System Settings → Network → Firewall* và cho phép Docker nhận kết nối đến.
   - Wi-Fi công cộng hoặc Wi-Fi khách thường chặn các thiết bị nhìn thấy nhau (client isolation). Dùng mạng khác hoặc phát hotspot từ điện thoại.
5. Trên điện thoại của phục vụ và bếp, **chạm vào màn hình một lần** sau khi đăng nhập để bật âm thanh báo đơn mới. Đây là giới hạn của trình duyệt mobile.

## 3. Tài khoản demo

Mật khẩu chung: `password`. Màn đăng nhập có sẵn nút đăng nhập nhanh cho từng tài khoản.

| Email | Role | Vào được |
|---|---|---|
| `owner@demo.vn` | Chủ | Staff + Manage + Doanh thu + Nhân viên |
| `manager@demo.vn` | Quản lý | Staff + Manage |
| `waiter@demo.vn`, `waiter2@demo.vn` | Phục vụ | Staff: Đơn, Bàn |
| `kitchen@demo.vn` | Bếp | Staff: Bếp, Món hết |

Dữ liệu demo gồm 10 bàn (Tầng 1: 1–6, Tầng 2: 7–10), 6 danh mục và 34 món, lịch sử 30 ngày cho báo cáo, cùng vài đơn hôm nay ở đủ các trạng thái. Chạy `make reset-db` để làm mới dữ liệu.

## 4. Kịch bản test thủ công

Nên dùng 3 thiết bị (hoặc 3 tab trình duyệt): khách, phục vụ, bếp. Mở thêm Manage nếu muốn theo dõi dashboard.

| # | Ai | Làm gì | Kết quả mong đợi |
|---|---|---|---|
| 1 | Khách | Quét QR bàn 6 | Header hiện **Bàn 06 · Mã xxx** |
| 2 | Khách | Tìm `lau` (không dấu), thêm món, mở giỏ, ghi chú, bấm **Đặt món** | Chuyển sang trang "Đơn của bàn", trạng thái *Chờ xác nhận* |
| 3 | Phục vụ | Màn hình **Đơn** | Có âm thanh và thông báo "Bàn 06 vừa đặt…", đơn mới nằm đầu danh sách. Ô bàn 06 trên sơ đồ nhấp nháy đỏ |
| 4 | Phục vụ | Đến bàn, bấm **Xác nhận**, đối chiếu mã với điện thoại khách, bấm **Khớp → Gửi bếp** | Khách nhận "Nhân viên đã xác nhận…" |
| 5 | Bếp | Màn hình **Bếp** | Đơn bàn 06 hiện ra, có đồng hồ chờ |
| 6 | Bếp | Bấm **✓ Xong** một món, **Hết** một món (tick "Hết cả menu") | Khách thấy món xong hoặc hết. Phục vụ nhận cảnh báo hết món. Món hết bị mờ trên menu của mọi khách |
| 7 | Bếp | Bấm **Xong cả đơn** | Phục vụ nhận "đơn sẵn sàng mang ra". Ô bàn trên sơ đồ chuyển xanh |
| 8 | Khách | Bấm **Gọi nhân viên** | Phục vụ thấy banner đỏ "Bàn 06 gọi nhân viên" |
| 9 | Phục vụ | **Bàn → Bàn 06 → Thanh toán & đóng bàn** | Màn khách chuyển sang "Cảm ơn quý khách". Quét lại QR thì có mã xác nhận mới |
| 10 | Quản lý | **Tổng quan**, **Đơn hàng**, **Doanh thu** (chỉ owner) → Xuất CSV | Số liệu cập nhật realtime. CSV mở bằng Excel không lỗi tiếng Việt |

Phần lớn kịch bản này đã được tự động hoá trong `make e2e` (30 điểm kiểm tra).

## 5. Lệnh thường dùng

```bash
make help            # xem tất cả lệnh
make up / down       # bật / tắt
make restart s=api   # restart 1 service
make logs s=api      # xem log (bỏ s= để xem tất cả)
make ps              # trạng thái container
make urls            # các đường dẫn truy cập
make ip              # cập nhật LAN_IP khi đổi mạng (rồi chạy make up)
make qr              # link QR của từng bàn
make s3              # link + tài khoản S3 console
make migrate         # chạy migration
make seed            # seed lại dữ liệu demo
make reset-db        # xoá DB, tạo lại + seed
make console         # rails console
make bash s=web      # shell vào container
make test            # RSpec backend
make e2e             # test end-to-end toàn bộ flow (REST + realtime + ảnh)
make e2e BASE=http://<LAN_IP>:5173   # chạy e2e qua địa chỉ LAN
```

## 6. Kiến trúc

```
Điện thoại / iPad / PC
        │  http://LAN_IP:5173  (cổng duy nhất)
        ▼
┌───────────── web (Vite + React) ─────────────┐
│  /            → React app (3 site)           │
│  /api, /rails → proxy → api (Rails)          │
│  /socket.io   → proxy → socket (Socket.IO)   │
└──────────────────────────────────────────────┘
api (Rails 8) ──► PostgreSQL
     │  ├──────► S3 (RustFS): ảnh món qua Active Storage
     │  └──────► Redis PUBLISH "restaurant:events"
     ▼                         │
worker (Sidekiq: resize ảnh)   ▼
                  socket (Socket.IO) SUBSCRIBE → emit tới room
                  (waiters / kitchen / managers / guests / table_session:<id>)
```

| Service | Vai trò | Port trên host |
|---|---|---|
| web | React + Vite, proxy `/api`, `/rails`, `/socket.io` | 5173 |
| api | Rails 8 API | 3001 |
| worker | Sidekiq (resize ảnh, xoá file) | – |
| socket | Socket.IO, nhận event qua Redis pub/sub | 4000 |
| db | PostgreSQL 16 | 5433 |
| redis | Redis 7 | – |
| s3 | RustFS, giả lập S3 cho ảnh (`make s3` để xem console) | 9001 |
| s3-init | Tạo bucket lúc khởi động | – |

Port có thể đổi trong `.env` nếu bị trùng với project khác.

Cấu trúc thư mục:

```
api/      Rails: app/{models,services,serializers,controllers/api/v1/{public,staff,manage}}
socket/   Socket.IO server
web/      React: src/sites/{customer,staff,manage}, src/shared, scripts/e2e.mjs
SPEC.md   Spec tổng thể
```

## 7. Lên S3 thật (sau này)

Trong `.env` (hoặc biến môi trường của server):
- Bỏ `S3_ENDPOINT`.
- Điền `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET` và `S3_REGION` của AWS.
- Bỏ 2 service `s3` và `s3-init` khỏi compose.

Không cần sửa code.

## 8. Xử lý sự cố

| Hiện tượng | Cách xử lý |
|---|---|
| `port is already allocated` | Đổi `*_PORT` trong `.env` rồi chạy `make up` |
| Điện thoại không vào được | Xem mục 2: cùng Wi-Fi, `make ip`, firewall, client isolation |
| Badge hiện "Mất kết nối" | Kiểm tra `make logs s=socket`. App tự kết nối lại và tải lại dữ liệu khi có mạng |
| Không có tiếng báo đơn | Chạm vào màn hình một lần sau khi đăng nhập. Kiểm tra điện thoại không ở chế độ im lặng |
| Ảnh món không hiện | `make logs s=worker` và `make s3` để xem bucket. Chạy `make seed` để upload lại ảnh demo |
| Sửa code socket không thấy chạy | `make restart s=socket`. Socket dev dùng nodemon polling, thường tự reload |
| `nodemon: not found` sau khi pull | `docker compose rm -sf socket && docker volume rm restaurant_socket_node_modules && make up` |
| Đổi Gemfile / package.json | `make build && make up` |
