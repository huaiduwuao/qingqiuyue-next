.PHONY: dev build start lint compose-up compose-down compose-logs compose-ps

COMPOSE_FILE=docker-compose.yml
# 自动探测可用的 compose 工具:docker compose > podman-compose > podman compose
COMPOSE ?= $(shell \
	if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then echo "docker compose"; \
	elif command -v podman-compose >/dev/null 2>&1; then echo "podman-compose"; \
	elif command -v podman >/dev/null 2>&1 && podman compose version >/dev/null 2>&1; then echo "podman compose"; \
	else echo "docker compose"; fi)

# 本地开发(非容器)
dev:
	npm run dev

build:
	npm run build

start:
	npm run start

lint:
	npm run lint

# 容器:构建并启动前端(:3000)
compose-up:
	@echo "Using compose tool: $(COMPOSE)"
	$(COMPOSE) -f $(COMPOSE_FILE) up -d --build

compose-down:
	$(COMPOSE) -f $(COMPOSE_FILE) down

compose-logs:
	$(COMPOSE) -f $(COMPOSE_FILE) logs -f

compose-ps:
	$(COMPOSE) -f $(COMPOSE_FILE) ps
