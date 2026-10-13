# Bếp gom theo món (SPEC §5.2): cập nhật cùng lúc nhiều món thuộc nhiều đơn.
# Kiểm tra hết trước rồi mới cập nhật từng món qua UpdateItem (giữ nguyên log + realtime từng món).
module Orders
  class UpdateItems
    def self.call(...) = new(...).call

    def initialize(ids, status:, user:, mark_menu_unavailable: false)
      @ids = Array(ids).map(&:to_i).uniq
      @status = status.to_s
      @user = user
      @mark_menu_unavailable = mark_menu_unavailable
    end

    def call
      raise ServiceError, "Chưa chọn món" if @ids.empty?

      items = OrderItem.includes(:order).where(id: @ids).to_a
      raise ServiceError.new("Không tìm thấy món", status: :not_found) if items.size != @ids.size
      if items.any? { |i| Order::KITCHEN_STATUSES.exclude?(i.order.status) }
        raise ServiceError, "Có món thuộc đơn chưa xác nhận hoặc đã kết thúc"
      end

      items.reject { |i| i.status == @status }.each do |item|
        UpdateItem.call(item, status: @status, user: @user, mark_menu_unavailable: @mark_menu_unavailable)
      end
      Order.where(id: items.map(&:order_id).uniq)
    end
  end
end
