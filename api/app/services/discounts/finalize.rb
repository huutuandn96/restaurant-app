# Chốt giảm giá khi thanh toán (SPEC §5.6): tính lại trên các đơn hoàn thành, trừ lượt voucher,
# phân bổ phần giảm về từng đơn theo tỉ lệ (orders.discount) để báo cáo doanh thu = Σ(total − discount).
module Discounts
  class Finalize
    def self.call(...) = new(...).call

    def initialize(session)
      @session = session
    end

    def call
      calc = Calculate.call(@session)
      voucher_line = calc[:discounts].find { |l| l[:kind] == "voucher" }
      if @session.voucher && voucher_line && voucher_line[:amount].positive?
        v = Voucher.lock.find(@session.voucher_id)
        raise ServiceError, v.unusable_reason if v.unusable_reason

        v.increment!(:used_count)
      end

      allocate(calc[:discount_total])
      @session.update!(discount_total: calc[:discount_total])
      calc
    end

    private

    def allocate(total)
      orders = @session.orders.completed.order(:id).to_a
      gross = orders.sum(&:total)
      return if total.zero? || gross.zero?

      left = total
      orders.each_with_index do |o, i|
        share = i == orders.size - 1 ? left : total * o.total / gross
        o.update_columns(discount: share)
        left -= share
      end
    end
  end
end
