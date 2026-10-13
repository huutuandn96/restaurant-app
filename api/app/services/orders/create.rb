# Khách đặt món (SPEC §5.1). Bàn lấy từ session server-side, không tin client.
module Orders
  class Create
    MAX_LINES = 50

    def self.call(...) = new(...).call

    def initialize(session, items:, note: nil)
      @session = session
      @items = Array(items)
      @note = note.presence
    end

    def call
      raise ServiceError.new("Phiên bàn đã đóng, vui lòng quét lại QR", status: :gone) unless @session.open?
      raise ServiceError, "Giỏ hàng trống" if @items.empty?
      raise ServiceError, "Quá nhiều món" if @items.size > MAX_LINES

      menu = MenuItem.where(id: @items.map { |i| i[:menu_item_id] }).index_by(&:id)

      order = ActiveRecord::Base.transaction do
        o = @session.orders.create!(table: @session.table, note: @note)
        @items.each do |line|
          mi = menu[line[:menu_item_id].to_i] or raise ServiceError, "Món không tồn tại"
          raise ServiceError, "#{mi.name} đã hết" unless mi.available?

          o.order_items.create!(menu_item: mi, name_snapshot: mi.name, price_snapshot: mi.price,
                                quantity: line[:quantity].to_i, note: line[:note].presence)
        end
        o.recalculate_total!
        o.log_event!("create", to: "pending")
        o
      end

      Realtime.order_changed(order, event: "order.created")
      order
    end
  end
end
