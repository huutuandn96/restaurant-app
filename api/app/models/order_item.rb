class OrderItem < ApplicationRecord
  STATUSES = %w[pending cooking done out_of_stock].freeze
  FINISHED = %w[done out_of_stock].freeze

  belongs_to :order, inverse_of: :order_items
  belongs_to :menu_item

  enum :status, STATUSES.index_by(&:itself), validate: true

  validates :quantity, numericality: { only_integer: true, greater_than: 0, less_than_or_equal_to: 99 }
  validates :name_snapshot, :price_snapshot, presence: true

  def finished? = FINISHED.include?(status)
  def subtotal = price_snapshot * quantity
end
