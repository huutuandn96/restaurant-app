require "rails_helper"

RSpec.describe "Đăng nhập PIN", type: :request do
  let(:manager) { create(:user, :manager) }
  let(:waiter) { create(:user, name: "Phục vụ An").tap { |u| u.pin = "2580"; u.save! } }
  let(:pw_token) do
    post "/api/v1/auth/login", params: { email: manager.email, password: "password" }, as: :json
    response.parsed_body["token"]
  end
  let(:device_token) do
    post "/api/v1/staff/devices", params: { name: "iPad bếp", lock_minutes: 15 }, headers: { "Authorization" => "Bearer #{pw_token}" }, as: :json
    response.parsed_body["device_token"]
  end
  let(:dev) { { "X-Device-Token" => device_token } }

  def pin_login(pin, user: waiter)
    post "/api/v1/auth/pin", params: { user_id: user.id, pin: }, headers: dev, as: :json
  end

  it "máy đã ghi danh: thấy danh sách nhân viên có PIN, đăng nhập được vào Staff" do
    waiter
    get "/api/v1/auth/pin/users", headers: dev
    expect(response.parsed_body["users"].map { |u| u["name"] }).to eq(["Phục vụ An"])
    expect(response.parsed_body["device"]["lock_minutes"]).to eq(15)

    pin_login("2580")
    expect(response).to have_http_status(:ok)
    token = response.parsed_body["token"]
    get "/api/v1/staff/tables", headers: { "Authorization" => "Bearer #{token}" }
    expect(response).to have_http_status(:ok)
  end

  it "máy lạ / token sai không dùng PIN được" do
    waiter
    get "/api/v1/auth/pin/users", headers: { "X-Device-Token" => "bừa" }
    expect(response).to have_http_status(:unauthorized)
  end

  it "sai 5 lần → khoá 5 phút, kể cả nhập đúng" do
    5.times { pin_login("1111") }
    expect(response.parsed_body["error"]).to include("khoá 5 phút")
    pin_login("2580")
    expect(response).to have_http_status(:locked)
    travel 6.minutes do
      pin_login("2580")
      expect(response).to have_http_status(:ok)
    end
  end

  it "báo số lần còn lại" do
    pin_login("9999")
    expect(response.parsed_body["error"]).to eq("PIN không đúng (còn 4 lần thử)")
  end

  it "quản lý đăng nhập PIN không vào được Manage, không ghi danh được máy" do
    manager.pin = "4826"
    manager.save!
    pin_login("4826", user: manager)
    pin_jwt = response.parsed_body["token"]
    get "/api/v1/manage/dashboard", headers: { "Authorization" => "Bearer #{pin_jwt}" }
    expect(response.parsed_body["error"]).to include("email và mật khẩu")
    post "/api/v1/staff/devices", params: { name: "x" }, headers: { "Authorization" => "Bearer #{pin_jwt}" }, as: :json
    expect(response).to have_http_status(:forbidden)
  end

  it "thu hồi máy → không dùng PIN được nữa" do
    device_token
    delete "/api/v1/staff/devices/#{Device.last.id}", headers: { "Authorization" => "Bearer #{pw_token}" }
    get "/api/v1/auth/pin/users", headers: dev
    expect(response).to have_http_status(:unauthorized)
  end

  it "tự đổi PIN cần mật khẩu; chặn PIN dễ đoán" do
    t = AuthToken.issue_user(waiter)
    put "/api/v1/auth/pin", params: { pin: "7391", password: "sai" }, headers: { "Authorization" => "Bearer #{t}" }, as: :json
    expect(response).to have_http_status(:unauthorized)
    put "/api/v1/auth/pin", params: { pin: "1234", password: "password" }, headers: { "Authorization" => "Bearer #{t}" }, as: :json
    expect(response.parsed_body["error"]).to include("dễ đoán")
    put "/api/v1/auth/pin", params: { pin: "7391", password: "password" }, headers: { "Authorization" => "Bearer #{t}" }, as: :json
    expect(response).to have_http_status(:no_content)
    expect(waiter.reload.verify_pin!("7391")).to be(true)
  end
end
