module Api
  module V1
    module Public
      class SessionsController < BaseController
        # POST /public/tables/:qr_token/session
        def create
          table = Table.find_by!(qr_token: params[:qr_token])
          # Khách đã có token còn mở → dùng lại. Token có thể đã đi theo phiên sang bàn khác
          # (chuyển / gộp bàn, SPEC §2.5) nên không bắt buộc cùng bàn với QR vừa quét.
          existing = TableSession.resolve(request.headers["X-Session-Token"])
          existing = nil unless existing&.open?
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
