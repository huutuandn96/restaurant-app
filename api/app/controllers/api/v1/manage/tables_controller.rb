module Api
  module V1
    module Manage
      class TablesController < BaseController
        def index
          render json: Table.ordered.includes(:open_session).map { |t| TableSerializer.call(t, with_qr: true) }
        end

        def create
          render json: TableSerializer.call(Table.create!(table_params), with_qr: true), status: :created
        end

        def update
          t = Table.find(params[:id])
          t.update!(table_params)
          render json: TableSerializer.call(t, with_qr: true)
        end

        def destroy
          Table.find(params[:id]).destroy!
          head :no_content
        end

        # Tạo lại QR thủ công khi QR bị lộ/hỏng (SPEC §2.1)
        def regenerate_qr
          t = Table.find(params[:id])
          t.regenerate_qr_token!
          render json: TableSerializer.call(t, with_qr: true)
        end

        private

        def table_params = params.permit(:number, :area, :seats)
      end
    end
  end
end
