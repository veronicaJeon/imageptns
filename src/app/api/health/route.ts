import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordOperationalEvent } from "@/lib/monitoring/events";

export const dynamic = "force-dynamic";

type CheckResult = { status: "ok" | "error"; latencyMs: number };

async function timedCheck(check: () => Promise<{ error: { message: string } | null }>): Promise<CheckResult> {
  const startedAt = Date.now();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      check(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("Health check timed out")), 5_000);
      }),
    ]);
    if (result.error) throw result.error;
    return { status: "ok", latencyMs: Date.now() - startedAt };
  } catch {
    return { status: "error", latencyMs: Date.now() - startedAt };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function GET() {
  const startedAt = Date.now();
  const admin = createAdminClient();
  const [database, storage, latestAiResult] = await Promise.all([
    timedCheck(async () => {
      const result = await admin.from("platform_commerce_settings").select("id").eq("id", true).maybeSingle();
      return { error: result.error };
    }),
    timedCheck(async () => {
      const result = await admin.storage.from("images-preview").list("", { limit: 1 });
      return { error: result.error };
    }),
    admin
      .from("operational_events")
      .select("status, created_at, duration_ms")
      .eq("event_type", "ai_synthetic_check")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const latestAi = latestAiResult.data;
  const aiAgeMs = latestAi ? Date.now() - new Date(latestAi.created_at).getTime() : null;
  const ai = !latestAi
    ? { status: "unknown" as const, checkedAt: null, latencyMs: null }
    : aiAgeMs != null && aiAgeMs > 36 * 60 * 60 * 1000
      ? { status: "stale" as const, checkedAt: latestAi.created_at, latencyMs: latestAi.duration_ms }
      : { status: latestAi.status === "ok" ? "ok" as const : "error" as const, checkedAt: latestAi.created_at, latencyMs: latestAi.duration_ms };

  const coreHealthy = database.status === "ok" && storage.status === "ok";
  const degraded = !coreHealthy || ai.status === "error" || ai.status === "stale";
  const durationMs = Date.now() - startedAt;

  await recordOperationalEvent({
    eventType: "synthetic_health_check",
    component: "availability",
    status: coreHealthy ? (degraded ? "warning" : "ok") : "error",
    route: "/api/health",
    statusCode: coreHealthy ? 200 : 503,
    durationMs,
    metadata: {
      database: database.status,
      storage: storage.status,
      ai: ai.status,
    },
  });

  return NextResponse.json(
    {
      status: degraded ? "degraded" : "ok",
      checks: { database, storage, ai },
      durationMs,
      timestamp: new Date().toISOString(),
    },
    {
      status: coreHealthy ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
        "Server-Timing": `total;dur=${durationMs}, db;dur=${database.latencyMs}, storage;dur=${storage.latencyMs}`,
      },
    },
  );
}
