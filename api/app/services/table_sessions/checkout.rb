# Thanh toán & đóng bàn (SPEC §2.2, §3)
# - Order đã xác nhận (confirmed/preparing/ready) → completed
# - Order chưa xác nhận (pending) → cancelled
# - Session closed: session_token + verify_code cũ hết hiệu lực; QR giữ nguyên
module TableSessions
  class Checkout
    def self.call(...) = new(...).call

    def initialize(table, user:)
      @table = table
      @user = user
    end

    def call
      session = @table.open_session or raise ServiceError.new("Bàn chưa có khách", status: :unprocessable_entity)
      now = Time.current
      changed = []

      ActiveRecord::Base.transaction do
        session.orders.where(status: Order::KITCHEN_STATUSES).find_each do |o|
          from = o.status
          o.update!(status: "completed", completed_at: now)
          o.log_event!("complete", user: @user, from:, to: "completed")
          changed << o
        end
        session.orders.pending.find_each do |o|
          o.update!(status: "cancelled", cancelled_at: now, cancel_reason: "Đóng bàn khi chưa xác nhận")
          o.log_event!("cancel", user: @user, from: "pending", to: "cancelled")
          changed << o
        end
        session.staff_calls.open.update_all(status: "resolved", resolved_by_id: @user.id, resolved_at: now)
        session.update!(status: "closed", closed_at: now, closed_by: @user)
        @table.update!(status: "available")
      end

      changed.each { |o| Realtime.order_changed(o) }
      Realtime.publish(rooms: "table_session:#{session.id}", event: "session.closed", payload: { table_session_id: session.id })
      Realtime.publish(rooms: %w[waiters managers], event: "table.updated", payload: TableSerializer.call(@table.reload))
      session
    end
  end
end
