# Dữ liệu demo (SPEC §9). Chạy lại an toàn: xoá sạch rồi tạo mới.
srand(42)

puts "Xoá dữ liệu cũ..."
# Xoá file trên S3 trước (delete_all không chạy callback purge)
ActiveStorage::Attachment.delete_all
ActiveStorage::VariantRecord.delete_all
ActiveStorage::Blob.find_each(&:purge)
[Reservation, OrderEvent, OrderItem, Order, StaffCall, TableSession, Voucher, Promotion, MenuItem, Category, Table, Device, PushSubscription, User].each(&:delete_all)

puts "Users..."
# PIN demo cho đăng nhập trên máy dùng chung (SPEC §4.1)
[
  ["Chủ quán", "owner@demo.vn", "owner", "9630"],
  ["Quản lý", "manager@demo.vn", "manager", "2580"],
  ["Phục vụ An", "waiter@demo.vn", "waiter", "2468"],
  ["Phục vụ Bình", "waiter2@demo.vn", "waiter", "3690"],
  ["Bếp Cường", "kitchen@demo.vn", "kitchen", "1470"]
].each { |name, email, role, pin| User.new(name:, email:, role:, password: "password").tap { |u| u.pin = pin }.save! }
waiters = User.waiter.to_a
kitchen = User.kitchen.first

puts "Bàn..."
tables = (1..10).map do |n|
  Table.create!(number: n, area: n <= 6 ? "Tầng 1" : "Tầng 2", seats: [2, 4, 4, 6].sample)
end

# Ảnh demo: api/db/seed_images/*.png → upload lên S3 (local: RustFS) qua Active Storage
SEED_IMAGES = Rails.root.join("db/seed_images")

def vn_slug(s)
  s.tr("đĐ", "dD").unicode_normalize(:nfd).gsub(/\p{Mn}/, "").downcase.gsub(/[^a-z0-9]+/, "-").gsub(/\A-|-\z/, "")
end

puts "Menu..."
MENU = {
  ["Khai vị", "salad"] => [
    ["Gỏi cuốn tôm thịt", 45_000, "4 cuốn, kèm nước chấm tương đậu"],
    ["Chả giò rế", 55_000, "Giòn rụm, nhân tôm thịt"],
    ["Gỏi ngó sen tôm thịt", 85_000, "Chua ngọt, thanh mát"],
    ["Nộm bò khô", 65_000, "Đu đủ bào, bò khô, rau thơm"],
    ["Đậu hũ chiên sả ớt", 49_000, "Đậu non chiên giòn"],
    ["Súp cua", 39_000, "Thịt cua, trứng cút, nấm"]
  ],
  ["Món chính", "vietnamese-food"] => [
    ["Phở bò tái nạm", 65_000, "Nước dùng hầm xương 12 tiếng"],
    ["Bún chả Hà Nội", 60_000, "Chả nướng than hoa"],
    ["Cơm tấm sườn bì chả", 70_000, "Sườn nướng mật ong"],
    ["Bò lúc lắc", 145_000, "Bò Úc, khoai tây chiên"],
    ["Cá kho tộ", 120_000, "Cá basa kho tiêu"],
    ["Gà nướng mật ong", 165_000, "Nửa con"],
    ["Mì xào hải sản", 95_000, "Tôm, mực, rau cải"],
    ["Cơm chiên dương châu", 75_000, "Lạp xưởng, tôm, trứng"]
  ],
  ["Lẩu", "hotpot"] => [
    ["Lẩu thái hải sản", 320_000, "2-3 người, chua cay"],
    ["Lẩu bò nhúng giấm", 290_000, "Bò tái, rau sống, bánh tráng"],
    ["Lẩu gà lá é", 280_000, "Gà ta, lá é Phú Yên"],
    ["Lẩu nấm chay", 220_000, "7 loại nấm"],
    ["Lẩu riêu cua bắp bò", 300_000, "Riêu cua đồng"]
  ],
  ["Đồ uống", "drink"] => [
    ["Trà đá", 5_000, nil],
    ["Cà phê sữa đá", 29_000, "Cà phê phin"],
    ["Trà chanh", 20_000, nil],
    ["Nước cam ép", 35_000, "Cam tươi"],
    ["Sinh tố bơ", 40_000, nil],
    ["Bia Sài Gòn", 22_000, "Chai 330ml"],
    ["Bia Heineken", 30_000, "Chai 330ml"],
    ["Coca Cola", 18_000, "Lon"]
  ],
  ["Tráng miệng", "dessert"] => [
    ["Chè khúc bạch", 35_000, "Hạnh nhân, vải"],
    ["Bánh flan", 20_000, "Caramel"],
    ["Kem dừa", 39_000, "Trong trái dừa"],
    ["Trái cây theo mùa", 60_000, "Đĩa nhỏ"]
  ],
  ["Combo", "dinner"] => [
    ["Combo gia đình 4 người", 599_000, "Gỏi + lẩu thái + 2 món chính + tráng miệng"],
    ["Combo cặp đôi", 299_000, "Gỏi cuốn + bò lúc lắc + 2 nước"],
    ["Combo trưa văn phòng", 89_000, "Cơm + canh + nước"]
  ]
}
MENU.each_with_index do |((cat_name, _keyword), items), ci|
  cat = Category.create!(name: cat_name, position: ci)
  items.each_with_index do |(name, price, desc), ii|
    item = cat.menu_items.new(name:, price:, description: desc, position: ii)
    file = SEED_IMAGES.join("#{vn_slug(name)}.png")
    item.image.attach(io: File.open(file), filename: file.basename.to_s, content_type: "image/png") if file.exist?
    item.save!
  end
