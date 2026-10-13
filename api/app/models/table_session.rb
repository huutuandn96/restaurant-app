class TableSession < ApplicationRecord
  belongs_to :table
  belongs_to :closed_by, class_name: "User", optional: true
  belongs_to :merged_into, class_name: "TableSession", optional: true
  has_many :orders, dependent: :restrict_with_error
  has_many :staff_calls, dependent: :destroy

  enum :status, { open: "open", closed: "closed" }, validate: true

  validates :session_token, presence: true, uniqueness: true
  validates :verify_code, presence: true, format: { with: /\A\d{3}\z/ }

  before_validation :assign_tokens, on: :create

  # Token khách → phiên hiện hành. Phiên đã bị gộp thì đi theo merged_into (SPEC §2.5)
  def self.resolve(token)
    s = token.presence && includes(:table).find_by(session_token: token)
    5.times do
      break unless s&.closed? && s.merged_into_id
      s = s.merged_into
    end
    s
  end

  def total
    orders.where.not(status: "cancelled").sum(:total)
  end

  private

  def assign_tokens
    self.session_token ||= SecureRandom.urlsafe_base64(24)
    self.verify_code ||= format("%03d", SecureRandom.random_number(1000))
    self.opened_at ||= Time.current
  end
end
