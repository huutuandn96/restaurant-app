SHELL := /bin/bash
COMPOSE := docker compose
s ?= api

-include .env

.DEFAULT_GOAL := help
.PHONY: help env ip setup build up down restart logs ps migrate seed reset-db console bash test qr urls s3 e2e

help: ## Danh sách lệnh
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-10s\033[0m %s\n",$$1,$$2}'

env: ## Tạo .env từ .env.example (nếu chưa có)
	@test -f .env || (cp .env.example .env && echo "Created .env")

ip: env ## Detect IP LAN (macOS) và ghi vào .env
	@IP=$$(ipconfig getifaddr en0 || ipconfig getifaddr en1); \
	if [ -z "$$IP" ]; then echo "Không tìm được IP LAN"; exit 1; fi; \
	sed -i '' "s/^LAN_IP=.*/LAN_IP=$$IP/" .env && echo "LAN_IP=$$IP"

setup: env ip build ## Lần đầu: .env + IP + build + DB
	$(COMPOSE) up -d db redis
	$(COMPOSE) run --rm api bin/rails db:prepare
	@$(MAKE) --no-print-directory up

build: ## Build images
	$(COMPOSE) build

up: ## Chạy toàn bộ
	$(COMPOSE) up -d
	@$(MAKE) --no-print-directory urls

down: ## Dừng toàn bộ
	$(COMPOSE) down

restart: ## Restart service (s=api)
	$(COMPOSE) restart $(s)

logs: ## Xem log (s=api, bỏ trống s= để xem tất cả)
	$(COMPOSE) logs -f --tail=100 $(s)

ps: ## Trạng thái container
	$(COMPOSE) ps

migrate: ## Chạy migration
	$(COMPOSE) exec api bin/rails db:migrate

seed: ## Seed dữ liệu demo
	$(COMPOSE) exec api bin/rails db:seed

reset-db: ## Xoá DB, tạo lại + seed
	$(COMPOSE) exec api bin/rails db:drop db:create db:migrate db:seed DISABLE_DATABASE_ENVIRONMENT_CHECK=1

console: ## Rails console
	$(COMPOSE) exec api bin/rails console

bash: ## Shell vào container (s=api)
	$(COMPOSE) exec $(s) sh

e2e: ## Test end-to-end toàn bộ flow (REST + realtime + ảnh), BASE=http://LAN_IP:5173 để test qua LAN
	$(COMPOSE) exec -e BASE=$(or $(BASE),http://localhost:5173) web node scripts/e2e.mjs

test: ## Chạy test backend
	$(COMPOSE) exec -e RAILS_ENV=test api bash -c "bin/rails db:prepare && bundle exec rspec"

qr: ## In URL QR của các bàn
	@$(COMPOSE) exec api bin/rails tables:urls

urls: ## In các URL truy cập
	@echo ""
	@echo "  Web (máy này) : http://localhost:$(WEB_PORT)"
	@echo "  Web (LAN)     : http://$(LAN_IP):$(WEB_PORT)"
	@echo "  Staff         : http://$(LAN_IP):$(WEB_PORT)/staff"
	@echo "  Manage        : http://$(LAN_IP):$(WEB_PORT)/manage"
	@echo "  API health    : http://localhost:$(API_PORT)/api/v1/health"
	@echo "  S3 console    : http://localhost:$(S3_CONSOLE_PORT)/rustfs/console/  ($(S3_ACCESS_KEY) / $(S3_SECRET_KEY))"
	@echo ""

s3: ## Link + tài khoản S3 console (RustFS giả lập S3)
	@echo "  http://localhost:$(S3_CONSOLE_PORT)/rustfs/console/  user: $(S3_ACCESS_KEY)  pass: $(S3_SECRET_KEY)  bucket: $(S3_BUCKET)"
