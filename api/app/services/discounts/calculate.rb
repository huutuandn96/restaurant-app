# Giảm giá hoá đơn của phiên bàn (SPEC §5.6). Thứ tự: voucher trước, giảm tay tính trên phần còn lại.
module Discounts
  class Calculate
    def self.call(...) = new(...).call

    def initialize(session, now: Time.current)
      @session = session
      @now = now
    end

    def call
      subtotal = @session.total
      lines = []

      if (v = @session.voucher)
        error = v.unusable_reason(@now) unless @session.closed?
        error ||= "Đơn tối thiểu #{money(v.min_spend)} để dùng mã #{v.code}" if subtotal < v.min_spend
        amount = error ? 0 : v.discount_for(subtotal)
        lines << { kind: "voucher", label: "Voucher #{v.code}#{" (-#{v.value}%)" if v.kind == 'percent'}", amount:, error: }
      end

      if @session.manual_discount_kind.present?
        base = subtotal - lines.sum { |l| l[:amount] }
        value = @session.manual_discount_value.to_i
        amount = @session.manual_discount_kind == "percent" ? base * value / 100 : [value, base].min
        label = @session.manual_discount_kind == "percent" ? "Giảm #{value}%" : "Giảm giá"
        lines << { kind: "manual", label:, amount:, reason: @session.manual_discount_reason, by: @session.discount_by&.name }
      end

      discount = lines.sum { |l| l[:amount] }
      { subtotal:, discounts: lines, discount_total: discount, total: subtotal - discount }
    end

    private

    def money(n) = "#{n.to_s.reverse.scan(/\d{1,3}/).join('.').reverse}đ"
  end
end
