require "rails_helper"

RSpec.describe "Chuyển / gộp bàn" do
  let(:waiter) { create(:user) }
  let(:a) { create(:table, number: 1) }
  let(:b) { create(:table, number: 2) }
  let(:pho) { create(:menu_item, price: 65_000) }

  def order_at(table, qty = 1)
    Orders::Create.call(TableSessions::Open.call(table), items: [{ menu_item_id: pho.id, quantity: qty }])
  end

  describe TableSessions::Move do
    it "chuyển cả phiên sang bàn trống, giữ token + mã, đổi số bàn trên đơn" do
      o = order_at(a)
      session = a.open_session
      TableSessions::Move.call(a, to: b, user: waiter)

      expect(session.reload.table).to eq(b)
      expect(o.reload.table).to eq(b)
      expect(a.reload).to be_available
      expect(b.reload).to be_occupied
      expect(o.order_events.last.action).to eq("move_table")
      expect(RealtimeSpy.events.map { |e| e[:event] }).to include("session.moved", "order.updated")
    end

    it "không chuyển vào bàn đang có khách" do
      order_at(a)
      order_at(b)
      expect { TableSessions::Move.call(a, to: b, user: waiter) }.to raise_error(ServiceError, /Gộp bàn/)
    end
  end

  describe TableSessions::Merge do
    it "dồn đơn + gọi nhân viên vào phiên đích, đóng phiên nguồn, token cũ đi theo" do
      oa = order_at(a, 2)
      ob = order_at(b, 1)
      source = a.open_session
      StaffCall.create!(table_session: source)
      target = TableSessions::Merge.call(a, into: b, user: waiter)

      expect(oa.reload.table_session).to eq(target)
      expect(oa.table).to eq(b)
      expect(target.total).to eq(65_000 * 3)
      expect(target.staff_calls.count).to eq(1)
      expect(source.reload).to be_closed
      expect(source.merged_into).to eq(target)
      expect(a.reload).to be_available
      expect(TableSession.resolve(source.session_token)).to eq(target)
      expect(ob.reload.table_session).to eq(target)
    end

    it "không gộp vào bàn trống" do
      order_at(a)
      expect { TableSessions::Merge.call(a, into: b, user: waiter) }.to raise_error(ServiceError, /Chuyển bàn/)
    end
  end

  describe "API", type: :request do
    def auth(u) = { "Authorization" => "Bearer #{AuthToken.issue_user(u)}" }

    it "khách bàn nguồn sau khi gộp vẫn gọi món tiếp, đơn vào bàn đích; quét lại QR cũ không tạo phiên mới" do
      order_at(a)
      order_at(b)
      old_token = a.open_session.session_token
      post "/api/v1/staff/tables/#{a.id}/merge", params: { into_table_id: b.id }, headers: auth(waiter), as: :json
      expect(response).to have_http_status(:ok)

      get "/api/v1/public/session", headers: { "X-Session-Token" => old_token }
      expect(response.parsed_body["table"]["number"]).to eq(2)
      new_token = response.parsed_body["session_token"]
      expect(new_token).to eq(b.open_session.session_token)

      post "/api/v1/public/orders", params: { items: [{ menu_item_id: pho.id, quantity: 1 }] },
                                    headers: { "X-Session-Token" => old_token }, as: :json
      expect(response.parsed_body["table"]["number"]).to eq(2)

      post "/api/v1/public/tables/#{a.qr_token}/session", headers: { "X-Session-Token" => old_token }
      expect(response.parsed_body["session_token"]).to eq(new_token)
      expect(a.reload).to be_available
    end

    it "bếp không được chuyển bàn" do
      order_at(a)
      post "/api/v1/staff/tables/#{a.id}/move", params: { to_table_id: b.id }, headers: auth(create(:user, :kitchen)), as: :json
      expect(response).to have_http_status(:forbidden)
    end
  end
end
