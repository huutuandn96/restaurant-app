require "rails_helper"

RSpec.describe Bills::Build do
  let(:table) { create(:table, number: 6) }
  let(:waiter) { create(:user, name: "Phục vụ An") }
  let(:cook) { create(:user, :kitchen) }
  let(:pho) { create(:menu_item, name: "Phở", price: 65_000) }
  let(:tra) { create(:menu_item, name: "Trà đá", price: 5_000) }
  let(:nem) { create(:menu_item, name: "Nem", price: 40_000) }
  let(:session) { TableSessions::Open.call(table) }

  def order(*lines)
    Orders::Create.call(session, items: lines.map { |m, q| { menu_item_id: m.id, quantity: q } })
  end

  def confirm(o) = Orders::Transition.call(o, action: "confirm", user: waiter)

  it "gộp món trùng giữa các đơn, bỏ món hết và đơn huỷ, tổng khớp session" do
    confirm(order([pho, 2], [tra, 1]))
    second = confirm(order([pho, 1], [nem, 1]))
    Orders::UpdateItem.call(second.order_items.find_by(name_snapshot: "Nem"), status: "out_of_stock", user: cook)
    Orders::Transition.call(order([tra, 5]), action: "cancel", user: waiter, reason: "nhầm")

    bill = described_class.call(session.reload)
    expect(bill[:provisional]).to be(true)
    expect(bill[:lines]).to contain_exactly(
      { name: "Phở", price: 65_000, quantity: 3, amount: 195_000 },
      { name: "Trà đá", price: 5_000, quantity: 1, amount: 5_000 }
    )
    expect(bill[:total]).to eq(200_000).and eq(session.total)
    expect(bill[:bill_no]).to eq(format("HD%06d", session.id))
    expect(bill[:table][:label]).to eq("Bàn 06")
  end

  it "sau khi đóng bàn: hoá đơn chính thức, có thu ngân" do
    confirm(order([pho, 1]))
    closed = TableSessions::Checkout.call(table, user: waiter)
    bill = described_class.call(closed)
    expect(bill[:provisional]).to be(false)
    expect(bill[:cashier]).to eq("Phục vụ An")
    expect(bill[:total]).to eq(65_000)
  end

  describe "API", type: :request do
    def token(user) = AuthToken.issue_user(user)

    it "waiter in được; bếp bị chặn; checkout trả closed_session_id" do
      confirm(order([pho, 1]))
      get "/api/v1/staff/table_sessions/#{session.id}/bill", headers: { "Authorization" => "Bearer #{token(waiter)}" }
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["lines"].first["name"]).to eq("Phở")

      get "/api/v1/staff/table_sessions/#{session.id}/bill", headers: { "Authorization" => "Bearer #{token(cook)}" }
      expect(response).to have_http_status(:forbidden)

      post "/api/v1/staff/tables/#{table.id}/checkout", headers: { "Authorization" => "Bearer #{token(waiter)}" }
      expect(response.parsed_body["closed_session_id"]).to eq(session.id)
    end
  end
end
