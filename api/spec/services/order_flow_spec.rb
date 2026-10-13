require "rails_helper"

RSpec.describe "Order flow" do
  let(:table) { create(:table) }
  let(:waiter) { create(:user) }
  let(:cook) { create(:user, :kitchen) }
  let(:manager) { create(:user, :manager) }
  let(:pho) { create(:menu_item, name: "Phở", price: 65_000) }
  let(:tra) { create(:menu_item, name: "Trà đá", price: 5_000) }
  let(:session) { TableSessions::Open.call(table) }

  def place_order
    Orders::Create.call(session, items: [{ menu_item_id: pho.id, quantity: 2 }, { menu_item_id: tra.id, quantity: 3 }])
  end

  describe TableSessions::Open do
    it "tạo session với verify code 3 số và dùng lại khi quét lần nữa" do
      expect(session.verify_code).to match(/\A\d{3}\z/)
      expect(TableSessions::Open.call(table)).to eq(session)
      expect(table.reload).to be_occupied
    end
  end

  describe Orders::Create do
    it "snapshot giá, tính tổng và gắn bàn từ session" do
      order = place_order
      expect(order).to be_pending
      expect(order.table).to eq(table)
      expect(order.total).to eq(65_000 * 2 + 5_000 * 3)
      pho.update!(price: 99_000)
      expect(order.order_items.first.reload.price_snapshot).to eq(65_000)
      expect(RealtimeSpy.events.map { |e| e[:event] }).to include("order.created")
    end

    it "từ chối món đã hết" do
      tra.update!(available: false)
      expect { place_order }.to raise_error(ServiceError, /đã hết/)
    end

    it "từ chối khi session đã đóng" do
      session.update!(status: "closed")
      expect { place_order }.to raise_error(ServiceError) { |e| expect(e.status).to eq(:gone) }
    end
  end

  describe Orders::Transition do
    it "phục vụ xác nhận → gửi tới bếp" do
      order = Orders::Transition.call(place_order, action: "confirm", user: waiter)
      expect(order).to be_confirmed
      expect(order.confirmed_by).to eq(waiter)
      confirmed = RealtimeSpy.events.find { |e| e[:event] == "order.confirmed" }
      expect(confirmed[:rooms]).to include("kitchen")
    end

    it "chưa xác nhận thì bếp không nhận; đã xác nhận rồi huỷ thì bếp vẫn nhận để gỡ khỏi board" do
      order = place_order
      expect(RealtimeSpy.events.last[:rooms]).not_to include("kitchen")
      Orders::Transition.call(order, action: "confirm", user: waiter)
      Orders::Transition.call(order, action: "cancel", user: waiter)
      expect(RealtimeSpy.events.last[:rooms]).to include("kitchen")
    end

    it "không cho xác nhận lại đơn đã xác nhận" do
      order = Orders::Transition.call(place_order, action: "confirm", user: waiter)
      expect { Orders::Transition.call(order, action: "confirm", user: waiter) }.to raise_error(ServiceError)
    end

    it "bếp done cả order" do
      order = Orders::Transition.call(place_order, action: "confirm", user: waiter)
      Orders::Transition.call(order, action: "done", user: cook)
      expect(order.reload).to be_ready
      expect(order.order_items.map(&:status).uniq).to eq(["done"])
    end

    it "chỉ manager được đổi trạng thái thủ công" do
      order = place_order
      expect { Orders::Transition.call(order, action: "set_status", user: waiter, status: "completed") }
        .to raise_error(ServiceError)
      Orders::Transition.call(order, action: "set_status", user: manager, status: "completed")
      expect(order.reload.completed_at).to be_present
      Orders::Transition.call(order, action: "set_status", user: manager, status: "cancelled", reason: "Khách bỏ về")
      expect(order.reload.cancel_reason).to eq("Khách bỏ về")
    end
  end

  describe Orders::UpdateItem do
    let(:order) { Orders::Transition.call(place_order, action: "confirm", user: waiter) }

    it "done từng món: confirmed → preparing → ready" do
      a, b = order.order_items.to_a
      Orders::UpdateItem.call(a, status: "done", user: cook)
      expect(order.reload).to be_preparing
      Orders::UpdateItem.call(b, status: "done", user: cook)
      expect(order.reload).to be_ready
    end

    it "hết món: trừ tiền và có thể tắt món trên menu" do
      _, b = order.order_items.to_a
      Orders::UpdateItem.call(b, status: "out_of_stock", user: cook, mark_menu_unavailable: true)
      expect(order.reload.total).to eq(130_000)
      expect(tra.reload.available).to be(false)
    end

    it "không cho bếp làm món của đơn chưa xác nhận" do
      pending = place_order
      expect { Orders::UpdateItem.call(pending.order_items.first, status: "done", user: cook) }
        .to raise_error(ServiceError)
    end
  end

  describe TableSessions::Checkout do
    it "đóng bàn: completed đơn đã xác nhận, huỷ đơn pending, giữ nguyên QR" do
      confirmed = Orders::Transition.call(place_order, action: "confirm", user: waiter)
      pending = place_order
      qr = table.qr_token

      TableSessions::Checkout.call(table, user: waiter)

      expect(confirmed.reload).to be_completed
      expect(pending.reload).to be_cancelled
      expect(session.reload).to be_closed
      expect(table.reload).to be_available
      expect(table.qr_token).to eq(qr)

      next_session = TableSessions::Open.call(table)
      expect(next_session).not_to eq(session)
    end
  end

  describe Reports::Revenue do
    it "chỉ tính đơn completed, nhóm theo ngày" do
      o1 = place_order
      o1.update!(status: "completed", completed_at: Time.zone.parse("2026-10-01 12:00"))
      o2 = place_order
      o2.update!(status: "cancelled")

      r = Reports::Revenue.call(from: Date.new(2026, 10, 1), to: Date.new(2026, 10, 31))
      expect(r[:rows]).to eq([{ period: "2026-10-01", orders: 1, revenue: 145_000 }])
      csv = Reports::Revenue.new(from: Date.new(2026, 10, 1), to: Date.new(2026, 10, 31)).to_csv
      expect(csv).to start_with("﻿Ngày")
    end
  end
end
