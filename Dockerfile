# ===== deps:安装依赖 =====
FROM docker.io/library/node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# --legacy-peer-deps 兜底: 防止 peer dep 冲突(如 three-vrm 与 three 主版本不一致)
RUN npm ci --legacy-peer-deps

# ===== builder:构建 standalone 产物 =====
FROM docker.io/library/node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# 容器内前端同源(/api 走 Next rewrites 反代),默认关闭浏览器端 MSW mock。
# 做成 ARG 便于 compose 显式覆盖;.dockerignore 已排除 .env*.local,
# 开发用的 .env.local(NEXT_PUBLIC_USE_MOCK=true)不会进镜像、不会覆盖这里。
ARG NEXT_PUBLIC_USE_MOCK=0
ENV NEXT_PUBLIC_USE_MOCK=$NEXT_PUBLIC_USE_MOCK
ENV NEXT_PUBLIC_API_BASE_URL=""
ENV NEXT_TELEMETRY_DISABLED=1
# === 数字人指令存储模式 (Next.js API route 在构建时读取,必须在 build 前设置) ===
ARG USE_EXTERNAL_DIGITAL_HUMAN_API=false
ENV USE_EXTERNAL_DIGITAL_HUMAN_API=$USE_EXTERNAL_DIGITAL_HUMAN_API
# 关键:next.config.ts 里 API_PROXY_TARGET 在 build 期被内联进 rewrites,
# 必须在 build 时就有,否则 rewrite 目标会回退到默认 http://localhost:10000。
# 默认值与 docker-compose.yml 里的同网络目标保持一致(可直接覆盖)。
ARG API_PROXY_TARGET=http://apisix:9080
ENV API_PROXY_TARGET=$API_PROXY_TARGET
RUN npm run build

# ===== runner:最小运行镜像 =====
FROM docker.io/library/node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# standalone 输出 + 静态资源 + public(含 mockServiceWorker.js / avatar 等)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
