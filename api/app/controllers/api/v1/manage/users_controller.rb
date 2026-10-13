module Api
  module V1
    module Manage
      class UsersController < BaseController
        allow_roles :owner

        def index
          render json: User.order(:role, :name).map { |u| UserSerializer.call(u) }
        end

        def create
          render json: UserSerializer.call(User.create!(user_params)), status: :created
        end

        def update
          u = User.find(params[:id])
          attrs = user_params
          attrs = attrs.except(:password) if attrs[:password].blank?
          raise ServiceError, "Không thể tự khoá hoặc đổi quyền của chính mình" if u == current_user && (attrs.key?(:active) || attrs.key?(:role))

          u.update!(attrs)
          render json: UserSerializer.call(u)
        end

        private

        def user_params = params.permit(:name, :email, :password, :role, :active)
      end
    end
  end
end
