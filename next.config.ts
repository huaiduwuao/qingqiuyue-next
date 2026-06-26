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
        { source: '/api/:path*', destination: '/api-stub/:path*' },
        { source: '/logs/:path*', destination: '/logs-stub/:path*' },
      ];
    }
    const target = process.env.API_PROXY_TARGET;
    return [
      pipelineNoop,
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
