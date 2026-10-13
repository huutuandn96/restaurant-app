require "rails_helper"

RSpec.describe "Đặt bàn trước", type: :request do
  let(:waiter) { create(:user) }
  let(:t1) { create(:table, number: 1) }
  let(:t2) { create(:table, number: 2) }
  let(:headers) { { "Authorization" => "Bearer #{AuthToken.issue_user(waiter)}" } }
  let(:at) { Time.zone.now.change(sec: 0) + 3.hours }

  def book(table: t1, time: at, **extra)
    post "/api/v1/staff/reservations", headers:, as: :json,
                                       params: { table_id: table.id, customer_name: "Anh Nam", phone: "0909123456", party_size: 4, reserved_at: time.iso8601, **extra }
  end

  it "tạo lượt đặt, liệt kê theo ngày" do
    book(note: "Sinh nhật")
    expect(response).to have_http_status(:created)
    get "/api/v1/staff/reservations", params: { date: at.to_date.iso8601 }, headers: headers
    expect(response.parsed_body.map { |r| r["customer_name"] }).to eq(["Anh Nam"])
    expect(RealtimeSpy.events.map { |e| e[:event] }).to include("reservation.updated")
  end

  it "chặn đặt trùng bàn trong 2 giờ, bàn khác hoặc cách đủ xa thì được" do
    book
    book(time: at + 90.minutes)
    expect(response).to have_http_status(:unprocessable_entity)
    expect(response.parsed_body["error"]).to include("Bàn 01 đã có khách đặt lúc")
    book(table: t2, time: at + 90.minutes)
    expect(response).to have_http_status(:created)
    book(time: at + 2.hours)
    expect(response).to have_http_status(:created)
  end

  it "báo lỗi tiếng Việt khi thiếu thông tin / giờ đã qua" do
    post "/api/v1/staff/reservations", headers:, as: :json, params: { table_id: t1.id, reserved_at: 2.hours.ago.iso8601, party_size: 0 }
    expect(response.parsed_body["error"]).to include("Tên khách không được để trống", "Giờ đến đã qua", "Số người phải lớn hơn 0")
  end

  it "huỷ thì giờ đó đặt lại được" do
    book
    id = response.parsed_body["id"]
    post "/api/v1/staff/reservations/#{id}/cancel", headers: headers
    expect(response.parsed_body["status"]).to eq("cancelled")
    book
    expect(response).to have_http_status(:created)
  end

  it "khách đến: mở phiên cho bàn; bàn đang có khách khác thì từ chối" do
    book(time: 10.minutes.from_now)
    id = response.parsed_body["id"]
    post "/api/v1/staff/reservations/#{id}/arrive", headers: headers
    expect(response.parsed_body["status"]).to eq("arrived")
    expect(t1.reload.open_session).to be_present
    expect(Reservation.find(id).table_session).to eq(t1.open_session)

    TableSessions::Open.call(t2)
    book(table: t2, time: 20.minutes.from_now)
    post "/api/v1/staff/reservations/#{response.parsed_body['id']}/arrive", headers: headers
    expect(response.parsed_body["error"]).to include("Bàn 02 đang có khách khác")
  end

  it "sơ đồ bàn hiện lượt đặt sắp tới (trong 60 phút) và lượt trễ" do
    book(time: 40.minutes.from_now)
    book(table: t2, time: 5.hours.from_now)
    get "/api/v1/staff/tables", headers: headers
    by_number = response.parsed_body.index_by { |t| t["number"] }
    expect(by_number[1]["reservation"]["customer_name"]).to eq("Anh Nam")
    expect(by_number[2]["reservation"]).to be_nil
  end

  it "bếp không xem được" do
    get "/api/v1/staff/reservations", headers: { "Authorization" => "Bearer #{AuthToken.issue_user(create(:user, :kitchen))}" }
    expect(response).to have_http_status(:forbidden)
  end
end
