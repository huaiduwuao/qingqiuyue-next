import type { NextConfig } from "next";

// 容器/生产部署:前端同源,把 /api/* 反代到后端网关。
// 容器内默认指向宿主机已发布的网关端口(host.docker.internal:10000,podman/docker 均可),
// 可用 API_PROXY_TARGET 覆盖(如同 compose 网络内 http://gateway:10000)。
const API_PROXY_TARGET = process.env.API_PROXY_TARGET || "http://localhost:10000";

const nextConfig: NextConfig = {
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
    return [
      {
        source: "/api/:path*",
        destination: `${API_PROXY_TARGET}/api/:path*`,
      },
      {
        // logtail 日志平台:同源 /logs/* 反代到网关 /logs/*(APISIX 再转 logtail-server)
        source: "/logs/:path*",
        destination: `${API_PROXY_TARGET}/logs/:path*`,
      },
    ];
  },
};

export default nextConfig;
