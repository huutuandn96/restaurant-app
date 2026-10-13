module StaffCallSerializer
  module_function

  def call(c)
    t = c.table_session.table
    { id: c.id, status: c.status, created_at: c.created_at, table_session_id: c.table_session_id,
      table: { id: t.id, number: t.number, label: t.label, area: t.area } }
  end
end
