# Mã voucher nhập khi thanh toán (SPEC §5.6)
class Voucher < ApplicationRecord
  KINDS = %w[percent amount].freeze

  has_many :table_sessions, dependent: :restrict_with_error

  before_validation { self.code = code.to_s.strip.upcase }

  validates :code, presence: true, uniqueness: true, format: { with: /\A[A-Z0-9_-]{3,20}\z/, message: "chỉ gồm chữ, số, - _ (3–20 ký tự)" }
  validates :kind, inclusion: { in: KINDS }
  validates :value, numericality: { only_integer: true, greater_than: 0 }
  validates :value, numericality: { less_than_or_equal_to: 100 }, if: -> { kind == "percent" }
  validates :min_spend, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :max_discount, :usage_limit, numericality: { only_integer: true, greater_than: 0 }, allow_nil: true

  # Lý do không dùng được (nil = dùng được) — chưa xét đơn tối thiểu
  def unusable_reason(now = Time.current)
    return "Mã #{code} đã bị tắt" unless active
    return "Mã #{code} chưa đến ngày áp dụng" if starts_at && now < starts_at
    return "Mã #{code} đã hết hạn" if ends_at && now > ends_at
    return "Mã #{code} đã hết lượt dùng" if usage_limit && used_count >= usage_limit

    nil
  end

  def discount_for(subtotal)
    return 0 if subtotal < min_spend

    raw = kind == "percent" ? subtotal * value / 100 : value
    raw = [raw, max_discount].min if max_discount
    [raw, subtotal].min
  end
end
