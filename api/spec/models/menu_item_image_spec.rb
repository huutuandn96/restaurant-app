require "rails_helper"

RSpec.describe MenuItem, "image" do
  let(:item) { create(:menu_item) }
  let(:png) { Rails.root.join("spec/fixtures/files/dish.png") }

  it "không có ảnh → dùng image_url (có thể nil)" do
    expect(item.image_path).to be_nil
    item.update!(image_url: "https://cdn.example.com/a.jpg")
    expect(item.image_path).to eq("https://cdn.example.com/a.jpg")
  end

  it "có ảnh upload → URL proxy tương đối (dùng được trong realtime, không cần host)" do
    item.image.attach(io: File.open(png), filename: "dish.png", content_type: "image/png")
    expect(item.image_path).to start_with("/rails/active_storage/representations/proxy/")
  end

  it "variant từ model và từ URL có cùng digest (không resize 2 lần)" do
    item.image.attach(io: File.open(png), filename: "dish.png", content_type: "image/png")
    variation = item.image.variant(:card).variation
    expect(ActiveStorage::Variation.decode(variation.key).digest).to eq(variation.digest)
  end

  it "từ chối file không phải ảnh" do
    item.image.attach(io: StringIO.new("x"), filename: "bad.txt", content_type: "text/plain")
    expect(item).not_to be_valid
    expect(item.errors[:image].join).to include("JPG")
  end

  it "từ chối ảnh > 5MB" do
    item.image.attach(io: StringIO.new("0" * (5.megabytes + 1)), filename: "big.png", content_type: "image/png")
    expect(item).not_to be_valid
    expect(item.errors[:image].join).to include("5MB")
  end
end
