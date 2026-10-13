module Api
  module V1
    module Manage
      class MenuItemsController < BaseController
        def create
          item = MenuItem.create!(item_params)
          Realtime.menu_item_changed(item)
          render json: MenuSerializer.item(item), status: :created
        end

        # Upload ảnh: multipart field "image"; xoá ảnh: remove_image=true
        def update
          item = MenuItem.find(params[:id])
          item.image.purge_later if ActiveModel::Type::Boolean.new.cast(params[:remove_image]) && item.image.attached?
          item.update!(item_params)
          Realtime.menu_item_changed(item)
          render json: MenuSerializer.item(item)
        end

        def destroy
          item = MenuItem.find(params[:id])
          if item.order_items.exists?
            # Món đã có trong đơn → ẩn thay vì xoá để giữ lịch sử
            item.update!(available: false)
            Realtime.menu_item_changed(item)
            render json: MenuSerializer.item(item)
          else
            item.destroy!
            head :no_content
          end
        end

        private

        def item_params
          params.permit(:category_id, :name, :description, :price, :image_url, :image, :available, :position)
        end
      end
    end
  end
end
