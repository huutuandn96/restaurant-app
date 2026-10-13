module Api
  module V1
    class AuthController < AuthenticatedController
      skip_before_action :authenticate!, only: %i[login pin_users pin_login]
      before_action :require_device!, only: %i[pin_users pin_login]

      def login
        user = User.active.find_by(email: params.require(:email).to_s.strip.downcase)
        if user&.authenticate(params.require(:password))
          render json: session_payload(user)
        else
          render json: { error: "Email hoặc mật khẩu không đúng" }, status: :unauthorized
        end
      end

      def me
        render json: session_payload(current_user)
      end

      # GET /auth/pin/users — header X-Device-Token. Nhân viên đã đặt PIN, để chọn tên trên màn PIN
      def pin_users
        users = User.active.where.not(pin_digest: nil).order(:role, :name)
        render json: { device: device_json(@device), users: users.map { |u| u.slice(:id, :name, :role) } }
      end

      # POST /auth/pin {user_id, pin} — header X-Device-Token
      def pin_login
        user = User.active.where.not(pin_digest: nil).find_by(id: params.require(:user_id))
        raise ServiceError.new("Nhân viên không tồn tại hoặc chưa đặt PIN", status: :unauthorized) unless user
        if user.pin_locked?
          raise ServiceError.new("Sai PIN quá nhiều lần, thử lại sau #{((user.pin_locked_until - Time.current) / 60).ceil} phút", status: :locked)
        end

        unless user.verify_pin!(params.require(:pin))
          left = User::PIN_MAX_ATTEMPTS - user.pin_failed_attempts
          msg = user.pin_locked? ? "Sai PIN quá nhiều lần, khoá #{User::PIN_LOCK.in_minutes.to_i} phút" : "PIN không đúng (còn #{left} lần thử)"
          raise ServiceError.new(msg, status: :unauthorized)
        end

        @device.update_column(:last_used_at, Time.current)
        render json: session_payload(user, via: "pin")
      end

      # PUT /auth/pin {pin, password} — tự đặt / đổi PIN (cần mật khẩu)
      def update_pin
        raise ServiceError.new("Mật khẩu không đúng", status: :unauthorized) unless current_user.authenticate(params[:password].to_s)

        current_user.pin = params.require(:pin)
        current_user.save!
        head :no_content
      end

      private

      def session_payload(user, via: "password")
        { user: UserSerializer.call(user), token: AuthToken.issue_user(user, via:), socket_token: AuthToken.socket_for_user(user), via: }
      end

      def require_device!
        @device = Device.find_by_token(request.headers["X-Device-Token"])
        raise ServiceError.new("Máy chưa được ghi danh hoặc đã bị thu hồi", status: :unauthorized) unless @device
      end

      def device_json(d) = d.slice(:id, :name, :lock_minutes)
    end
  end
end
