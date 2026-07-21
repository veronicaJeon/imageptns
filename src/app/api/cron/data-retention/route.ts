import { NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/security/cron";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const cronAuthorization = authorizeCronRequest(request.headers);
  if (!cronAuthorization.authorized) {
    return NextResponse.json(
      { error: cronAuthorization.error },
      { status: cronAuthorization.status },
    );
  }

  const dryRun = new URL(request.url).searchParams.get("dryRun") === "true";
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("run_data_retention_cleanup", {
    dry_run: dryRun,
  });

  if (error) {
    console.error("[data-retention] cleanup failed", error.message);
    return NextResponse.json({ error: "Data retention cleanup failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, result: data });
}
