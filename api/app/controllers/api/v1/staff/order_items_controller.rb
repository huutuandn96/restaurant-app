module Api
  module V1
    module Staff
      class OrderItemsController < BaseController
        allow_roles :kitchen, :manager, :owner

        def update
          item = OrderItem.find(params[:id])
          Orders::UpdateItem.call(item, status: params.require(:status), user: current_user,
                                        mark_menu_unavailable: params[:mark_menu_unavailable])
          render json: OrderSerializer.call(order_scope.find(item.order_id))
        end

        # Gom theo món: PATCH /staff/order_items/batch {ids, status, mark_menu_unavailable}
        def batch
          orders = Orders::UpdateItems.call(params.require(:ids), status: params.require(:status), user: current_user,
                                                                  mark_menu_unavailable: params[:mark_menu_unavailable])
          render json: order_scope.where(id: orders.select(:id)).map { |o| OrderSerializer.call(o) }
        end
      end
    end
  end
end
