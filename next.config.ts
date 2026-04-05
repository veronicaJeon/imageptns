import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // Docker 프로덕션 빌드용
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
};

export default nextConfig;
