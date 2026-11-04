import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
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