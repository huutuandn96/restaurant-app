# Máy dùng chung (iPad bếp, điện thoại quầy) được quản lý ghi danh để đăng nhập bằng PIN (SPEC §4.1).
# Máy giữ token ngẫu nhiên (localStorage); server chỉ lưu SHA-256 của token.
class Device < ApplicationRecord
  belongs_to :registered_by, class_name: "User"

  validates :name, presence: true, length: { maximum: 50 }
  validates :lock_minutes, numericality: { only_integer: true, greater_than: 0, less_than_or_equal_to: 240 }, allow_nil: true

  scope :active, -> { where(revoked_at: nil) }

  def self.digest(token) = Digest::SHA256.hexdigest(token.to_s)

  def self.register!(name:, user:, lock_minutes: nil)
    token = SecureRandom.urlsafe_base64(32)
    [create!(name:, registered_by: user, lock_minutes:, token_digest: digest(token)), token]
  end

  def self.find_by_token(token)
    token.present? ? active.find_by(token_digest: digest(token)) : nil
  end
end
