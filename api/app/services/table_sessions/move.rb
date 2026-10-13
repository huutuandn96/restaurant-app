# Chuyển bàn (SPEC §2.5): cả phiên của bàn nguồn sang bàn trống.
# Giữ nguyên session_token + verify_code → điện thoại khách dùng tiếp, chỉ đổi số bàn.
module TableSessions
  class Move
    def self.call(...) = new(...).call

    def initialize(table, to:, user:)
      @from = table
      @to = to
      @user = user
    end

    def call
      raise ServiceError, "Bàn đích phải khác bàn hiện tại" if @from.id == @to.id

      session = nil
      ActiveRecord::Base.transaction do
        Table.where(id: [@from.id, @to.id]).order(:id).lock.load
        session = @from.reload.open_session or raise ServiceError, "#{@from.label} chưa có khách"
        raise ServiceError, "#{@to.label} đang có khách — dùng Gộp bàn" if @to.reload.open_session

        session.update!(table: @to)
        session.orders.update_all(table_id: @to.id)
        session.orders.each { |o| o.log_event!("move_table", user: @user, data: { from: @from.label, to: @to.label }) }
        # has_one :open_session đã nạp sẽ autosave gán lại table_id khi lưu bàn nguồn → reset trước
        @from.association(:open_session).reset
        @from.update!(status: "available")
        @to.update!(status: "occupied")
      end

      Publish.call(session, from: @from, to: @to, event: "session.moved")
      session
    end
  end
end
