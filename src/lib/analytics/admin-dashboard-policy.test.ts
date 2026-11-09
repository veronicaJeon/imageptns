import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dashboardPage = readFileSync("src/app/(admin)/admin/page.tsx", "utf8");
const reviewPage = readFileSync("src/app/(admin)/admin/image-review/page.tsx", "utf8");
const route = readFileSync("src/app/api/admin/analytics/route.ts", "utf8");
const migration = readFileSync("supabase/migrations/083_admin_analytics_dashboard.sql", "utf8");

describe("administrator analytics policy", () => {
  it("uses analytics as the administrator landing page without removing image review", () => {
    expect(dashboardPage).toContain("AdminAnalyticsDashboard");
    expect(reviewPage).toContain("AdminImageReview");
  });

  it("keeps the aggregation behind administrator authorization", () => {
    expect(route).toContain("requireAdminUser");
    expect(route).toContain('"Cache-Control": "private, no-store"');
    expect(migration).toContain("grant execute on function public.admin_analytics_dashboard(integer) to service_role");
    expect(migration).toContain("revoke all on function public.admin_analytics_dashboard(integer) from public, anon, authenticated");
  });

  it("excludes operational noise before reporting first-party activity", () => {
    expect(migration).toContain("/admin(?:/|$)");
    expect(migration).toContain("bot|crawler|spider");
    expect(migration).toContain("[.]vercel[.]app");
    expect(migration).toContain("[.]pages[.]dev");
  });
});
