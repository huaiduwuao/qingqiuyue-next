import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compiler: {
    reactRemoveProperties: true,
  },
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
};

export default nextConfig;
