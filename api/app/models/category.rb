class Category < ApplicationRecord
  has_many :menu_items, dependent: :restrict_with_error

  validates :name, presence: true

  scope :ordered, -> { order(:position, :id) }
  scope :active, -> { where(active: true) }
end
