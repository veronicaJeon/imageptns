import { NextResponse } from "next/server";
import { forbidden, requireAdminUser } from "@/lib/admin/auth";
import { AiIndexingConfigurationError, runScheduledAiIndexing } from "@/lib/images/semantic-indexing-schedule";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  if (!await requireAdminUser()) return forbidden();
  const admin = createAdminClient();
  const states = ["pending", "processing", "ready", "failed", "stale"] as const;
  const results = await Promise.all(states.map(async (status) => {
    const { count, error } = await admin.from("image_semantic_embeddings")
      .select("id", { count: "exact", head: true }).eq("status", status);
    if (error) throw new Error("Semantic indexing status lookup failed");
    return [status, count ?? 0] as const;
  }));
  return NextResponse.json({ embeddings: Object.fromEntries(results) }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST() {
  if (!await requireAdminUser()) return forbidden();
  try {
    return NextResponse.json(await runScheduledAiIndexing(), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    const status = error instanceof AiIndexingConfigurationError ? 503 : 500;
    return NextResponse.json({ error: "AI indexing run failed" }, { status });
  }
}
