module Api
  module V1
    module Manage
      # Mã voucher (SPEC §5.6)
      class VouchersController < BaseController
        def index
          render json: Voucher.order(created_at: :desc).map { |v| json(v) }
        end

        def create
          render json: json(Voucher.create!(voucher_params)), status: :created
        end

        def update
          v = Voucher.find(params[:id])
          v.update!(voucher_params)
          render json: json(v)
        end

        def destroy
          v = Voucher.find(params[:id])
          raise ServiceError, "Mã đã được dùng — tắt mã thay vì xoá" if v.used_count.positive? || v.table_sessions.exists?

          v.destroy!
          head :no_content
        end

        private

        def json(v) = v.as_json(except: %i[created_at updated_at]).merge("usable" => v.unusable_reason.nil?)

        def voucher_params
          params.permit(:code, :kind, :value, :max_discount, :min_spend, :starts_at, :ends_at, :usage_limit, :active, :note)
        end
      end
    end
  end
end
