import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApprovedPhotographer } from "@/lib/photographers/approval";
import { checkRateLimit, requestIp } from "@/lib/security/rate-limit";
import { normalizeLocationQuery, type AdministrativeAreaRow } from "@/lib/locations/administrative-areas";

export const revalidate = 0;

export async function GET(req: NextRequest) {
  const query = normalizeLocationQuery(new URL(req.url).searchParams.get("q"));
  if (query.length < 2) return NextResponse.json({ suggestions: [] });

  const rate = checkRateLimit({
    key: `location-suggest:${requestIp(req.headers)}`,
    limit: 120,
    windowMs: 60 * 1000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { suggestions: [] },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const authorization = await requireApprovedPhotographer(admin, user.id);
  if (!authorization.ok) return authorization.response;

  const { data, error } = await admin.rpc("search_administrative_areas", {
    search_query: query,
    result_limit: 8,
  });

  if (error) {
    console.error("[locations/suggest] query failed", error.message);
    return NextResponse.json({ suggestions: [] }, { status: 503 });
  }

  const rows = (data ?? []) as AdministrativeAreaRow[];

  return NextResponse.json({
    suggestions: rows.slice(0, 8).map((row) => ({
      code: row.code,
      name: row.full_name,
      level: row.level,
    })),
  });
}
