import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Lint and type checks are separate pipeline steps (pnpm lint, pnpm typecheck).
  eslint: { ignoreDuringBuilds: true },
  // Load the WebSocket stack from node_modules instead of bundling it. Bundled, `ws` picks up a
  // broken stand-in for its optional `bufferutil` add-on and every ledger write crashes with
  // "b.mask is not a function" (seen on Vercel, 2026-10-07).
  serverExternalPackages: ["ws", "@neondatabase/serverless"],
  // Replays are binary game files: have browsers save them instead of guessing a type.
  headers: async () => [
    {
      source: "/replays/:path*",
      headers: [
        { key: "Content-Type", value: "application/octet-stream" },
        { key: "Content-Disposition", value: "attachment" },
      ],
    },
  ],
};

export default nextConfig;
