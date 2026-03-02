import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['lh3.googleusercontent.com'],
  },
  // pdf-parse uses native Node.js fs — keep it outside the webpack bundle
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
