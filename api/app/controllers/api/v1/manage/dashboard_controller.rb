module Api
  module V1
    module Manage
      # Dashboard hôm nay (SPEC §5.3)
      class DashboardController < BaseController
        def show
          today = Order.today
          counts = today.group(:status).count
          top = OrderItem.joins(:order).merge(Order.today).where.not(status: "out_of_stock")
                         .where.not(orders: { status: "cancelled" })
                         .group(:name_snapshot).order(Arel.sql("SUM(quantity) DESC")).limit(5)
                         .pluck(:name_snapshot, Arel.sql("SUM(quantity)"))

          render json: {
            date: Date.current,
            total_orders: counts.values.sum,
            by_status: Order::STATUSES.index_with { |s| counts[s].to_i },
            unconfirmed: counts["pending"].to_i,
            in_progress: %w[confirmed preparing].sum { |s| counts[s].to_i },
            done: %w[ready completed].sum { |s| counts[s].to_i },
            cancelled: counts["cancelled"].to_i,
            revenue: Order.completed.where(completed_at: Time.current.all_day).sum(:total),
            pending_revenue: today.where(status: Order::KITCHEN_STATUSES).sum(:total),
            occupied_tables: Table.occupied.count,
            total_tables: Table.count,
            top_items: top.map { |name, qty| { name:, quantity: qty.to_i } }
          }
        end
      end
    end
  end
end
