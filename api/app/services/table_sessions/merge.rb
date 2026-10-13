# Gộp bàn (SPEC §2.5): mọi đơn + lượt gọi nhân viên của bàn nguồn chuyển vào phiên của bàn đích.
# Phiên nguồn đóng lại, merged_into → phiên đích; token khách bàn nguồn tự đi theo (TableSession.resolve).
module TableSessions
  class Merge
    def self.call(...) = new(...).call

    def initialize(table, into:, user:)
      @from = table
      @to = into
      @user = user
    end

    def call
      raise ServiceError, "Bàn đích phải khác bàn hiện tại" if @from.id == @to.id

      source = target = nil
      ActiveRecord::Base.transaction do
        Table.where(id: [@from.id, @to.id]).order(:id).lock.load
        source = @from.reload.open_session or raise ServiceError, "#{@from.label} chưa có khách"
        target = @to.reload.open_session or raise ServiceError, "#{@to.label} đang trống — dùng Chuyển bàn"

        source.orders.each { |o| o.log_event!("merge_table", user: @user, data: { from: @from.label, to: @to.label }) }
        source.orders.update_all(table_session_id: target.id, table_id: @to.id)
        source.staff_calls.update_all(table_session_id: target.id)
        source.update!(status: "closed", closed_at: Time.current, closed_by: @user, merged_into: target)
        # has_one :open_session đã nạp sẽ autosave gán lại table_id khi lưu bàn nguồn → reset trước
        @from.association(:open_session).reset
        @from.update!(status: "available")
      end

      Publish.call(target, from: @from, to: @to, event: "session.merged", notify_session: source)
      target
    end
  end
end