end
MenuItem.find_by(name: "Lẩu riêu cua bắp bò").update!(available: false) # demo món hết
menu = MenuItem.available.to_a

def build_order(session, items, created_at:, status:, waiter:, kitchen:)
  o = session.orders.create!(table: session.table, status:, created_at:, updated_at: created_at)
  items.each do |mi, qty|
    o.order_items.create!(menu_item: mi, name_snapshot: mi.name, price_snapshot: mi.price, quantity: qty,
                          created_at:, updated_at: created_at)
  end
  o.log_event!("create", to: "pending")
  unless status == "pending"
    o.update!(confirmed_by: waiter, confirmed_at: created_at + 3.minutes) unless status == "cancelled"
  end
  o.recalculate_total!
  o
end

def random_lines(menu, n = rand(2..5))
  menu.sample(n).map { |mi| [mi, mi.price > 200_000 ? 1 : rand(1..3)] }
end

puts "Lịch sử 30 ngày..."
(1..30).each do |days_ago|
  day = days_ago.days.ago.to_date
  rand(12..28).times do
    t = tables.sample
    start = Time.zone.local(day.year, day.month, day.day, [11, 12, 18, 19, 20].sample, rand(0..59))
    session = t.table_sessions.create!(status: "closed", opened_at: start, closed_at: start + 70.minutes)
    rand(1..2).times do |k|
      created = start + (k * 25).minutes
      o = build_order(session, random_lines(menu), created_at: created, status: "pending", waiter: waiters.sample, kitchen:)
      if rand < 0.05
        o.update!(status: "cancelled", cancelled_at: created + 5.minutes, cancel_reason: "Khách đổi ý")
      else
        o.order_items.update_all(status: "done", done_at: created + 20.minutes)
        o.update!(status: "completed", confirmed_by: waiters.sample, confirmed_at: created + 3.minutes,
                  ready_at: created + 20.minutes, completed_at: start + 70.minutes)
      end
    end
  end
end

puts "Đơn hôm nay..."
now = Time.current
# Vài bàn đã thanh toán sáng nay
3.times do |i|
  t = tables[6 + i]
  start = [now.beginning_of_day + 11.hours, now - 3.hours].min + (i * 10).minutes
  s = t.table_sessions.create!(status: "closed", opened_at: start, closed_at: start + 60.minutes)
  o = build_order(s, random_lines(menu), created_at: start, status: "pending", waiter: waiters.sample, kitchen:)
  o.order_items.update_all(status: "done", done_at: start + 15.minutes)
  o.update!(status: "completed", confirmed_by: waiters.sample, confirmed_at: start + 2.minutes,
            ready_at: start + 15.minutes, completed_at: start + 60.minutes)
end

open_session = ->(t, minutes_ago) do
  t.update!(status: "occupied")
  t.table_sessions.create!(opened_at: now - minutes_ago.minutes)
end

