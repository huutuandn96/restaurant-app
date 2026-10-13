module Api
  module V1
    module Staff
      # Hoá đơn theo phiên bàn: tạm tính khi đang mở, in lại sau khi đã đóng (SPEC §5.4)
      class TableSessionsController < BaseController
        allow_roles :waiter, :manager, :owner

        def bill
          render json: Bills::Build.call(TableSession.includes(:table, :closed_by).find(params[:id]))
        end

        # PUT /staff/table_sessions/:id/discount {voucher_code, manual_kind, manual_value, reason} (SPEC §5.6)
        def discount
          session = TableSession.find(params[:id])
          Discounts::Apply.call(session, user: current_user, voucher_code: params[:voucher_code],
                                         manual_kind: params[:manual_kind], manual_value: params[:manual_value], reason: params[:reason])
          render json: Bills::Build.call(session.reload)
        end
      end
    end
  end
end
