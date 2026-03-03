import type { NextConfig } from "next";
import { join } from "path";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Include monorepo root so Vercel bundles agents/*/metadata.json for API routes
  outputFileTracingRoot: join(__dirname, '..'),
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8000',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

export default nextConfig;
