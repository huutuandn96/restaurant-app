require "rails_helper"

RSpec.describe "Khuyến mãi" do
  let(:waiter) { create(:user) }
  let(:manager) { create(:user, :manager) }
  let(:drinks) { create(:category, name: "Đồ uống") }
  let(:bia) { create(:menu_item, name: "Bia", price: 30_000, category: drinks) }
  let(:pho) { create(:menu_item, name: "Phở", price: 100_000) }
  let(:table) { create(:table) }
  let(:session) { TableSessions::Open.call(table) }
  let(:at_17) { Time.zone.local(2026, 10, 14, 17, 30) } # thứ Tư

  def order(*lines)
    o = Orders::Create.call(session, items: lines.map { |m, q| { menu_item_id: m.id, quantity: q } })
    Orders::Transition.call(o, action: "confirm", user: waiter)
  end

  describe Promotion do
    let(:hh) { Promotion.create!(name: "Happy hour", percent: 20, category_ids: [drinks.id], start_time: "16:00", end_time: "18:00", weekdays: [1, 2, 3, 4, 5]) }

    it "chạy đúng khung giờ + ngày trong tuần, khung qua nửa đêm" do
      expect(hh.running?(at_17)).to be(true)
      expect(hh.running?(at_17.change(hour: 18))).to be(false)
      expect(hh.running?(at_17 + 4.days)).to be(false) # Chủ nhật
      night = Promotion.new(name: "Đêm", percent: 10, start_time: "22:00", end_time: "02:00", weekdays: [3], active: true)
      expect(night.running?(at_17.change(hour: 23))).to be(true)
      expect(night.running?(at_17.change(hour: 1) + 1.day)).to be(true) # rạng sáng thứ Năm thuộc đêm thứ Tư
    end

    it "giá menu + giá snapshot trên đơn là giá đã giảm, giữ giá gốc" do
      hh
      travel_to(at_17) do
        p = Promotions::Pricing.new.for(bia)
        expect([p.price, p.original_price]).to eq([24_000, 30_000])
        expect(Promotions::Pricing.new.for(pho).original_price).to be_nil
        item = order([bia, 2]).order_items.first
        expect([item.price_snapshot, item.original_price, item.promotion_name]).to eq([24_000, 30_000, "Happy hour -20%"])
      end
    end
  end

  describe "giảm giá hoá đơn" do
    let!(:v10) { Voucher.create!(code: "km10", kind: "percent", value: 10, max_discount: 15_000, min_spend: 100_000) }

    it "voucher % có trần, giảm tay tính trên phần còn lại, thanh toán phân bổ về đơn + trừ lượt" do
      order([pho, 1])
      order([pho, 1])
      Discounts::Apply.call(session, user: manager, voucher_code: " Km10 ", manual_kind: "amount", manual_value: 20_000, reason: "Khách quen")
      calc = Discounts::Calculate.call(session.reload)
      expect(calc[:discounts].map { |d| d[:amount] }).to eq([15_000, 20_000])
      expect(calc[:total]).to eq(165_000)

      closed = TableSessions::Checkout.call(table, user: waiter)
      expect(closed.discount_total).to eq(35_000)
      expect(closed.orders.sum(:discount)).to eq(35_000)
      expect(v10.reload.used_count).to eq(1)
      expect(Reports::Revenue.call(from: Date.current, to: Date.current)[:total_revenue]).to eq(165_000)
    end

    it "voucher chưa đạt đơn tối thiểu → không giảm, báo lý do" do
      order([bia, 1])
      Discounts::Apply.call(session, user: waiter, voucher_code: "KM10")
      line = Discounts::Calculate.call(session.reload)[:discounts].first
      expect(line[:amount]).to eq(0)
      expect(line[:error]).to include("Đơn tối thiểu 100.000đ")
    end

    it "voucher hết lượt / hết hạn bị từ chối" do
      Voucher.create!(code: "HET", kind: "amount", value: 10_000, usage_limit: 1, used_count: 1)
      Voucher.create!(code: "CU1", kind: "amount", value: 10_000, ends_at: 1.day.ago)
      order([pho, 1])
      expect { Discounts::Apply.call(session, user: waiter, voucher_code: "HET") }.to raise_error(ServiceError, /hết lượt/)
      expect { Discounts::Apply.call(session, user: waiter, voucher_code: "CU1") }.to raise_error(ServiceError, /hết hạn/)
      expect { Discounts::Apply.call(session, user: waiter, voucher_code: "KHONGCO") }.to raise_error(ServiceError, /Không tìm thấy/)
    end

    it "phục vụ giảm tay tối đa 10%, cần lý do; quản lý không giới hạn" do
      order([pho, 1])
      expect { Discounts::Apply.call(session, user: waiter, manual_kind: "percent", manual_value: 20, reason: "x") }
        .to raise_error(ServiceError, /tối đa 10%/)
      expect { Discounts::Apply.call(session, user: waiter, manual_kind: "amount", manual_value: 5_000) }
        .to raise_error(ServiceError, /lý do/)
      Discounts::Apply.call(session, user: manager, manual_kind: "percent", manual_value: 50, reason: "Đền bù món lỗi")
      expect(Bills::Build.call(session.reload)[:total]).to eq(50_000)
    end
  end

  describe "API", type: :request do
    def auth(u) = { "Authorization" => "Bearer #{AuthToken.issue_user(u)}" }

    it "manager tạo voucher + happy hour; waiter áp mã qua bill" do
      post "/api/v1/manage/vouchers", params: { code: "giam20k", kind: "amount", value: 20_000 }, headers: auth(manager), as: :json
      expect(response.parsed_body["code"]).to eq("GIAM20K")
      post "/api/v1/manage/promotions", params: { name: "Trưa", percent: 10, start_time: "11:00", end_time: "13:00" }, headers: auth(manager), as: :json
      expect(response).to have_http_status(:created)
      post "/api/v1/manage/vouchers", params: { code: "x" }, headers: auth(waiter), as: :json
      expect(response).to have_http_status(:forbidden)

      order([pho, 1])
      put "/api/v1/staff/table_sessions/#{session.id}/discount", params: { voucher_code: "giam20k" }, headers: auth(waiter), as: :json
      expect(response.parsed_body.slice("subtotal", "discount_total", "total")).to eq("subtotal" => 100_000, "discount_total" => 20_000, "total" => 80_000)
    end
  end
end
