# ===== deps:安装依赖 =====
FROM docker.io/library/node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ===== builder:构建 standalone 产物 =====
FROM docker.io/library/node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# 容器内前端同源(/api 走 Next rewrites 反代),关闭浏览器端 MSW mock
ENV NEXT_PUBLIC_USE_MOCK=0
ENV NEXT_PUBLIC_API_BASE_URL=""
ENV NEXT_TELEMETRY_DISABLED=1
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
