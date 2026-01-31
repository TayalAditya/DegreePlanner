import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['lh3.googleusercontent.com'],
  },
  experimental: {
    allowedDevOrigins: ['10.151.79.104:3000'],
  },
};

export default nextConfig;
