module Api
  module V1
    module Public
      class StaffCallsController < BaseController
        def create
          call = current_session.staff_calls.open.first_or_create!
          Realtime.publish(rooms: "waiters", event: "table.call_staff", payload: StaffCallSerializer.call(call))
          render json: StaffCallSerializer.call(call), status: :created
        end
      end
    end
  end
end
