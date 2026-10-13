module Api
  module V1
    module Public
      class SessionsController < BaseController
        # POST /public/tables/:qr_token/session
        def create
          table = Table.find_by!(qr_token: params[:qr_token])
          # Khách đã có token của đúng bàn này và còn mở → dùng lại
          token = request.headers["X-Session-Token"].presence
          existing = token && table.table_sessions.open.find_by(session_token: token)
          render json: session_payload(existing || TableSessions::Open.call(table))
        end

        # GET /public/session
        def show
          render json: session_payload(current_session)
        end
      end
    end
  end
end
