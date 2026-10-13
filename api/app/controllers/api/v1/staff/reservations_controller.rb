module Api
  module V1
    module Staff
      # Đặt bàn trước (SPEC §5.5) — phục vụ, quản lý, chủ
      class ReservationsController < BaseController
        allow_roles :waiter, :manager, :owner
        before_action :set_reservation, only: %i[update arrive cancel no_show]

        # GET /staff/reservations?date=YYYY-MM-DD (mặc định hôm nay)
        def index
          date = params[:date].present? ? Date.parse(params[:date]) : Time.zone.today
          list = Reservation.includes(:table, :created_by).on_date(date).order(:reserved_at)
          render json: list.map { |r| ReservationSerializer.call(r) }
        rescue Date::Error
          raise ServiceError, "Ngày không hợp lệ"
        end

        def create
          r = Reservation.create!(reservation_params.merge(created_by: current_user))
          publish(r)
          render json: ReservationSerializer.call(r), status: :created
        end

        def update
          raise ServiceError, "Chỉ sửa được lượt đặt đang chờ" unless @reservation.booked?
          @reservation.update!(reservation_params)
          publish(@reservation)
          render json: ReservationSerializer.call(@reservation)
        end

        def arrive
          render json: ReservationSerializer.call(Reservations::Arrive.call(@reservation, user: current_user))
        end

        def cancel = change_status("cancelled", cancelled_at: Time.current)
        def no_show = change_status("no_show")

        private

        def set_reservation
          @reservation = Reservation.includes(:table).find(params[:id])
        end

        def change_status(status, **extra)
          raise ServiceError, "Lượt đặt không còn hiệu lực" unless @reservation.booked?
          @reservation.update!(status:, **extra)
          publish(@reservation)
          render json: ReservationSerializer.call(@reservation)
        end

        def publish(r)
          Realtime.publish(rooms: %w[waiters managers], event: "reservation.updated", payload: ReservationSerializer.call(r))
        end

        def reservation_params
          params.permit(:table_id, :customer_name, :phone, :party_size, :reserved_at, :note)
        end
      end
    end
  end
end
