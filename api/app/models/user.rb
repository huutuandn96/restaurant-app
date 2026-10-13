class User < ApplicationRecord
  ROLES = %w[waiter kitchen manager owner].freeze

  has_secure_password

  enum :role, ROLES.index_by(&:itself), validate: true

  validates :name, presence: true
  validates :email, presence: true, uniqueness: { case_sensitive: false },
                    format: { with: URI::MailTo::EMAIL_REGEXP }

  normalizes :email, with: ->(e) { e.strip.downcase }

  scope :active, -> { where(active: true) }

  def manager_or_owner? = manager? || owner?
end
