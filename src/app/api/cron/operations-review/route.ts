import { NextResponse } from "next/server";
import { runScheduledAiIndexing } from "@/lib/images/semantic-indexing-schedule";
import { runAiSyntheticCheck } from "@/lib/monitoring/ai-synthetic";
import { runOperationsReview } from "@/lib/monitoring/operations-review-server";
import { authorizeCronRequest } from "@/lib/security/cron";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const authorization = authorizeCronRequest(request.headers);
  if (!authorization.authorized) {
    return NextResponse.json({ error: authorization.error }, { status: authorization.status });
  }

  const mistral = await runAiSyntheticCheck("operations-cron");
  let indexing;
  try {
    indexing = await runScheduledAiIndexing();
  } catch {
    indexing = { ok: false as const, error: "AI indexing run failed" };
  }
  let operations;
  try {
    operations = await runOperationsReview();
  } catch {
    operations = { status: "error" as const, error: "Operations review failed" };
  }
  const ok = mistral.ok && indexing.ok && operations.status !== "error";
  return NextResponse.json({ mistral, indexing, operations }, { status: ok ? 200 : 503 });
}
