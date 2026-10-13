module Api
  module V1
    class HealthController < ApplicationController
      def show
        db = ActiveRecord::Base.connection.select_value("SELECT 1") == 1
        redis = Redis.new(url: REDIS_URL).ping == "PONG"
        render json: { status: "ok", db: db, redis: redis, time: Time.current }
      end
    end
  end
end
