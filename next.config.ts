import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone is for self-hosting (`bun run start`). Vercel builds its own
  // output, and with standalone its build failed (missing next-server.js.nft.json):
  // docs/decisions/0001-online-demo.md
  output: process.env.VERCEL ? undefined : "standalone",
  // Never copy patient session videos (runtime data) into the build output
  outputFileTracingExcludes: {
    "/*": ["./storage/**/*"],
  },
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Hide the "N" dev badge (compile/runtime errors still show)
  devIndicators: false,
  allowedDevOrigins: ["shaina-harbourless-demoniacally.ngrok-free.app"],
};

export default nextConfig;