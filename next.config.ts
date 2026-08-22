import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Managed platforms use the default output. Docker opts in explicitly.
  // This avoids the Next.js 16.3 adapter + standalone trace-file conflict.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
