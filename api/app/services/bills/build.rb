# Dữ liệu in hoá đơn theo table session (SPEC §5.4)
# - Gộp mọi đơn không bị huỷ; bỏ món hết (out_of_stock) như cách tính total
# - Dòng giống nhau (tên + đơn giá) được cộng dồn số lượng
# - Phiên còn mở → "tạm tính"; đã đóng → hoá đơn chính thức
module Bills
  class Build
    def self.call(...) = new(...).call

    def initialize(session)
      @session = session
    end

    def call
      orders = @session.orders.where.not(status: "cancelled").includes(:order_items).order(:created_at)
      items = orders.flat_map(&:order_items).reject(&:out_of_stock?)
      lines = items.group_by { |i| [i.name_snapshot, i.price_snapshot, i.promotion_name] }.map do |(name, price, promo), group|
        qty = group.sum(&:quantity)
        { name:, price:, quantity: qty, amount: price * qty, original_price: group.first.original_price, promotion: promo }
      end
      calc = Discounts::Calculate.call(@session)

      {
        bill_no: format("HD%06d", @session.id),
        table_session_id: @session.id,
        table: { id: @session.table.id, number: @session.table.number, label: @session.table.label, area: @session.table.area },
        provisional: @session.open?,
        opened_at: @session.opened_at,
        closed_at: @session.closed_at,
        cashier: @session.closed_by&.name,
        order_codes: orders.map(&:code),
        lines:,
        subtotal: calc[:subtotal],
        discounts: calc[:discounts],
        discount_total: calc[:discount_total],
        total: calc[:total],
        voucher_code: @session.voucher&.code,
        manual_discount: @session.manual_discount_kind && {
          kind: @session.manual_discount_kind, value: @session.manual_discount_value, reason: @session.manual_discount_reason
        },
        restaurant: self.class.restaurant,
        printed_at: Time.current
      }
    end

    def self.restaurant
      {
        name: ENV.fetch("RESTAURANT_NAME", "Nhà hàng Demo"),
        address: ENV["RESTAURANT_ADDRESS"].presence,
        phone: ENV["RESTAURANT_PHONE"].presence,
        footer: ENV.fetch("RESTAURANT_BILL_FOOTER", "Cảm ơn quý khách, hẹn gặp lại!")
      }
    end
  end
end
