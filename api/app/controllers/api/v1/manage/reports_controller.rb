module Api
  module V1
    module Manage
      class ReportsController < BaseController
        allow_roles :owner

        # GET /manage/reports/revenue?from=&to=&group=day|month[&format=csv]
        def revenue
          from = Date.parse(params[:from].presence || Date.current.beginning_of_month.to_s)
          to = Date.parse(params[:to].presence || Date.current.to_s)
          report = Reports::Revenue.new(from:, to:, group: params[:group])

          if params[:format] == "csv"
            send_data report.to_csv, type: "text/csv; charset=utf-8",
                                     filename: "doanh-thu_#{from}_#{to}_#{params[:group] || 'day'}.csv"
          else
            render json: report.call
          end
        rescue Date::Error
          raise ServiceError, "Ngày không hợp lệ"
        end
      end
    end
  end
end
