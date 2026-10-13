module Api
  module V1
    module Staff
      class OrdersController < BaseController
        allow_roles :waiter, :manager, :owner, only: %i[confirm cancel]
        allow_roles :kitchen, :manager, :owner, only: :done

        # GET /staff/orders?status=pending,confirmed&table_id=
        # Mặc định: đơn đang hoạt động (chưa completed/cancelled)
        def index
          statuses = params[:status].present? ? params[:status].split(",") & Order::STATUSES : Order::ACTIVE_STATUSES
          scope = order_scope.where(status: statuses).order(:created_at)
          scope = scope.where(table_id: params[:table_id]) if params[:table_id].present?
          scope = scope.where(created_at: 1.day.ago..) unless params[:status].present?
          render json: scope.limit(200).map { |o| OrderSerializer.call(o) }
        end

        def show
          render json: OrderSerializer.call(order_scope.find(params[:id]), events: true)
        end

        def confirm = transition("confirm")
        def cancel = transition("cancel")
        def done = transition("done")

        private

        def transition(action)
          order = Orders::Transition.call(order_scope.find(params[:id]), action:, user: current_user, reason: params[:reason])
          render json: OrderSerializer.call(order)
        end
      end
    end
  end
end
