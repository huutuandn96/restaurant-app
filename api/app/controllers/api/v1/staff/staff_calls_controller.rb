module Api
  module V1
    module Staff
      class StaffCallsController < BaseController
        allow_roles :waiter, :manager, :owner

        def index
          calls = StaffCall.open.includes(table_session: :table).order(:created_at)
          render json: calls.map { |c| StaffCallSerializer.call(c) }
        end

        def resolve
          call = StaffCall.find(params[:id])
          call.update!(status: "resolved", resolved_by: current_user, resolved_at: Time.current)
          payload = StaffCallSerializer.call(call)
          Realtime.publish(rooms: "waiters", event: "staff_call.resolved", payload:)
          render json: payload
        end
      end
    end
  end
end
