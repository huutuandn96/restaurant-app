class Table < ApplicationRecord
  has_many :table_sessions, dependent: :restrict_with_error
  has_many :orders, dependent: :restrict_with_error
  has_one :open_session, -> { where(status: "open") }, class_name: "TableSession"

  enum :status, { available: "available", occupied: "occupied" }, validate: true

  validates :number, presence: true, uniqueness: true, numericality: { only_integer: true, greater_than: 0 }
  validates :qr_token, presence: true, uniqueness: true

  before_validation :generate_qr_token, on: :create

  scope :ordered, -> { order(:number) }

  def regenerate_qr_token!
    update!(qr_token: self.class.new_token)
  end

  # URL in trên QR (SPEC §2.1)
  def qr_url
    "http://#{ENV.fetch('LAN_IP', 'localhost')}:#{ENV.fetch('WEB_PORT', '5173')}/t/#{qr_token}"
  end

  def label = format("Bàn %02d", number)

  def self.new_token = SecureRandom.alphanumeric(24)

  private

  def generate_qr_token
    self.qr_token ||= self.class.new_token
  end
end
