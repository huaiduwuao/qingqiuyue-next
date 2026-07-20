# ===== builder:构建静态产物 =====
FROM docker.io/library/node:22-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9 --activate
COPY . .
# 强制静态导出模式，生成 out/ 目录
ENV NEXT_EXPORT_STATIC=true
ENV NEXT_TELEMETRY_DISABLED=1
# API 反代在构建时内联（output:export 下 rewrites 仍生效）
ARG API_PROXY_TARGET=http://apisix:9080
ENV API_PROXY_TARGET=$API_PROXY_TARGET
ARG CONTENT_API_PROXY_TARGET=http://apisix:9080
ENV CONTENT_API_PROXY_TARGET=$CONTENT_API_PROXY_TARGET
RUN pnpm install --frozen-lockfile && pnpm run build

# ===== runner:最小静态文件服务器 =====
FROM docker.io/library/nginx:alpine AS runner
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/out ./usr/share/nginx/html
