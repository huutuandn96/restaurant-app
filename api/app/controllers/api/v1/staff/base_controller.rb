module Api
  module V1
    module Staff
      class BaseController < AuthenticatedController
        private

        def order_scope
          Order.includes(:table, :table_session, :confirmed_by, :order_items)
        end
      end
    end
  end
end
