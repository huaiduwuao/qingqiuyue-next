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

# 容器:强制重新构建 web(每次都 --no-cache 确保 USE_EXTERNAL_DIGITAL_HUMAN_API 等 build-arg 生效),
#   再只在「镜像变了 或 web 没在运行」时重建容器 → 保证跑最新代码。
compose-up:
	@echo "Using compose tool: $(COMPOSE)"
	@rt=$$(case "$(COMPOSE)" in *podman*) echo podman;; *) echo docker;; esac); \
	img="localhost/qingqiuyue/web:latest"; \
	echo "--- 清理残留 stopped 容器 ---"; \
	$$rt rm qingqiuyue-web >/dev/null 2>&1 || true; \
	echo "--- 强制重新构建 web (--no-cache) ---"; \
	$(COMPOSE) -f $(COMPOSE_FILE) build --no-cache || { echo "❌ web 构建失败"; exit 1; }; \
	echo "--- 启动/重建容器 ---"; \
	$(COMPOSE) -f $(COMPOSE_FILE) up -d --force-recreate; \
	echo "--- 验证环境变量 ---"; \
	$$rt exec qingqiuyue-web env | grep -E "USE_EXTERNAL|NEXT_PUBLIC" || echo "(环境变量在构建时内联,运行时 grep 为空是正常的)"; \
	echo "--- 验证 API ---"; \
	curl -s 'http://localhost:10809/api/digital-human/instructions' | head -c 200 && echo "..."; \
	echo ""; \
	echo "✅ compose-up 完成"

compose-down:
	$(COMPOSE) -f $(COMPOSE_FILE) down

compose-logs:
	$(COMPOSE) -f $(COMPOSE_FILE) logs -f

compose-ps:
	$(COMPOSE) -f $(COMPOSE_FILE) ps
