class Order < ApplicationRecord
  STATUSES = %w[pending confirmed preparing ready completed cancelled].freeze
  ACTIVE_STATUSES = %w[pending confirmed preparing ready].freeze
  KITCHEN_STATUSES = %w[confirmed preparing ready].freeze

  belongs_to :table
  belongs_to :table_session
  belongs_to :confirmed_by, class_name: "User", optional: true
  has_many :order_items, -> { order(:id) }, dependent: :destroy, inverse_of: :order
  has_many :order_events, -> { order(:created_at, :id) }, dependent: :destroy

  enum :status, STATUSES.index_by(&:itself), validate: true

  validates :code, presence: true, uniqueness: true

  before_validation :assign_code, on: :create

  scope :today, -> { where(created_at: Time.current.all_day) }
  scope :active, -> { where(status: ACTIVE_STATUSES) }

  def recalculate_total!
    update!(total: order_items.reject(&:out_of_stock?).sum { |i| i.price_snapshot * i.quantity })
  end

  def log_event!(action, user: nil, from: nil, to: nil, data: {})
    order_events.create!(action:, user:, from_status: from, to_status: to, data:, created_at: Time.current)
  end

  private

  def assign_code
    self.code ||= loop do
      c = SecureRandom.alphanumeric(6).upcase
      break c unless Order.exists?(code: c)
    end
  end
end
