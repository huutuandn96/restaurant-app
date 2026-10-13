# Khách đặt trước đã đến (SPEC §5.5): mở phiên cho bàn → khách quét QR là vào đúng phiên đó
module Reservations
  class Arrive
    def self.call(...) = new(...).call

    def initialize(reservation, user:)
      @reservation = reservation
      @user = user
    end

    def call
      raise ServiceError, "Lượt đặt không còn hiệu lực" unless @reservation.booked?
      table = @reservation.table
      raise ServiceError, "#{table.label} đang có khách khác — chuyển lượt đặt sang bàn khác trước" if table.open_session

      session = TableSessions::Open.call(table)
      @reservation.update!(status: "arrived", arrived_at: Time.current, table_session: session)
      Realtime.publish(rooms: %w[waiters managers], event: "reservation.updated", payload: ReservationSerializer.call(@reservation))
      @reservation
    end
  end
end
