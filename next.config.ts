import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel supplies its own build adapter and does not use standalone output.
  // Keep standalone enabled everywhere else so the same app remains Docker-ready.
  output: process.env.VERCEL ? undefined : "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
