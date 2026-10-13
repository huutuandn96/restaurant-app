# Đổi trạng thái order (SPEC §3). Các action của phục vụ / bếp / manager.
module Orders
  class Transition
    def self.call(...) = new(...).call

    def initialize(order, action:, user:, reason: nil, status: nil)
      @order = order
      @action = action.to_s
      @user = user
      @reason = reason
      @target = status
    end

    def call
      from = @order.status
      @order.with_lock do
        case @action
        when "confirm" then confirm!
        when "cancel" then cancel!
        when "done" then done_all!
        when "set_status" then set_status!
        else raise ServiceError, "Action không hợp lệ"
        end
        @order.log_event!(@action, user: @user, from:, to: @order.status, data: { reason: @reason }.compact)
      end
      Realtime.order_changed(@order, event: @action == "confirm" ? "order.confirmed" : "order.updated")
      @order
    end

    private

    def confirm!
      ensure_status!(%w[pending])
      @order.update!(status: "confirmed", confirmed_at: Time.current, confirmed_by: @user)
    end

    def cancel!
      allowed = @user.manager_or_owner? ? Order::ACTIVE_STATUSES : %w[pending confirmed]
      ensure_status!(allowed)
      @order.update!(status: "cancelled", cancelled_at: Time.current, cancel_reason: @reason.presence)
    end

    # Bếp: done cả order — mọi món chưa hết → done
    def done_all!
      ensure_status!(%w[confirmed preparing])
      now = Time.current
      @order.order_items.reject(&:finished?).each { |i| i.update!(status: "done", done_at: now) }
      @order.update!(status: "ready", ready_at: now)
    end

    # Manager đổi trạng thái thủ công (SPEC §5.3)
    def set_status!
      raise ServiceError.new("Không có quyền", status: :forbidden) unless @user.manager_or_owner?
      raise ServiceError, "Trạng thái không hợp lệ" unless Order::STATUSES.include?(@target)

      now = Time.current
      attrs = { status: @target }
      attrs[:confirmed_at] = now if @target == "confirmed" && @order.confirmed_at.nil?
      attrs[:confirmed_by] = @user if @target == "confirmed" && @order.confirmed_by.nil?
      attrs[:ready_at] = now if @target == "ready"
      attrs[:completed_at] = @target == "completed" ? now : nil
      attrs[:cancelled_at] = @target == "cancelled" ? now : nil
      @order.update!(attrs)
    end

    def ensure_status!(allowed)
      return if allowed.include?(@order.status)

      raise ServiceError, "Không thể thực hiện khi đơn đang ở trạng thái #{@order.status}"
    end
  end
end
