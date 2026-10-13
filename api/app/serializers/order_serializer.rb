module OrderSerializer
  module_function

  def call(order, events: false)
    {
      id: order.id,
      code: order.code,
      status: order.status,
      note: order.note,
      total: order.total,
      table: { id: order.table.id, number: order.table.number, label: order.table.label, area: order.table.area },
      table_session_id: order.table_session_id,
      verify_code: order.table_session.verify_code,
      confirmed_by: order.confirmed_by&.slice(:id, :name),
      created_at: order.created_at,
      confirmed_at: order.confirmed_at,
      ready_at: order.ready_at,
      completed_at: order.completed_at,
      cancelled_at: order.cancelled_at,
      cancel_reason: order.cancel_reason,
      items: order.order_items.map { |i| item(i) }
    }.tap do |h|
      h[:events] = order.order_events.includes(:user).map { |e| event(e) } if events
    end
  end

  def item(i)
    {
      id: i.id,
      order_id: i.order_id,
      menu_item_id: i.menu_item_id,
      name: i.name_snapshot,
      price: i.price_snapshot,
      quantity: i.quantity,
      subtotal: i.subtotal,
      note: i.note,
      status: i.status,
      done_at: i.done_at
    }
  end

  def event(e)
    {
      id: e.id,
      action: e.action,
      from_status: e.from_status,
      to_status: e.to_status,
      data: e.data,
      user: e.user&.slice(:id, :name, :role),
      created_at: e.created_at
    }
  end
end
