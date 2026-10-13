require "rails_helper"

RSpec.describe "Auth & phân quyền", type: :request do
  let!(:waiter) { create(:user, email: "w@test.vn") }
  let!(:owner) { create(:user, :owner, email: "o@test.vn") }

  def token_for(email)
    post "/api/v1/auth/login", params: { email:, password: "password" }, as: :json
    response.parsed_body["token"]
  end

  it "login sai mật khẩu → 401" do
    post "/api/v1/auth/login", params: { email: "w@test.vn", password: "x" }, as: :json
    expect(response).to have_http_status(:unauthorized)
  end

  it "waiter không vào được manage" do
    get "/api/v1/manage/dashboard", headers: { "Authorization" => "Bearer #{token_for('w@test.vn')}" }
    expect(response).to have_http_status(:forbidden)
  end

  it "owner xem được báo cáo" do
    get "/api/v1/manage/reports/revenue", headers: { "Authorization" => "Bearer #{token_for('o@test.vn')}" }
    expect(response).to have_http_status(:ok)
  end

  it "khách không đoán được bàn: qr_token sai → 404" do
    post "/api/v1/public/tables/khongtontai/session"
    expect(response).to have_http_status(:not_found)
  end
end
