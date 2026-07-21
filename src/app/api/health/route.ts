import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  const admin = createAdminClient();
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    const result = await Promise.race([
      admin.from("platform_commerce_settings").select("id").eq("id", true).maybeSingle(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("Database health check timed out")), 5_000);
      }),
    ]);

    if (result.error) throw result.error;

    const databaseLatencyMs = Date.now() - startedAt;
    return NextResponse.json(
      {
        status: "ok",
        checks: { database: "ok" },
        databaseLatencyMs,
        timestamp: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store",
          "Server-Timing": `db;dur=${databaseLatencyMs}`,
        },
      },
    );
  } catch {
    return NextResponse.json(
      {
        status: "degraded",
        checks: { database: "error" },
        timestamp: new Date().toISOString(),
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
