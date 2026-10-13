module Api
  module V1
    module Staff
      # Đăng ký Web Push cho máy / trình duyệt hiện tại (SPEC §1.1)
      class PushController < BaseController
        allow_roles :waiter, :kitchen, :manager, :owner

        # GET /staff/push → khoá công khai VAPID để trình duyệt subscribe
        def show
          render json: { enabled: WebPushConfig.enabled?, public_key: WebPushConfig.public_key,
                         subscriptions: current_user_subs.count }
        end

        # POST /staff/push {endpoint, keys: {p256dh, auth}} — cùng endpoint thì chuyển sang user đang đăng nhập
        def create
          raise ServiceError, "Máy chủ chưa cấu hình push (VAPID)" unless WebPushConfig.enabled?

          sub = PushSubscription.find_or_initialize_by(endpoint: params.require(:endpoint))
          sub.update!(user: current_user, p256dh: params.require(:keys).require(:p256dh), auth: params[:keys].require(:auth),
                      user_agent: request.user_agent.to_s.first(250))
          head :created
        end

        # DELETE /staff/push {endpoint}
        def destroy
          current_user_subs.where(endpoint: params.require(:endpoint)).delete_all
          head :no_content
        end

        # POST /staff/push/test — gửi thử tới các máy của chính mình
        def test
          raise ServiceError, "Chưa bật thông báo trên máy nào" unless current_user_subs.exists?

          PushNotifyJob.perform_now(roles: [current_user.role], title: "🔔 Thông báo thử",
                                    body: "Máy này sẽ nhận báo đơn mới kể cả khi tắt màn hình", url: "/staff", tag: "test")
          head :no_content
        end

        private

        def current_user_subs = PushSubscription.where(user: current_user)
      end
    end
  end
end
