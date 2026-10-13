module Api
  module V1
    module Manage
      class CategoriesController < BaseController
        def index
          cats = Category.ordered.to_a
          items = MenuItem.with_attached_image.ordered.group_by(&:category_id)
          render json: cats.map { |c| MenuSerializer.category(c, items: items[c.id] || []) }
        end

        def create
          render json: MenuSerializer.category(Category.create!(category_params)), status: :created
        end

        def update
          c = Category.find(params[:id])
          c.update!(category_params)
          render json: MenuSerializer.category(c)
        end

        def destroy
          Category.find(params[:id]).destroy!
          head :no_content
        end

        # POST /manage/categories/:id/adjust_prices { mode: percent|amount, value: 10 | -5000 }
        def adjust_prices
          c = Category.find(params[:id])
          value = params.require(:value).to_f
          mode = params.require(:mode)
          raise ServiceError, "mode phải là percent hoặc amount" unless %w[percent amount].include?(mode)

          MenuItem.transaction do
            c.menu_items.find_each do |i|
              price = mode == "percent" ? i.price * (1 + value / 100.0) : i.price + value
              i.update!(price: [(price / 1000.0).round * 1000, 0].max) # làm tròn nghìn đồng
            end
          end
          c.menu_items.each { |i| Realtime.menu_item_changed(i) }
          render json: MenuSerializer.category(c, items: c.menu_items.ordered)
        end

        private

        def category_params = params.permit(:name, :position, :active)
      end
    end
  end
end
