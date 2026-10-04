import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, requestIp } from "@/lib/security/rate-limit";

export const revalidate = 0;

const SUGGESTION_LIMIT = 8;

export async function GET(req: NextRequest) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 80);

  const rate = checkRateLimit({
    key: `suggest:${requestIp(req.headers)}`,
    limit: 120,
    windowMs: 60 * 1000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { suggestions: [] },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  if (q.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  // Titles and tags of every public image, matched literally in the database;
  // terms starting with the query come first, then the most used terms.
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("suggest_search_terms", {
    p_query: q,
    p_limit: SUGGESTION_LIMIT,
  });
  if (error) {
    console.error("[search-suggest] suggestion lookup failed", error.message);
    return NextResponse.json({ suggestions: [] });
  }

  const suggestions = ((data ?? []) as { term: string }[])
    .map((row) => row.term)
    .filter((term): term is string => typeof term === "string" && term.length > 0);
  return NextResponse.json({ suggestions });
}
