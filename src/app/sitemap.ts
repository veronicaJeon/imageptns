import type { MetadataRoute } from "next";

const PUBLIC_PATHS = [
  "",
  "/about",
  "/library",
  "/notices",
  "/contact",
  "/pricing",
  "/support",
  "/license-guide",
  "/business-info",
  "/terms",
  "/privacy",
  "/cookie",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return PUBLIC_PATHS.map((path) => ({
    url: `https://www.imagepartners.kr${path || "/"}`,
    lastModified,
    changeFrequency: path === "/library" ? "daily" : path === "" ? "weekly" : "monthly",
    priority: path === "" || path === "/library" ? 1 : 0.6,
  }));
}
