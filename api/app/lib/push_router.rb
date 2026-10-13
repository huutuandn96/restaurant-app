# Sự kiện realtime → Web Push cho máy đang tắt màn hình / đóng app (SPEC §1.1).
# Socket.IO vẫn lo lúc app đang mở; push chỉ là lớp bổ sung. `tag` giúp thông báo cùng loại thay thế nhau.
module PushRouter
  module_function

  def call(event, payload)
    return unless WebPushConfig.enabled?

    msg = message(event, payload) or return
    PushNotifyJob.perform_later(**msg)
  rescue StandardError => e
    Rails.logger.warn("[push] router #{event}: #{e.message}")
  end

  def message(event, p)
    p = p.with_indifferent_access
    label = p.dig(:table, :label)
    case event
    when "order.created"
      qty = Array(p[:items]).sum { |i| i[:quantity].to_i }
      { roles: %w[waiter manager owner], title: "🔔 #{label} vừa đặt #{qty} món", body: "Mã #{p[:verify_code]} · bấm để xác nhận",
        url: "/staff/tables/#{p.dig(:table, :id)}", tag: "order-#{p[:id]}" }
    when "order.confirmed"
      names = Array(p[:items]).first(3).map { |i| "#{i[:quantity]}× #{i[:name]}" }.join(", ")
      { roles: %w[kitchen], title: "🍳 Đơn mới #{label}", body: names, url: "/staff/kitchen", tag: "kitchen-#{p[:id]}" }
    when "order.updated"
      return unless p[:status] == "ready"

      { roles: %w[waiter], title: "✅ #{label}: món đã xong", body: "Đơn ##{p[:code]} sẵn sàng mang ra",
        url: "/staff/tables/#{p.dig(:table, :id)}", tag: "ready-#{p[:id]}" }
    when "table.call_staff"
      { roles: %w[waiter manager owner], title: "🙋 #{label} gọi nhân viên", body: "Khách đang chờ tại bàn",
        url: "/staff/tables/#{p.dig(:table, :id)}", tag: "call-#{p.dig(:table, :id)}" }
    end
  end
end
