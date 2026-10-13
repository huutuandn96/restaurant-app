module Api
  module V1
    module Public
      class OrdersController < BaseController
        def create
          items = params.require(:items).map { |i| i.permit(:menu_item_id, :quantity, :note).to_h.symbolize_keys }
          order = Orders::Create.call(current_session, items:, note: params[:note])
          render json: OrderSerializer.call(order), status: :created
        end
      end
    end
  end
end
