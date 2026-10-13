module Api
  module V1
    # Staff / Manage: Bearer JWT. Phân quyền theo role (SPEC §4)
    class AuthenticatedController < ApplicationController
      before_action :authenticate!

      def self.allow_roles(*roles, **opts)
        before_action(**opts) { require_roles!(roles.map(&:to_s)) }
      end

      private

      attr_reader :current_user

      def authenticate!
        token = request.authorization.to_s.delete_prefix("Bearer ").presence
        claims = token && AuthToken.decode_user(token)
        @current_user = claims && User.active.find_by(id: claims["sub"])
        render json: { error: "Chưa đăng nhập" }, status: :unauthorized unless @current_user
      end

      def require_roles!(roles)
        return if roles.include?(current_user.role)

        render json: { error: "Không có quyền" }, status: :forbidden
      end
    end
  end
end
