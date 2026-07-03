import type { NextConfig } from "next";

// 容器/生产部署:前端同源,把 /api/* 反代到后端网关。
// 容器内默认指向宿主机已发布的网关端口(host.docker.internal:10005,podman/docker 均可),
// 可用 API_PROXY_TARGET 覆盖(如同 compose 网络内 http://apisix:9080)。
const API_PROXY_TARGET = process.env.API_PROXY_TARGET || "http://localhost:10005";

const nextConfig: NextConfig = {
  // standalone 模式:Dockerfile 期望 .next/standalone 存在,生产部署必须开。
  // dev 模式 `next dev` 仍正常工作(standalone 只影响 `next build` 输出)。
  output: "standalone",
  compiler: {
    reactRemoveProperties: true,
  },
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  // pg 等 Node-only 依赖被客户端组件间接引用(task-engine 等),临时 fallback 避免构建失败。
  // 这些模块在浏览器端实际不会执行(DB 写入已被 try/catch 吞掉),后续应把持久化逻辑彻底拆到服务端。
  // 当前项目使用 webpack 构建(见 package.json build script),此 fallback 仅作用于客户端 bundle。
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // fallback 把 require('fs') 等替换成空模块, 但 pg 内部的 require 仍会触发
      // webpack 分析时报 "Can't resolve 'fs'" → 进一步把 pg 家族强制成 client external,
      // 浏览器端 require 直接抛错(代码路径不会被走到)
      config.resolve.fallback = {
        ...config.resolve.fallback,
        dns: false,
        fs: false,
        net: false,
        tls: false,
        path: false,
        crypto: false,
        'util/types': false,
        'pg-native': false,
        'pg-connection-string': false,
      };
      config.externals = [
        ...(config.externals || []),
        // @ts-expect-error - pg 家族包类型在 webpack 文档里没声明
        function externalPgOrDrizzle(request, callback) {
          if (
            request === 'pg' ||
            request === 'pg-connection-string' ||
            request === 'drizzle-orm/node-postgres' ||
            request === 'drizzle-orm'
          ) {
            return callback(undefined, 'commonjs ' + request);
          }
          callback();
        },
      ];
    }
    return config;
  },
  // 数字人 GLB 资源:dev 模式强制 no-store,避免浏览器 HTTP cache 卡住旧文件
  // (改完 Blender 脚本重生成 GLB 后,普通 F5 刷新就能拿新版,不用 Ctrl+Shift+R)
  async headers() {
    return [
      {
        source: '/avatars/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, must-revalidate' },
        ],
      },
    ];
  },
  async rewrites() {
    // avatar pipeline 路由必须在本地处理(Next.js spawn 脚本 + MinIO 客户端),
    // 不能被反代到 Go 后端。Next.js 路由优先匹配,理论上不需要显式 exclusion,
    // 但加一个 no-op rewrite 让规则显式可见,免得未来有人把 avatar pipeline
    // 路由挪走之后被反代劫掉。
    const pipelineNoop = {
      source: '/api/avatar/pipeline/:path*',
      destination: '/api/avatar/pipeline/:path*',
    };
    // 没有真后端网关时:完全跳过 /api/* 和 /logs/* 反代,避免 500 / ECONNREFUSED
    // 让客户端 fetch 直接 404,避免 react-query 重试循环拖垮 dev server。
    // 接入真网关时:删掉这个 if,恢复下面两段 rewrites。
    if (process.env.API_PROXY_TARGET === 'disabled' || !process.env.API_PROXY_TARGET) {
      return [
        pipelineNoop,
        // audio 网关代理 noop
        { source: '/api/audio/:path*', destination: '/api/audio/:path*' },
        { source: '/api/:path*', destination: '/api-stub/:path*' },
        { source: '/logs/:path*', destination: '/logs-stub/:path*' },
      ];
    }
    const target = API_PROXY_TARGET;
    return [
      pipelineNoop,
      // audio 网关代理 (/api/audio/* → audio-gateway :8001),
      // 不能被反代劫到 Go 后端
      {
        source: "/api/audio/:path*",
        destination: "/api/audio/:path*",
      },
      {
        source: "/api/:path*",
        destination: `${target}/api/:path*`,
      },
      {
        source: "/logs/:path*",
        destination: `${target}/logs/:path*`,
      },
    ];
  },
};

export default nextConfig;
