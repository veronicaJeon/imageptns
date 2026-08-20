import type { NextConfig } from "next";

const sharpRuntimeFiles = [
  "./node_modules/sharp/**/*",
  "./node_modules/@img/sharp-linux-x64/**/*",
  "./node_modules/@img/sharp-libvips-linux-x64/**/*",
];

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  outputFileTracingIncludes: {
    "/api/images/thumbnail": sharpRuntimeFiles,
    "/api/images/search-by-photo": sharpRuntimeFiles,
    "/api/uploads": sharpRuntimeFiles,
    "/api/admin/repair-preview": sharpRuntimeFiles,
    "/api/admin/about-page": sharpRuntimeFiles,
    "/api/admin/about-page/library-assets": sharpRuntimeFiles,
    "/api/admin/operations": sharpRuntimeFiles,
    "/api/cron/ai-synthetic": sharpRuntimeFiles,
    "/api/admin/images/*": sharpRuntimeFiles,
    "/api/uploads/*": sharpRuntimeFiles,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "http",  hostname: "127.0.0.1" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "picsum.photos" },
    ],
  },
};

export default nextConfig;
