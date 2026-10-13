# Happy hour: giảm % món / danh mục trong khung giờ (SPEC §5.6)
class Promotion < ApplicationRecord
  TIME = /\A([01]\d|2[0-3]):[0-5]\d\z/

  validates :name, presence: true
  validates :percent, numericality: { only_integer: true, greater_than: 0, less_than_or_equal_to: 90 }
  validates :start_time, :end_time, format: { with: TIME, message: "phải dạng HH:MM" }
  validate :valid_weekdays

  scope :active, -> { where(active: true) }

  # Đang chạy tại thời điểm now? Khung giờ qua nửa đêm (22:00–02:00) được hỗ trợ.
  def running?(now = Time.current)
    return false unless active
    return false if starts_on && now.to_date < starts_on
    return false if ends_on && now.to_date > ends_on

    hm = now.strftime("%H:%M")
    in_window = start_time <= end_time ? (hm >= start_time && hm < end_time) : (hm >= start_time || hm < end_time)
    # Khung qua nửa đêm: phần sau 0h thuộc ngày hôm trước
    day = start_time > end_time && hm < end_time ? (now - 1.day).wday : now.wday
    in_window && (weekdays.empty? || weekdays.include?(day))
  end

  def applies_to?(item)
    (category_ids.empty? && menu_item_ids.empty?) ||
      category_ids.include?(item.category_id) || menu_item_ids.include?(item.id)
  end

  private

  def valid_weekdays
    errors.add(:weekdays, "không hợp lệ") unless weekdays.all? { |d| (0..6).cover?(d) }
  end
end
