module Api
  module V1
    module Manage
      # Happy hour (SPEC §5.6)
      class PromotionsController < BaseController
        def index
          now = Time.current
          render json: Promotion.order(:start_time, :id).map { |p| json(p, now) }
        end

        def create
          p = Promotion.create!(promotion_params)
          broadcast
          render json: json(p), status: :created
        end

        def update
          p = Promotion.find(params[:id])
          p.update!(promotion_params)
          broadcast
          render json: json(p)
        end

        def destroy
          Promotion.find(params[:id]).destroy!
          broadcast
          head :no_content
        end

        private

        def json(p, now = Time.current)
          p.as_json(except: %i[created_at updated_at]).merge("running" => p.running?(now))
        end

        # Giá trên menu khách đổi ngay → báo khách tải lại menu
        def broadcast
          Realtime.publish(rooms: %w[guests managers], event: "menu.refresh", payload: {})
        end

        def promotion_params
          params.permit(:name, :percent, :start_time, :end_time, :starts_on, :ends_on, :active,
                        category_ids: [], menu_item_ids: [], weekdays: [])
        end
      end
    end
  end
end
