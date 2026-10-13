module Api
  module V1
    module Staff
      # Ghi danh máy dùng chung cho đăng nhập PIN (SPEC §4.1). Chỉ quản lý / chủ, đăng nhập bằng mật khẩu.
      class DevicesController < BaseController
        allow_roles :manager, :owner
        before_action :require_password_login!

        def index
          render json: Device.active.includes(:registered_by).order(created_at: :desc).map { |d| json(d) }
        end

        # POST /staff/devices {name, lock_minutes} → token trả về 1 lần duy nhất
        def create
          device, token = Device.register!(name: params.require(:name), user: current_user, lock_minutes: params[:lock_minutes].presence)
          render json: json(device).merge(device_token: token), status: :created
        end

        def destroy
          Device.find(params[:id]).update!(revoked_at: Time.current)
          head :no_content
        end

        private

        def require_password_login!
          return unless auth_method == "pin"

          render json: { error: "Cần đăng nhập bằng mật khẩu để ghi danh / thu hồi máy" }, status: :forbidden
        end

        def json(d)
          d.slice(:id, :name, :lock_minutes, :last_used_at, :created_at).merge(registered_by: d.registered_by.name)
        end
      end
    end
  end
end
