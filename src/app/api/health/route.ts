import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordOperationalEvent } from "@/lib/monitoring/events";
import { previewUrl } from "@/lib/supabase/storage";
import { hasJpegSignature } from "@/lib/supabase/storage-body";

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
  const reversePreviewSample = Math.floor(Date.now() / (15 * 60 * 1000)) % 2 === 1;
  const [database, storage, analysisStorage, previewIntegrity, latestAiResult, latestOperationsResult] = await Promise.all([
    timedCheck(async () => {
      const result = await admin.from("platform_commerce_settings").select("id").eq("id", true).maybeSingle();
      return { error: result.error };
    }),
    timedCheck(async () => {
      const result = await admin.storage.from("images-preview").list("", { limit: 1 });
      return { error: result.error };
    }),
    timedCheck(async () => {
      const result = await admin.storage.from("images-analysis").list("", { limit: 1 });
      return { error: result.error };
    }),
    timedCheck(async () => {
      const { data, error } = await admin
        .from("images")
        .select("storage_path_preview")
        .eq("status", "approved")
        .eq("lifecycle_status", "active")
        .eq("is_published", true)
        .not("storage_path_preview", "is", null)
        .order("created_at", { ascending: reversePreviewSample })
        .limit(12);
      if (error) return { error };

      for (const image of data ?? []) {
        const path = image.storage_path_preview;
        if (!path) continue;
        const response = await fetch(previewUrl(`thumbs/${path}`), {
          cache: "no-store",
          headers: { Range: "bytes=0-15" },
        });
        if (!response.ok) return { error: new Error(`Preview returned ${response.status}`) };
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (!hasJpegSignature(bytes)) {
          return { error: new Error("Preview JPEG signature is invalid") };
        }
      }
      return { error: null };
    }),
    admin
      .from("operational_events")
      .select("status, created_at, duration_ms")
      .eq("event_type", "ai_synthetic_check")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("operational_events")
      .select("status, created_at, duration_ms, error_code, metadata")
      .eq("event_type", "operations_daily_review")
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

  const latestOperations = latestOperationsResult.data;
  const operationsAgeMs = latestOperations ? Date.now() - new Date(latestOperations.created_at).getTime() : null;
  const operations = !latestOperations
    ? { status: "unknown" as const, checkedAt: null, latencyMs: null, findingCount: null }
    : operationsAgeMs != null && operationsAgeMs > 36 * 60 * 60 * 1000
      ? { status: "stale" as const, checkedAt: latestOperations.created_at, latencyMs: latestOperations.duration_ms, findingCount: null }
      : {
          status: latestOperations.status as "ok" | "warning" | "error",
          checkedAt: latestOperations.created_at,
          latencyMs: latestOperations.duration_ms,
          findingCount: typeof latestOperations.metadata?.findingCount === "number" ? latestOperations.metadata.findingCount : null,
        };

  const coreHealthy = database.status === "ok"
    && storage.status === "ok"
    && analysisStorage.status === "ok"
    && previewIntegrity.status === "ok";
  const degraded = !coreHealthy
    || ai.status === "error"
    || ai.status === "stale"
    || operations.status === "error"
    || operations.status === "stale";
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
      analysisStorage: analysisStorage.status,
      previewIntegrity: previewIntegrity.status,
      ai: ai.status,
      operations: operations.status,
    },
  });

  return NextResponse.json(
    {
      status: degraded ? "degraded" : "ok",
      checks: { database, storage, analysisStorage, previewIntegrity, ai, operations },
      release: {
        commitSha: process.env.VERCEL_GIT_COMMIT_SHA?.trim() || null,
        commitRef: process.env.VERCEL_GIT_COMMIT_REF?.trim() || null,
      },
      durationMs,
      timestamp: new Date().toISOString(),
    },
    {
      status: coreHealthy ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
        "Server-Timing": `total;dur=${durationMs}, db;dur=${database.latencyMs}, storage;dur=${storage.latencyMs}, analysis;dur=${analysisStorage.latencyMs}, preview;dur=${previewIntegrity.latencyMs}`,
      },
    },
  );
}
