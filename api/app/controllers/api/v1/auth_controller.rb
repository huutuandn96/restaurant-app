module Api
  module V1
    class AuthController < AuthenticatedController
      skip_before_action :authenticate!, only: :login

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

      private

      def session_payload(user)
        { user: UserSerializer.call(user), token: AuthToken.issue_user(user), socket_token: AuthToken.socket_for_user(user) }
      end
    end
  end
end
