Sidekiq.configure_server { |c| c.redis = { url: REDIS_URL } }
Sidekiq.configure_client { |c| c.redis = { url: REDIS_URL } }
