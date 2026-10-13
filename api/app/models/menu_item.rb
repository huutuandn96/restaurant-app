class MenuItem < ApplicationRecord
  IMAGE_TYPES = %w[image/jpeg image/png image/webp image/heic image/heif].freeze
  IMAGE_MAX_SIZE = 5.megabytes

  belongs_to :category
  has_many :order_items, dependent: :restrict_with_error

  # Lưu trên S3 (local: RustFS) — SPEC D9
  # format phải là String: transformations đi qua URL proxy bị decode thành String,
  # nếu khai báo Symbol thì digest lệch → ảnh bị resize + lưu S3 lần 2 khi có người xem.
  has_one_attached :image do |a|
    a.variant :card, resize_to_fill: [480, 360], format: "webp", saver: { quality: 80 }, preprocessed: true
  end

  validates :name, presence: true
  validates :price, presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validate :image_is_valid

  scope :ordered, -> { order(:position, :id) }
  scope :available, -> { where(available: true) }

  # URL tương đối qua Rails proxy (không cần host, dùng được trong realtime payload).
  # Ưu tiên ảnh upload; không có thì dùng image_url (link ngoài) nếu có.
  def image_path
    return image_url.presence unless image.attached?

    Rails.application.routes.url_helpers.rails_storage_proxy_path(image.variant(:card), only_path: true)
  end

  private

  def image_is_valid
    return unless image.attached? && image.blob.new_record?

    errors.add(:image, "chỉ nhận JPG, PNG, WEBP, HEIC") unless IMAGE_TYPES.include?(image.blob.content_type)
    errors.add(:image, "tối đa 5MB") if image.blob.byte_size > IMAGE_MAX_SIZE
  end
end
