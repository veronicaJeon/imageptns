import { NextRequest, NextResponse } from "next/server";
import { forbidden, requireAdminUser } from "@/lib/admin/auth";
import { ADMIN_ANALYTICS_RANGES, isAdminAnalyticsRange } from "@/lib/analytics/admin-dashboard";
import { aggregateAdminAnalyticsFallback } from "@/lib/analytics/admin-dashboard-server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

  const requestedDays = Number(request.nextUrl.searchParams.get("days") ?? 7);
  const days = isAdminAnalyticsRange(requestedDays) ? requestedDays : ADMIN_ANALYTICS_RANGES[0];
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("admin_analytics_dashboard", { p_days: days });

  const functionMissing = error && (
    error.code === "PGRST202"
    || error.code === "42883"
    || /admin_analytics_dashboard/i.test(error.message) && /not find|does not exist/i.test(error.message)
  );
  if (functionMissing) {
    try {
      const analytics = await aggregateAdminAnalyticsFallback(admin, days);
      return NextResponse.json(
        { analytics },
        { headers: { "Cache-Control": "private, no-store", "X-Analytics-Source": "compatibility" } },
      );
    } catch (fallbackError) {
      console.error("[admin analytics] compatibility aggregation failed", fallbackError);
      return NextResponse.json({ error: "분석 데이터를 집계하지 못했습니다." }, { status: 500 });
    }
  }

  if (error) {
    console.error("[admin analytics] aggregation failed", { code: error.code, message: error.message });
    return NextResponse.json({ error: "분석 데이터를 집계하지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json(
    { analytics: data },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
