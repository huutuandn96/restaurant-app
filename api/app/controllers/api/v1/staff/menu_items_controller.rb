module Api
  module V1
    module Staff
      # Bếp / phục vụ bật lại món đã hết
      class MenuItemsController < BaseController
        def update
          item = MenuItem.find(params[:id])
          item.update!(available: ActiveModel::Type::Boolean.new.cast(params.require(:available)))
          Realtime.menu_item_changed(item)
          render json: MenuSerializer.item(item)
        end
      end
    end
  end
end
