require "rails_helper"

RSpec.describe "Upload ảnh món (manage)", type: :request do
  let!(:manager) { create(:user, :manager, email: "m@test.vn") }
  let(:item) { create(:menu_item) }
  let(:token) do
    post "/api/v1/auth/login", params: { email: "m@test.vn", password: "password" }, as: :json
    response.parsed_body["token"]
  end
  let(:auth) { { "Authorization" => "Bearer #{token}" } }

  it "upload multipart → trả image_url proxy, menu public cũng thấy" do
    patch "/api/v1/manage/menu_items/#{item.id}", headers: auth,
          params: { image: fixture_file_upload("dish.png", "image/png") }
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body["image_url"]).to start_with("/rails/active_storage/representations/proxy/")

    get "/api/v1/public/menu"
    url = response.parsed_body["categories"][0]["items"][0]["image_url"]
    expect(url).to start_with("/rails/active_storage/")
  end

  it "upload file sai định dạng → 422" do
    patch "/api/v1/manage/menu_items/#{item.id}", headers: auth,
          params: { image: fixture_file_upload("bad.txt", "text/plain") }
    expect(response).to have_http_status(:unprocessable_entity)
    expect(item.reload.image).not_to be_attached
  end

  it "xoá ảnh" do
    item.image.attach(io: File.open(Rails.root.join("spec/fixtures/files/dish.png")), filename: "d.png", content_type: "image/png")
    patch "/api/v1/manage/menu_items/#{item.id}", headers: auth, params: { remove_image: true }, as: :json
    expect(response.parsed_body["image_url"]).to be_nil
  end
end
