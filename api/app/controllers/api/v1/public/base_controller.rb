module Api
  module V1
    module Public
      # Khách: xác thực bằng header X-Session-Token (SPEC §2.2)
      class BaseController < ApplicationController
        private

        def current_session
          @current_session ||= begin
            s = TableSession.resolve(request.headers["X-Session-Token"])
            raise ServiceError.new("Phiên không hợp lệ, vui lòng quét lại QR", status: :unauthorized) unless s
            raise ServiceError.new("Bàn đã thanh toán, vui lòng quét lại QR", status: :gone) if s.closed?

            s
          end
        end

        def session_payload(session)
          {
            session_token: session.session_token,
            socket_token: AuthToken.socket_for_session(session),
            verify_code: session.verify_code,
            table: TableSerializer.call(session.table, session: nil),
            orders: session.orders.includes(:table, :table_session, :confirmed_by, :order_items).order(:created_at)
                           .map { |o| OrderSerializer.call(o) },
            total: session.total
          }
        end
      end
    end
  end
end
