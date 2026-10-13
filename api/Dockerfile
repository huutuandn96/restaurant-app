# Image production (docker-compose.prod.yml). Dev dùng Dockerfile.dev.
FROM ruby:3.3-slim AS build
RUN apt-get update -qq && apt-get install -y --no-install-recommends build-essential libpq-dev libyaml-dev git \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV BUNDLE_PATH=/usr/local/bundle BUNDLE_WITHOUT="development:test" BUNDLE_DEPLOYMENT=1
COPY Gemfile Gemfile.lock ./
RUN bundle install && rm -rf "$BUNDLE_PATH"/ruby/*/cache
COPY . .
RUN bundle exec bootsnap precompile app/ lib/

FROM ruby:3.3-slim
RUN apt-get update -qq && apt-get install -y --no-install-recommends libpq5 libyaml-0-2 postgresql-client libvips42 curl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV RAILS_ENV=production BUNDLE_PATH=/usr/local/bundle BUNDLE_WITHOUT="development:test" BUNDLE_DEPLOYMENT=1 \
    RAILS_LOG_TO_STDOUT=1
COPY --from=build /usr/local/bundle /usr/local/bundle
COPY --from=build /app /app
RUN useradd -m -u 1000 rails && mkdir -p tmp log storage && chown -R rails:rails tmp log storage
USER rails
EXPOSE 3000
CMD ["bin/docker-entrypoint-prod"]
