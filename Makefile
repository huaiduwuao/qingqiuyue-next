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

# 容器:每次都构建 web(Docker 层缓存,无改动即全命中、很快),
#   再只在「镜像真的变了 或 web 没在运行」时重建 → 保证跑最新代码,又不无谓重启。
#   不再用 .last-build-web / git diff(会出现「标记写了但没真构建」跑旧镜像)。
compose-up:
	@echo "Using compose tool: $(COMPOSE)"
	@rt=$$(case "$(COMPOSE)" in *podman*) echo podman;; *) echo docker;; esac); \
	img="localhost/qingqiuyue/web:latest"; \
	before=$$($$rt images -q "$$img" 2>/dev/null); \
	if [ -n "$$($$rt ps -a --format '{{.Names}}' 2>/dev/null | grep -x qingqiuyue-web)" ] && \
	   [ "$$($$rt ps --format '{{.Names}}' 2>/dev/null | grep -xc qingqiuyue-web)" = "0" ]; then \
	  echo "清理残留 stopped 容器: qingqiuyue-web"; $$rt rm qingqiuyue-web >/dev/null 2>&1 || true; \
	fi; \
	echo "构建 web …"; \
	$(COMPOSE) -f $(COMPOSE_FILE) build || { echo "❌ web 构建失败 → 保留旧容器"; exit 1; }; \
	after=$$($$rt images -q "$$img" 2>/dev/null); \
	if [ "$$before" != "$$after" ] || ! $$rt ps --format '{{.Names}}' 2>/dev/null | grep -qx qingqiuyue-web; then \
	  echo "镜像有更新或未运行 → 重建 web"; \
	  $(COMPOSE) -f $(COMPOSE_FILE) up -d --force-recreate; \
	else \
	  echo "web 镜像无变化且在运行 → 无需重建"; \
	fi; \
	echo "✅ compose-up 完成(跑的是最新构建的镜像)"

compose-down:
	$(COMPOSE) -f $(COMPOSE_FILE) down

compose-logs:
	$(COMPOSE) -f $(COMPOSE_FILE) logs -f

compose-ps:
	$(COMPOSE) -f $(COMPOSE_FILE) ps
