import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  distDir: "dist",
  images: {
    unoptimized: true,
  },
  // Client-side routing for SPA deployment on Amplify
  trailingSlash: true,
};

export default nextConfig;
