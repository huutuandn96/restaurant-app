# Đặt bàn trước (SPEC §5.5)
class Reservation < ApplicationRecord
  STATUSES = %w[booked arrived cancelled no_show].freeze
  # Một lượt đặt chiếm bàn trong khoảng này (dùng để chặn đặt trùng)
  DURATION = ENV.fetch("RESERVATION_DURATION_MINUTES", 120).to_i.minutes
  # Bàn hiện "giữ chỗ" trên sơ đồ từ trước giờ đến ... và tới sau giờ đến ...
  HOLD_BEFORE = ENV.fetch("RESERVATION_HOLD_MINUTES", 60).to_i.minutes
  LATE_AFTER = 30.minutes

  belongs_to :table
  belongs_to :created_by, class_name: "User", optional: true
  belongs_to :table_session, optional: true

  enum :status, STATUSES.index_by(&:itself), validate: true

  validates :customer_name, :phone, :reserved_at, presence: true
  validates :phone, format: { with: /\A[0-9+ .-]{8,15}\z/, message: "không hợp lệ" }
  validates :party_size, numericality: { only_integer: true, greater_than: 0, less_than_or_equal_to: 100 }
  validate :not_in_past, on: :create
  validate :no_overlap, if: -> { booked? && (new_record? || will_save_change_to_reserved_at? || will_save_change_to_table_id? || will_save_change_to_status?) }

  scope :on_date, ->(date) { where(reserved_at: date.all_day) }
  # Đang giữ bàn: còn booked và giờ đến trong [now - LATE_AFTER, now + HOLD_BEFORE]
  scope :holding, ->(now = Time.current) { booked.where(reserved_at: (now - LATE_AFTER)..(now + HOLD_BEFORE)) }

  def late?(now = Time.current) = booked? && reserved_at < now

  private

  def not_in_past
    errors.add(:reserved_at, "đã qua") if reserved_at && reserved_at < 5.minutes.ago
  end

  def no_overlap
    clash = Reservation.booked.where(table_id:).where.not(id:)
                       .where(reserved_at: (reserved_at - DURATION + 1.second)..(reserved_at + DURATION - 1.second))
                       .order(:reserved_at).first
    return unless clash

    errors.add(:base, "#{table.label} đã có khách đặt lúc #{clash.reserved_at.strftime('%H:%M %d/%m')} (#{clash.customer_name})")
  end
end
