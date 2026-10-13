module Api
  module V1
    module Staff
      # Hoá đơn theo phiên bàn: tạm tính khi đang mở, in lại sau khi đã đóng (SPEC §5.4)
      class TableSessionsController < BaseController
        allow_roles :waiter, :manager, :owner

        def bill
          render json: Bills::Build.call(TableSession.includes(:table, :closed_by).find(params[:id]))
        end
      end
    end
  end
end
