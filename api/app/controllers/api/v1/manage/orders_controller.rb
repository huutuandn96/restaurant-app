module Api
  module V1
    module Manage
      class OrdersController < BaseController
        PER_PAGE = 30

        # GET /manage/orders?status=&date=YYYY-MM-DD&table_id=&page=
        def index
          scope = Order.includes(:table, :table_session, :confirmed_by, :order_items).order(created_at: :desc)
          scope = scope.where(status: params[:status].split(",")) if params[:status].present?
          scope = scope.where(table_id: params[:table_id]) if params[:table_id].present?
          date = params[:date].present? ? Date.parse(params[:date]) : Date.current
          scope = scope.where(created_at: date.all_day)
          page = [params[:page].to_i, 1].max
          total = scope.count
          render json: {
            orders: scope.offset((page - 1) * PER_PAGE).limit(PER_PAGE).map { |o| OrderSerializer.call(o) },
            page:, per_page: PER_PAGE, total:
          }
        rescue Date::Error
          raise ServiceError, "Ngày không hợp lệ"
        end

        def show
          render json: OrderSerializer.call(Order.find(params[:id]), events: true)
        end

        # PATCH /manage/orders/:id { status }
        def update
          order = Orders::Transition.call(Order.find(params[:id]), action: "set_status", user: current_user,
                                                                   status: params.require(:status), reason: params[:reason])
          render json: OrderSerializer.call(order, events: true)
        end
      end
    end
  end
end