# Bàn 1: khách vừa đặt, chờ xác nhận
s1 = open_session.(tables[0], 5)
build_order(s1, random_lines(menu, 3), created_at: now - 2.minutes, status: "pending", waiter: nil, kitchen:)

# Bàn 2: đã xác nhận, chờ bếp
s2 = open_session.(tables[1], 15)
o2 = build_order(s2, random_lines(menu, 4), created_at: now - 10.minutes, status: "confirmed", waiter: waiters[0], kitchen:)
o2.update!(status: "confirmed")

# Bàn 3: đang nấu, 1 món xong, 1 món hết
s3 = open_session.(tables[2], 30)
o3 = build_order(s3, random_lines(menu, 4), created_at: now - 20.minutes, status: "confirmed", waiter: waiters[1], kitchen:)
items = o3.order_items.to_a
items[0].update!(status: "done", done_at: now - 5.minutes)
items[1].update!(status: "cooking")
items[2].update!(status: "out_of_stock")
o3.update!(status: "preparing")
o3.recalculate_total!

# Bàn 4: sẵn sàng mang ra + gọi thêm 1 đơn chờ xác nhận
s4 = open_session.(tables[3], 45)
o4 = build_order(s4, random_lines(menu, 3), created_at: now - 40.minutes, status: "confirmed", waiter: waiters[0], kitchen:)
o4.order_items.update_all(status: "done", done_at: now - 8.minutes)
o4.update!(status: "ready", ready_at: now - 8.minutes)
build_order(s4, random_lines(menu, 1), created_at: now - 1.minute, status: "pending", waiter: nil, kitchen:)

# Bàn 5: ăn xong, gọi nhân viên thanh toán
s5 = open_session.(tables[4], 70)
o5 = build_order(s5, random_lines(menu, 5), created_at: now - 65.minutes, status: "confirmed", waiter: waiters[1], kitchen:)
o5.order_items.update_all(status: "done", done_at: now - 45.minutes)
o5.update!(status: "ready", ready_at: now - 45.minutes)
s5.staff_calls.create!

puts "Đặt bàn..."
tables = Table.ordered.index_by(&:number)
waiter_an = User.find_by!(email: "waiter@demo.vn")
soon = (now + 40.minutes).change(sec: 0)
evening = now.change(hour: 19, min: 0)
evening += 1.day if evening < now + 2.hours
[
  [tables[9], "Anh Minh", "0903111222", 4, soon, "Sắp đến — bàn hiện giữ chỗ"],
  [tables[10], "Chị Lan", "0912333444", 6, evening, "Sinh nhật, chuẩn bị bánh"],
  [tables[6], "Anh Tuấn", "0987555666", 2, evening + 30.minutes, nil],
  [tables[1], "Cô Hoa", "0909777888", 8, evening + 1.day, "Gộp 2 bàn nếu đông"]
].each do |table, name, phone, size, at, note|
  Reservation.create!(table:, customer_name: name, phone:, party_size: size, reserved_at: at, note:, created_by: waiter_an)
end

puts "Khuyến mãi..."
drinks = Category.find_by!(name: "Đồ uống")
Promotion.create!(name: "Happy hour đồ uống", percent: 20, category_ids: [drinks.id], start_time: "14:00", end_time: "18:00")
Promotion.create!(name: "Giờ vàng cuối tuần", percent: 10, start_time: "21:00", end_time: "23:00", weekdays: [5, 6, 0])
Voucher.create!(code: "KM10", kind: "percent", value: 10, max_discount: 50_000, min_spend: 300_000, note: "Khách quen")
Voucher.create!(code: "GIAM50K", kind: "amount", value: 50_000, min_spend: 500_000, usage_limit: 100, ends_at: 30.days.from_now.end_of_day)
Voucher.create!(code: "KHAITRUONG", kind: "percent", value: 20, ends_at: 10.days.ago, note: "Đã hết hạn")

puts "Xong: #{User.count} users, #{Table.count} bàn, #{MenuItem.count} món, #{Order.count} đơn"
puts "Đăng nhập (mật khẩu: password): owner@demo.vn, manager@demo.vn, waiter@demo.vn, kitchen@demo.vn"
puts "PIN: owner 9630, manager 2580, waiter 2468, waiter2 3690, kitchen 1470"
