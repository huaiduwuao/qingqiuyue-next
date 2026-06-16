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

# 容器:增量构建并启动前端(:3000)。
#   .last-build-web 记录上次构建的 git rev。无变化且 web 在运行 → 不调 compose(零噪音);
#   有变化 / 工作区改动 / web 未运行 → up -d --build。要强制重建用:make compose-up FORCE=1
WEB_MARK = .last-build-web
compose-up:
	@echo "Using compose tool: $(COMPOSE)"
	@last=$$(cat $(WEB_MARK) 2>/dev/null); cur=$$(git rev-parse HEAD 2>/dev/null); \
	dirty=$$(git status --porcelain 2>/dev/null | head -1); \
	rt=$$(case "$(COMPOSE)" in *podman*) echo podman;; *) echo docker;; esac); \
	running=$$($$rt ps --format '{{.Names}}' 2>/dev/null | grep -xc qingqiuyue-web); \
	if [ -n "$(FORCE)" ] || [ -z "$$cur" ] || [ -z "$$last" ] || [ "$$last" != "$$cur" ] || [ -n "$$dirty" ] || [ "$$running" = "0" ]; then \
	  echo "前端有变化/未运行 → 构建并启动 web…"; \
	  $(COMPOSE) -f $(COMPOSE_FILE) up -d --build; \
	  if [ -n "$$cur" ]; then echo "$$cur" > $(WEB_MARK); fi; \
	else \
	  echo "前端无变化且 web 在运行 → 无需操作(跳过构建)"; \
	fi

compose-down:
	$(COMPOSE) -f $(COMPOSE_FILE) down

compose-logs:
	$(COMPOSE) -f $(COMPOSE_FILE) logs -f

compose-ps:
	$(COMPOSE) -f $(COMPOSE_FILE) ps
