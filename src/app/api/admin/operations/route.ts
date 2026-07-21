import { NextResponse } from "next/server";
import { forbidden, requireAdminUser } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { runAiSyntheticCheck } from "@/lib/monitoring/ai-synthetic";

interface OperationalEventRow {
  id: string;
  event_type: string;
  component: string;
  status: "ok" | "warning" | "error";
  route: string | null;
  provider: string | null;
  status_code: number | null;
  duration_ms: number | null;
  error_code: string | null;
  message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export async function GET() {
  if (!await requireAdminUser()) return forbidden();
  const admin = createAdminClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [{ data, error }, retentionResult] = await Promise.all([
    admin
      .from("operational_events")
      .select("id, event_type, component, status, route, provider, status_code, duration_ms, error_code, message, metadata, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1000),
    admin
      .from("data_retention_runs")
      .select("status, started_at, completed_at")
      .eq("dry_run", false)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const events = (data ?? []) as OperationalEventRow[];
  const availability = events.filter((event) => event.event_type === "synthetic_health_check");
  const ai = events.filter((event) => event.component === "ai");
  const requestErrors = events.filter((event) => event.event_type === "request_error");
  const successfulAvailability = availability.filter((event) => event.status === "ok").length;
  const averageLatencyMs = availability.length
    ? Math.round(availability.reduce((sum, event) => sum + (event.duration_ms ?? 0), 0) / availability.length)
    : null;

  return NextResponse.json({
    windowHours: 24,
    summary: {
      availabilityChecks: availability.length,
      availabilityPercent: availability.length ? Number(((successfulAvailability / availability.length) * 100).toFixed(2)) : null,
      averageLatencyMs,
      requestErrors: requestErrors.length,
      aiChecks: ai.length,
      aiFailures: ai.filter((event) => event.status === "error").length,
      latestRetentionRun: retentionResult.data ?? null,
    },
    events: events.slice(0, 100),
  });
}

export async function POST() {
  if (!await requireAdminUser()) return forbidden();
  const result = await runAiSyntheticCheck("admin");
  return NextResponse.json(result, { status: result.ok ? 200 : 503 });
}
