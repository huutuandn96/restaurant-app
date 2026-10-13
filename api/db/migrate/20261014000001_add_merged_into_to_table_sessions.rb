class AddMergedIntoToTableSessions < ActiveRecord::Migration[8.1]
  def change
    # Gộp bàn (SPEC §2.5): phiên nguồn đóng lại và trỏ sang phiên đích để token khách đi theo
    add_reference :table_sessions, :merged_into, foreign_key: { to_table: :table_sessions }, null: true
  end
end
