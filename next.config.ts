import type { NextConfig } from "next";

const isCloudflareBuild = process.env.CLOUDFLARE_BUILD === "1";

const sharpRuntimeFiles = [
  "./node_modules/sharp/**/*",
  "./node_modules/@img/sharp-linux-x64/**/*",
  "./node_modules/@img/sharp-libvips-linux-x64/**/*",
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=31536000" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=()" },
          { key: "Content-Security-Policy", value: "base-uri 'self'; frame-ancestors 'none'; object-src 'none'" },
        ],
      },
    ];
  },
  turbopack: {
    root: __dirname,
    resolveAlias: isCloudflareBuild ? {
      sharp: "./src/lib/cloudflare/sharp-stub.ts",
    } : undefined,
  },
  outputFileTracingIncludes: {
    "/api/images/search-by-photo": sharpRuntimeFiles,
    "/api/uploads": sharpRuntimeFiles,
    "/api/admin/repair-preview": sharpRuntimeFiles,
    "/api/admin/operations": sharpRuntimeFiles,
    "/api/admin/semantic-indexing": sharpRuntimeFiles,
    "/api/cron/ai-synthetic": sharpRuntimeFiles,
    "/api/cron/operations-review": sharpRuntimeFiles,
    "/api/cron/semantic-indexing": sharpRuntimeFiles,
    "/api/admin/images/*": sharpRuntimeFiles,
    "/api/uploads/*": sharpRuntimeFiles,
  },
  webpack(config) {
    if (isCloudflareBuild) {
      config.resolve.alias.sharp = require.resolve("./src/lib/cloudflare/sharp-stub.ts");
    }
    return config;
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
