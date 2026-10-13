module TableSerializer
  module_function

  def call(table, session: :auto, with_qr: false)
    session = table.open_session if session == :auto
    {
      id: table.id,
      number: table.number,
      label: table.label,
      area: table.area,
      seats: table.seats,
      status: table.status,
      session: session && session_json(session)
    }.tap do |h|
      h.merge!(qr_token: table.qr_token, qr_url: table.qr_url) if with_qr
    end
  end

  def session_json(session)
    {
      id: session.id,
      verify_code: session.verify_code,
      status: session.status,
      opened_at: session.opened_at,
      closed_at: session.closed_at
    }
  end
end
