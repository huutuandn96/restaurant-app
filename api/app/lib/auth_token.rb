# JWT cho REST API (JWT_SECRET) và cho Socket.IO (SOCKET_JWT_SECRET) — SPEC §1
module AuthToken
  API_TTL = 12.hours
  SOCKET_TTL = 12.hours

  module_function

  def issue_user(user)
    encode({ sub: user.id, role: user.role }, api_secret, API_TTL)
  end

  def decode_user(token)
    JWT.decode(token, api_secret, true, algorithm: "HS256").first
  rescue JWT::DecodeError
    nil
  end

  def socket_for_user(user)
    encode({ kind: "staff", role: user.role, user_id: user.id }, socket_secret, SOCKET_TTL)
  end

  def socket_for_session(session)
    encode({ kind: "guest", table_session_id: session.id }, socket_secret, SOCKET_TTL)
  end

  def encode(payload, secret, ttl)
    JWT.encode(payload.merge(exp: ttl.from_now.to_i), secret, "HS256")
  end

  def api_secret = ENV.fetch("JWT_SECRET")
  def socket_secret = ENV.fetch("SOCKET_JWT_SECRET")
end
