module ReservationSerializer
  module_function

  def call(r)
    {
      id: r.id,
      customer_name: r.customer_name,
      phone: r.phone,
      party_size: r.party_size,
      reserved_at: r.reserved_at,
      note: r.note,
      status: r.status,
      late: r.late?,
      table: { id: r.table.id, number: r.table.number, label: r.table.label, area: r.table.area, seats: r.table.seats },
      created_by: r.created_by&.slice(:id, :name),
      arrived_at: r.arrived_at,
      cancelled_at: r.cancelled_at,
      created_at: r.created_at
    }
  end
end
