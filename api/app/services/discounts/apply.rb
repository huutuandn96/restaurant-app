# Phục vụ / quản lý đặt giảm giá cho phiên bàn trước khi thanh toán (SPEC §5.6).
# Gửi lại toàn bộ cấu hình: voucher_code rỗng = bỏ voucher; manual_kind rỗng = bỏ giảm tay.
module Discounts
  class Apply
    WAITER_MAX_PERCENT = ENV.fetch("MANUAL_DISCOUNT_MAX_PERCENT", 10).to_i

    def self.call(...) = new(...).call

    def initialize(session, user:, voucher_code: nil, manual_kind: nil, manual_value: nil, reason: nil)
      @session = session
      @user = user
      @code = voucher_code.to_s.strip.upcase.presence
      @kind = manual_kind.presence
      @value = manual_value.to_i
      @reason = reason.to_s.strip.presence
    end

    def call
      raise ServiceError, "Bàn đã thanh toán" unless @session.open?

      voucher = nil
      if @code
        voucher = Voucher.find_by(code: @code) or raise ServiceError, "Không tìm thấy mã #{@code}"
        reason = voucher.unusable_reason
        raise ServiceError, reason if reason
      end

      if @kind
        raise ServiceError, "Kiểu giảm không hợp lệ" unless %w[percent amount].include?(@kind)
        raise ServiceError, "Mức giảm phải lớn hơn 0" unless @value.positive?
        raise ServiceError, "Giảm % tối đa 100" if @kind == "percent" && @value > 100
        raise ServiceError, "Cần nhập lý do giảm giá" unless @reason
        check_waiter_limit!
      end

      @session.update!(voucher:, manual_discount_kind: @kind, manual_discount_value: (@value if @kind),
                       manual_discount_reason: (@reason if @kind), discount_by: (@user if @kind || voucher))
      @session
    end

    private

    # Phục vụ chỉ được giảm tay tối đa N% tổng bàn; quản lý / chủ không giới hạn
    def check_waiter_limit!
      return unless @user.waiter?

      subtotal = @session.total
      percent = @kind == "percent" ? @value : (subtotal.zero? ? 100 : @value * 100.0 / subtotal)
      return if percent <= WAITER_MAX_PERCENT

      raise ServiceError.new("Phục vụ chỉ được giảm tối đa #{WAITER_MAX_PERCENT}% — nhờ quản lý duyệt", status: :forbidden)
    end
  end
end
