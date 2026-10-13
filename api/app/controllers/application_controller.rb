class ApplicationController < ActionController::API
  rescue_from ServiceError do |e|
    render json: { error: e.message }, status: e.status
  end
  rescue_from ActiveRecord::RecordNotFound do
    render json: { error: "Không tìm thấy" }, status: :not_found
  end
  rescue_from ActiveRecord::RecordInvalid do |e|
    render json: { error: e.record.errors.full_messages.to_sentence, errors: e.record.errors }, status: :unprocessable_entity
  end
  rescue_from ActiveRecord::DeleteRestrictionError, ActiveRecord::InvalidForeignKey do
    render json: { error: "Không thể xoá vì đang được sử dụng" }, status: :unprocessable_entity
  end
  rescue_from ActionController::ParameterMissing do |e|
    render json: { error: e.message }, status: :bad_request
  end
end
