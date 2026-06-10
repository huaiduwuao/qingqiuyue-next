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
    ];
  },
};

export default nextConfig;
