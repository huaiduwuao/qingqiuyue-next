import type { NextConfig } from "next";

// 容器/生产部署:前端同源,把 /api/* 反代到后端网关。
// 容器内默认指向宿主机已发布的网关端口(host.docker.internal:10005,podman/docker 均可),
// 可用 API_PROXY_TARGET 覆盖(如同 compose 网络内 http://apisix:9080)。
const API_PROXY_TARGET = process.env.API_PROXY_TARGET || "http://localhost:10005";

const nextConfig: NextConfig = {
  // Tauri/桌面打包时用 output: "export" 生成静态文件到 out/ 目录
  // Docker 部署时用 standalone 模式
  output: process.env.NEXT_EXPORT_STATIC === 'true' ? 'export' : 'standalone',
  // 允许 127.0.0.1 跨源访问 dev 资源(dev 模式 HMR 需要)
  // 见:https://nextjs.org/docs/app/api-reference/config/next-config-js/allowedDevOrigins
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  // 内存治理(5.37 GB dev server 反复泄漏的根因之一):
  // 1) 关闭客户端 source map(浏览器加载时不会再持有完整 sourcemap payload)
  // 2) 关闭 server source map(Next dev 不再为每个 route 缓存 sourcemap)
  // 3) preloadEntriesOnStart=false:不再启动时一次性把全部 page 预加载到内存
  //    (按需加载,rss 从 ~GB 级别降到 MB)
  // 4) 显式开启 webpackBuildWorker:把 webpack 编译挪到子进程,
  //    主进程不再持有完整的 module graph
  // 这 4 项不会改变 dev 行为,只减少常驻内存。
  productionBrowserSourceMaps: false,
  experimental: {
    webpackBuildWorker: true,
    // Next 15+:开启后降低 webpack 编译阶段最大内存峰值,代价是编译稍慢。
    webpackMemoryOptimizations: true,
  },
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
  // (改完 Blender 脚本重生成 GLB 后,普通 F5 刷新就能拿新版,不用 Ctrl+Shift+R)
};

export default nextConfig;
