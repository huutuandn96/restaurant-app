module Api
  module V1
    module Manage
      class UsersController < BaseController
        allow_roles :owner

        def index
          render json: User.order(:role, :name).map { |u| UserSerializer.call(u) }
        end

        def create
          u = User.new(user_params)
          u.pin = params[:pin] if params[:pin].present?
          u.save!
          render json: UserSerializer.call(u), status: :created
        end

        def update
          u = User.find(params[:id])
          attrs = user_params
          attrs = attrs.except(:password) if attrs[:password].blank?
          raise ServiceError, "Không thể tự khoá hoặc đổi quyền của chính mình" if u == current_user && (attrs.key?(:active) || attrs.key?(:role))

          u.pin = params[:pin] if params[:pin].present?
          u.pin_digest = nil if params[:clear_pin]
          u.update!(attrs)
          render json: UserSerializer.call(u)
        end

        private

        def user_params = params.permit(:name, :email, :password, :role, :active)
      end
    end
  end
end
