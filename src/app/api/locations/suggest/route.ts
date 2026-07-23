import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, requestIp } from "@/lib/security/rate-limit";
import { normalizeLocationQuery, type AdministrativeAreaRow } from "@/lib/locations/administrative-areas";

const SUCCESS_CACHE_HEADERS = {
  "Cache-Control": "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800",
};

export async function GET(req: NextRequest) {
  const query = normalizeLocationQuery(new URL(req.url).searchParams.get("q"));
  if (query.length < 2) {
    return NextResponse.json({ suggestions: [] }, { headers: SUCCESS_CACHE_HEADERS });
  }

  const rate = checkRateLimit({
    key: `location-suggest:${requestIp(req.headers)}`,
    limit: 120,
    windowMs: 60 * 1000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { suggestions: [] },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(rate.retryAfterSeconds),
        },
      },
    );
  }

  const startedAt = performance.now();
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("search_administrative_areas", {
    search_query: query,
    result_limit: 8,
  });

  if (error) {
    console.error("[locations/suggest] query failed", error.message);
    return NextResponse.json(
      { suggestions: [] },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const rows = (data ?? []) as AdministrativeAreaRow[];

  return NextResponse.json(
    {
      suggestions: rows.slice(0, 8).map((row) => ({
        code: row.code,
        name: row.full_name,
        level: row.level,
      })),
    },
    {
      headers: {
        ...SUCCESS_CACHE_HEADERS,
        "Server-Timing": `location-rpc;dur=${(performance.now() - startedAt).toFixed(1)}`,
      },
    },
  );
}
