import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/api/image-assets/"],
        disallow: [
          "/admin/",
          "/dashboard/",
          "/api/admin/",
          "/api/cron/",
          "/api/uploads/",
          "/checkout/",
        ],
      },
    ],
    sitemap: "https://www.imagepartners.kr/sitemap.xml",
    host: "https://www.imagepartners.kr",
  };
}
