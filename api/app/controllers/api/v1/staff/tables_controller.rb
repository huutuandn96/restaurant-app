module Api
  module V1
    module Staff
      # Sơ đồ bàn + chi tiết bàn + thanh toán (SPEC §2.3, §5.2)
      class TablesController < BaseController
        allow_roles :waiter, :manager, :owner

        def index
          tables = Table.ordered.includes(:open_session).to_a
          session_ids = tables.filter_map { |t| t.open_session&.id }
          pending = Order.pending.where(table_session_id: session_ids).group(:table_session_id).count
          ready = Order.ready.where(table_session_id: session_ids).group(:table_session_id).count
          calls = StaffCall.open.where(table_session_id: session_ids).group(:table_session_id).count
          totals = Order.where(table_session_id: session_ids).where.not(status: "cancelled").group(:table_session_id).sum(:total)

          render json: tables.map { |t|
            sid = t.open_session&.id
            TableSerializer.call(t).merge(
              pending_orders: pending[sid].to_i, ready_orders: ready[sid].to_i,
              open_calls: calls[sid].to_i, session_total: totals[sid].to_i
            )
          }
        end

        def show
          table = Table.find(params[:id])
          session = table.open_session
          orders = session ? order_scope.where(table_session: session).order(:created_at) : []
          render json: TableSerializer.call(table).merge(
            orders: orders.map { |o| OrderSerializer.call(o) },
            session_total: session&.total.to_i
          )
        end

        # Chuyển sang bàn trống (SPEC §2.5)
        def move
          TableSessions::Move.call(Table.find(params[:id]), to: Table.find(params.require(:to_table_id)), user: current_user)
          render json: TableSerializer.call(Table.find(params[:to_table_id]))
        end

        # Gộp vào bàn đang có khách (SPEC §2.5)
        def merge
          TableSessions::Merge.call(Table.find(params[:id]), into: Table.find(params.require(:into_table_id)), user: current_user)
          render json: TableSerializer.call(Table.find(params[:into_table_id]))
        end

        def checkout
          table = Table.find(params[:id])
          session = TableSessions::Checkout.call(table, user: current_user)
          render json: TableSerializer.call(table.reload).merge(closed_session_id: session.id)
        end
      end
    end
  end
end
