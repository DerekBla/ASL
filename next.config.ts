import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Lint and type checks are separate pipeline steps (pnpm lint, pnpm typecheck).
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
