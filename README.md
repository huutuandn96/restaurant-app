# restaurant-app

App gọi món cho nhà hàng gồm 3 site: **User** (khách gọi món qua QR), **Staff** (phục vụ và bếp), **Manage** (quản lý và chủ).

> Spec tổng thể nằm ở [SPEC.md](SPEC.md). Mọi thay đổi phải bám theo spec.

## Yêu cầu
- Docker Desktop (có Compose v2)
- `make`

## Chạy lần đầu
```bash
make setup   # tạo .env, detect IP LAN, build, chuẩn bị DB, chạy toàn bộ
```

Sau đó mở:
- Máy này: http://localhost:5173
- Điện thoại cùng mạng Wi-Fi: `http://<LAN_IP>:5173` (xem bằng `make urls`)

## Lệnh thường dùng
```bash
make help          # xem tất cả lệnh
make up / down     # bật / tắt
make logs s=api    # xem log một service
make ip            # cập nhật LAN_IP khi đổi mạng (rồi chạy make up)
make console       # rails console
make reset-db      # xoá và seed lại dữ liệu demo
```

## Kiến trúc
| Service | Vai trò | Port trên host |
|---|---|---|
| web | React + Vite, proxy `/api` và `/socket.io` | 5173 |
| api | Rails 8 API | 3001 |
| worker | Sidekiq | – |
| socket | Socket.IO (nhận event qua Redis pub/sub) | 4000 |
| db | PostgreSQL 16 | 5433 |
| redis | Redis 7 | – |
| s3 | RustFS, giả lập S3 cho ảnh (`make s3` để xem console) | 9001 |
| s3-init | Tạo bucket lúc khởi động | – |
