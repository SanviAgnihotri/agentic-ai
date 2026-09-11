import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@electric-sql/pglite",
    "@composio/core",
    "@browserbasehq/sdk",
    "inngest",
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
