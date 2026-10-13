module Api
  module V1
    module Public
      class MenuController < ApplicationController
        def show
          items = MenuItem.with_attached_image.joins(:category).merge(Category.active).ordered.group_by(&:category_id)
          categories = Category.active.ordered.select { |c| items[c.id].present? }
          render json: { categories: categories.map { |c| MenuSerializer.category(c, items: items[c.id]) } }
        end
      end
    end
  end
end
