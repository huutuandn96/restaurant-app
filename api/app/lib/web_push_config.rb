# Khoá VAPID cho Web Push (SPEC §1.1). Thiếu khoá → tắt push, app vẫn chạy bình thường.
module WebPushConfig
  module_function

  def enabled? = public_key.present? && private_key.present?
  def public_key = ENV["VAPID_PUBLIC_KEY"].presence
  def private_key = ENV["VAPID_PRIVATE_KEY"].presence
  def subject = ENV.fetch("VAPID_SUBJECT", "mailto:admin@example.com")
end
