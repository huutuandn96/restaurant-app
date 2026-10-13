class User < ApplicationRecord
  ROLES = %w[waiter kitchen manager owner].freeze

  has_secure_password

  enum :role, ROLES.index_by(&:itself), validate: true

  validates :name, presence: true
  validates :password, length: { minimum: 6 }, allow_nil: true
  validates :email, presence: true, uniqueness: { case_sensitive: false },
                    format: { with: URI::MailTo::EMAIL_REGEXP }

  normalizes :email, with: ->(e) { e.strip.downcase }

  scope :active, -> { where(active: true) }

  # ---- PIN (SPEC §4.1) ----
  PIN_FORMAT = /\A\d{4,6}\z/
  PIN_MAX_ATTEMPTS = 5
  PIN_LOCK = 5.minutes

  def pin=(value)
    value = value.to_s
    raise ServiceError, "PIN phải gồm 4–6 chữ số" unless value.match?(PIN_FORMAT)
    raise ServiceError, "PIN quá dễ đoán (VD 1234, 0000) — chọn mã khác" if weak_pin?(value)

    self.pin_digest = BCrypt::Password.create(value)
    self.pin_failed_attempts = 0
    self.pin_locked_until = nil
  end

  def pin? = pin_digest.present?
  def pin_locked? = pin_locked_until.present? && pin_locked_until.future?

  # Trả về true/false; sai PIN_MAX_ATTEMPTS lần liên tiếp → khoá PIN_LOCK
  def verify_pin!(value)
    return false unless pin? && !pin_locked?

    if BCrypt::Password.new(pin_digest).is_password?(value.to_s)
      update_columns(pin_failed_attempts: 0, pin_locked_until: nil)
      true
    else
      attempts = pin_failed_attempts + 1
      locked = attempts >= PIN_MAX_ATTEMPTS
      update_columns(pin_failed_attempts: locked ? 0 : attempts, pin_locked_until: (PIN_LOCK.from_now if locked))
      false
    end
  end

  private

  def weak_pin?(v)
    v.chars.uniq.size == 1 || "01234567890".include?(v) || "09876543210".include?(v)
  end

  public

  def manager_or_owner? = manager? || owner?
end
