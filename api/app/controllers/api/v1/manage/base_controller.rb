module Api
  module V1
    module Manage
      class BaseController < AuthenticatedController
        allow_roles :manager, :owner
        before_action :require_password_login!

        private

        # Phiên đăng nhập bằng PIN (máy dùng chung) không vào được trang quản lý (SPEC §4.1)
        def require_password_login!
          return unless auth_method == "pin"

          render json: { error: "Trang quản lý cần đăng nhập bằng email và mật khẩu" }, status: :forbidden
        end
      end
    end
  end
end
