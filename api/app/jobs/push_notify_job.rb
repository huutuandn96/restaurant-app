# Gửi Web Push tới mọi máy đã bật thông báo của các role chỉ định (SPEC §1.1).
# Subscription hết hạn (404/410) bị xoá.
class PushNotifyJob < ApplicationJob
  queue_as :default

  def perform(roles:, title:, body:, url:, tag: nil)
    return unless WebPushConfig.enabled?

    message = { title:, body:, url:, tag: }.compact.to_json
    PushSubscription.joins(:user).merge(User.active.where(role: roles)).find_each do |sub|
      WebPush.payload_send(
        message:, endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth, ttl: 300, urgency: "high",
        vapid: { subject: WebPushConfig.subject, public_key: WebPushConfig.public_key, private_key: WebPushConfig.private_key }
      )
      sub.update_column(:last_success_at, Time.current)
    rescue WebPush::ExpiredSubscription, WebPush::InvalidSubscription
      sub.destroy
    rescue WebPush::Error, SocketError, Errno::ECONNREFUSED, Net::OpenTimeout, Net::ReadTimeout => e
      Rails.logger.warn("[push] #{sub.id}: #{e.class} #{e.message.truncate(200)}")
    end
  end
end
