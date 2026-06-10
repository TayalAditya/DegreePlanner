import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  compress: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
    minimumCacheTTL: 31536000,
    formats: ["image/avif", "image/webp"],
  },
  // pdf-parse uses native Node.js fs — keep it outside the webpack bundle
  serverExternalPackages: ["pdf-parse"],
  // Ensure runtime-loaded PDFs are bundled for Vercel/serverless functions.
  outputFileTracingIncludes: {
    "/api/auth/[...nextauth]": ["./docs/*.pdf"],
  },
};

export default nextConfig;
