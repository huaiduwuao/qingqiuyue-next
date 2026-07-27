# ===== CSR 静态构建 =====
FROM docker.io/library/node:22-alpine AS builder
WORKDIR /app
ARG NEXT_PUBLIC_API_BASE_URL=https://qingqiuyue.com
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_EXPORT_STATIC=true
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
# 设置国内镜像解决 corepack/pnpm 下载问题
ENV COREPACK_NPM_REGISTRY=https://registry.npmmirror.com
ENV HUSKY=0
RUN corepack enable && corepack prepare pnpm@9 --activate

# 先复制 lockfile 和 package.json，只安装依赖（利用 Docker 缓存）
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-workspace

# 再复制源码，这样只有源码变化时才重新构建
COPY . .
RUN pnpm run build

# ===== nginx 运行镜像 =====
FROM docker.io/library/nginx:alpine AS runner
# 复制静态文件到 nginx
COPY --from=builder /app/out /usr/share/nginx/html
# 复制 nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
