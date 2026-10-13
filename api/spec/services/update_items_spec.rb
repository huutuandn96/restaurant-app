require "rails_helper"

RSpec.describe Orders::UpdateItems do
  let(:waiter) { create(:user) }
  let(:cook) { create(:user, :kitchen) }
  let(:pho) { create(:menu_item, name: "Phở", price: 65_000) }
  let(:tra) { create(:menu_item, name: "Trà đá", price: 5_000) }

  def confirmed_order(number, lines)
    session = TableSessions::Open.call(create(:table, number:))
    o = Orders::Create.call(session, items: lines.map { |m, q| { menu_item_id: m.id, quantity: q } })
    Orders::Transition.call(o, action: "confirm", user: waiter)
  end

  let!(:a) { confirmed_order(1, [[pho, 2], [tra, 1]]) }
  let!(:b) { confirmed_order(2, [[pho, 1]]) }
  let(:pho_ids) { OrderItem.where(name_snapshot: "Phở").pluck(:id) }

  it "xong một món ở nhiều đơn; đơn chỉ có món đó → ready, đơn còn món khác → preparing" do
    described_class.call(pho_ids, status: "done", user: cook)
    expect(b.reload).to be_ready
    expect(a.reload).to be_preparing
    expect(RealtimeSpy.events.count { |e| e[:event] == "order_item.updated" }).to eq(2)
  end

  it "báo hết cả món: trừ tiền mọi đơn, ẩn món khỏi menu" do
    described_class.call(pho_ids, status: "out_of_stock", user: cook, mark_menu_unavailable: true)
    expect(a.reload.total).to eq(5_000)
    expect(pho.reload).not_to be_available
  end

  it "từ chối nếu có món thuộc đơn chưa xác nhận" do
    session = TableSessions::Open.call(create(:table, number: 3))
    pending = Orders::Create.call(session, items: [{ menu_item_id: pho.id, quantity: 1 }])
    expect { described_class.call(pho_ids + pending.order_items.ids, status: "done", user: cook) }
      .to raise_error(ServiceError, /chưa xác nhận/)
    expect(OrderItem.where(id: pho_ids).pluck(:status).uniq).to eq(["pending"])
  end

  it "API batch: bếp dùng được, phục vụ bị chặn", type: :request do
    patch "/api/v1/staff/order_items/batch", params: { ids: pho_ids, status: "cooking" },
                                             headers: { "Authorization" => "Bearer #{AuthToken.issue_user(waiter)}" }, as: :json
    expect(response).to have_http_status(:forbidden)

    patch "/api/v1/staff/order_items/batch", params: { ids: pho_ids, status: "cooking" },
                                             headers: { "Authorization" => "Bearer #{AuthToken.issue_user(cook)}" }, as: :json
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body.size).to eq(2)
    expect(OrderItem.where(id: pho_ids).pluck(:status).uniq).to eq(["cooking"])
  end
end
