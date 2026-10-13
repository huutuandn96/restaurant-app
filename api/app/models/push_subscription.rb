class PushSubscription < ApplicationRecord
  belongs_to :user

  validates :endpoint, :p256dh, :auth, presence: true
  validates :endpoint, format: { with: %r{\Ahttps?://}, message: "không hợp lệ" }
end
