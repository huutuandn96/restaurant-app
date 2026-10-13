require "rails_helper"

RSpec.describe Table, "#qr_url" do
  let(:table) { Table.new(number: 1, qr_token: "abc") }

  around do |ex|
    old = ENV.to_h.slice("PUBLIC_URL", "LAN_IP", "WEB_PORT")
    ex.run
  ensure
    %w[PUBLIC_URL LAN_IP WEB_PORT].each { |k| ENV[k] = old[k] }
  end

  it "dùng LAN_IP:WEB_PORT khi không có PUBLIC_URL" do
    ENV["PUBLIC_URL"] = nil
    ENV["LAN_IP"] = "192.168.1.5"
    ENV["WEB_PORT"] = "5173"
    expect(table.qr_url).to eq("http://192.168.1.5:5173/t/abc")
  end

  it "ưu tiên PUBLIC_URL (bỏ / cuối)" do
    ENV["PUBLIC_URL"] = "https://order.nhahang.vn/"
    expect(table.qr_url).to eq("https://order.nhahang.vn/t/abc")
  end
end
