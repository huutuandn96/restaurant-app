# Realtime sau chuyển / gộp bàn: đơn đổi số bàn (bếp, phục vụ), sơ đồ bàn, và báo điện thoại khách
module TableSessions
  class Publish
    def self.call(session, from:, to:, event:, notify_session: session)
      session.orders.includes(:table, :table_session, :confirmed_by, :order_items).find_each { |o| Realtime.order_changed(o) }
      [from, to].each do |t|
        Realtime.publish(rooms: %w[waiters managers], event: "table.updated", payload: TableSerializer.call(t.reload))
      end
      Realtime.publish(rooms: "table_session:#{notify_session.id}", event:,
                       payload: { table_session_id: session.id, table: TableSerializer.call(to, session: nil) })
    end
  end
end
