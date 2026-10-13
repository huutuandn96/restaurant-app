# Bếp cập nhật từng món: cooking / done / out_of_stock (SPEC §5.2)
# Tự đẩy trạng thái order: confirmed → preparing → ready
module Orders
  class UpdateItem
    def self.call(...) = new(...).call

    def initialize(item, status:, user:, mark_menu_unavailable: false)
      @item = item
      @status = status.to_s
      @user = user
      @mark_menu_unavailable = ActiveModel::Type::Boolean.new.cast(mark_menu_unavailable)
    end

    def call
      raise ServiceError, "Trạng thái món không hợp lệ" unless %w[cooking done out_of_stock].include?(@status)

      order = @item.order
      menu_changed = false
      order.with_lock do
        unless %w[confirmed preparing ready].include?(order.status)
          raise ServiceError, "Đơn chưa được xác nhận hoặc đã kết thúc"
        end

        from = order.status
        @item.update!(status: @status, done_at: (@status == "done" ? Time.current : nil))
        order.recalculate_total! if @status == "out_of_stock" || @item.status_previously_was == "out_of_stock"
        sync_order_status!(order)
        order.log_event!("item_#{@status}", user: @user, from:, to: order.status,
                         data: { item_id: @item.id, name: @item.name_snapshot })

        if @status == "out_of_stock" && @mark_menu_unavailable && @item.menu_item.available?
          @item.menu_item.update!(available: false)
          menu_changed = true
        end
      end

      Realtime.publish(rooms: Realtime.order_rooms(order), event: "order_item.updated", payload: OrderSerializer.item(@item))
      Realtime.order_changed(order.reload)
      Realtime.menu_item_changed(@item.menu_item) if menu_changed
      @item
    end

    private

    def sync_order_status!(order)
      items = order.order_items.reload
      if items.all?(&:finished?)
        order.update!(status: "ready", ready_at: Time.current) unless order.ready?
      elsif order.confirmed? || order.ready?
        order.update!(status: "preparing", ready_at: nil)
      end
    end
  end
end
