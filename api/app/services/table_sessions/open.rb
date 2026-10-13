# Khách quét QR: lấy session đang mở của bàn hoặc tạo mới (SPEC §2.2)
module TableSessions
  class Open
    def self.call(table) = new(table).call

    def initialize(table)
      @table = table
    end

    def call
      session = @table.open_session
      return session if session

      created = ActiveRecord::Base.transaction do
        s = @table.table_sessions.create!
        @table.update!(status: "occupied")
        s
      end
      Realtime.publish(rooms: %w[waiters managers], event: "table.updated",
                       payload: TableSerializer.call(@table.reload, session: created))
      created
    rescue ActiveRecord::RecordNotUnique
      # 2 khách quét cùng lúc → index unique chặn, dùng session vừa tạo
      @table.reload.open_session
    end
  end
end
