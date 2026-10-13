# Giá bán hiện hành của món theo happy hour (SPEC §5.6).
# Nhiều chương trình trùng nhau → lấy % cao nhất. Giá giảm làm tròn tới 100đ.
module Promotions
  class Pricing
    Result = Data.define(:price, :original_price, :promotion_name)

    def initialize(now = Time.current)
      @now = now
      @running = Promotion.active.select { |p| p.running?(now) }
    end

    def for(item)
      best = @running.select { |p| p.applies_to?(item) }.max_by(&:percent)
      return Result.new(price: item.price, original_price: nil, promotion_name: nil) unless best

      price = (item.price * (100 - best.percent) / 100.0).round(-2).to_i
      Result.new(price:, original_price: item.price, promotion_name: "#{best.name} -#{best.percent}%")
    end
  end
end
