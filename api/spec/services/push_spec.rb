require "rails_helper"

RSpec.describe "Web Push" do
  let(:waiter) { create(:user) }
  let(:cook) { create(:user, :kitchen) }
  let(:sub_keys) { { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" } }

  around do |ex|
    old = ENV.to_h.slice("VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY")
    k = WebPush.generate_key
    ENV["VAPID_PUBLIC_KEY"] = k.public_key
    ENV["VAPID_PRIVATE_KEY"] = k.private_key
    ex.run
  ensure
    %w[VAPID_PUBLIC_KEY VAPID_PRIVATE_KEY].each { |key| ENV[key] = old[key] }
  end

  describe PushRouter do
    let(:order) { { id: 7, code: "ABC", status: "pending", verify_code: "123", table: { id: 3, label: "Bàn 03" }, items: [{ name: "Phở", quantity: 2 }] } }

    it "đơn mới → phục vụ; gửi bếp → bếp; sẵn sàng → phục vụ; gọi NV → phục vụ" do
      expect(PushRouter.message("order.created", order)).to include(roles: %w[waiter manager owner], title: "🔔 Bàn 03 vừa đặt 2 món", url: "/staff/tables/3")
      expect(PushRouter.message("order.confirmed", order)).to include(roles: %w[kitchen], body: "2× Phở")
      expect(PushRouter.message("order.updated", order.merge(status: "preparing"))).to be_nil
      expect(PushRouter.message("order.updated", order.merge(status: "ready"))).to include(title: "✅ Bàn 03: món đã xong")
      expect(PushRouter.message("table.call_staff", { table: { id: 3, label: "Bàn 03" } })).to include(tag: "call-3")
      expect(PushRouter.message("menu_item.updated", {})).to be_nil
    end

    it "chỉ xếp job khi có khoá VAPID" do
      expect { PushRouter.call("order.created", order) }.to have_enqueued_job(PushNotifyJob)
      ENV["VAPID_PRIVATE_KEY"] = nil
      expect { PushRouter.call("order.created", order) }.not_to have_enqueued_job(PushNotifyJob)
    end
  end

  describe PushNotifyJob do
    it "gửi đúng role, xoá subscription hết hạn" do
      ok = PushSubscription.create!(user: waiter, endpoint: "https://push.example/ok", **sub_keys)
      gone = PushSubscription.create!(user: waiter, endpoint: "https://push.example/gone", **sub_keys)
      PushSubscription.create!(user: cook, endpoint: "https://push.example/cook", **sub_keys)
      sent = []
      allow(WebPush).to receive(:payload_send) do |endpoint:, message:, **|
        raise WebPush::ExpiredSubscription.new(Struct.new(:body).new(""), "push.example") if endpoint.end_with?("gone")

        sent << [endpoint, JSON.parse(message)["title"]]
      end

      PushNotifyJob.perform_now(roles: %w[waiter], title: "Hi", body: "b", url: "/staff")
      expect(sent).to eq([["https://push.example/ok", "Hi"]])
      expect(PushSubscription.exists?(gone.id)).to be(false)
      expect(ok.reload.last_success_at).to be_present
    end
  end

  describe "API", type: :request do
    def auth(u) = { "Authorization" => "Bearer #{AuthToken.issue_user(u)}" }

    it "trả khoá công khai, đăng ký / huỷ; cùng endpoint chuyển sang người đăng nhập sau" do
      get "/api/v1/staff/push", headers: auth(waiter)
      expect(response.parsed_body).to include("enabled" => true, "public_key" => ENV["VAPID_PUBLIC_KEY"])

      body = { endpoint: "https://push.example/dev1", keys: sub_keys }
      post "/api/v1/staff/push", params: body, headers: auth(waiter), as: :json
      expect(response).to have_http_status(:created)
      post "/api/v1/staff/push", params: body, headers: auth(cook), as: :json
      expect(PushSubscription.sole.user).to eq(cook)

      delete "/api/v1/staff/push", params: { endpoint: "https://push.example/dev1" }, headers: auth(cook), as: :json
      expect(PushSubscription.count).to eq(0)
    end
  end
end
