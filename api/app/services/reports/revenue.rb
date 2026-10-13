# Doanh thu = Σ (total − discount) của order completed theo completed_at (SPEC §3, §5.6)
module Reports
  class Revenue
    GROUPS = %w[day month].freeze

    def self.call(...) = new(...).call

    def initialize(from:, to:, group: "day")
      @from = from.to_date
      @to = to.to_date
      @group = GROUPS.include?(group) ? group : "day"
    end

    def call
      raise ServiceError, "Khoảng ngày không hợp lệ" if @from > @to

      tz = Time.zone.tzinfo.name
      bucket = Arel.sql("date_trunc('#{@group}', completed_at AT TIME ZONE 'UTC' AT TIME ZONE '#{tz}')")
      rows = Order.completed
                  .where(completed_at: @from.beginning_of_day..@to.end_of_day)
                  .group(bucket).order(bucket)
                  .pluck(bucket, Arel.sql("COUNT(*)"), Arel.sql("SUM(total - discount)"))

      data = rows.map { |d, count, sum| { period: format_period(d), orders: count, revenue: sum.to_i } }
      { from: @from, to: @to, group: @group, rows: data,
        total_orders: data.sum { |r| r[:orders] }, total_revenue: data.sum { |r| r[:revenue] } }
    end

    def to_csv
      result = call
      header = @group == "month" ? "Tháng" : "Ngày"
      lines = [[header, "Số đơn", "Doanh thu (VND)"]]
      result[:rows].each { |r| lines << [r[:period], r[:orders], r[:revenue]] }
      lines << ["Tổng", result[:total_orders], result[:total_revenue]]
      "﻿" + lines.map { |l| l.join(",") }.join("\n") + "\n"
    end

    private

    def format_period(d) = @group == "month" ? d.strftime("%Y-%m") : d.strftime("%Y-%m-%d")
  end
end
