import { NextResponse } from "next/server";
import { runAiSyntheticCheck } from "@/lib/monitoring/ai-synthetic";
import { authorizeCronRequest } from "@/lib/security/cron";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const authorization = authorizeCronRequest(request.headers);
  if (!authorization.authorized) {
    return NextResponse.json({ error: authorization.error }, { status: authorization.status });
  }

  const result = await runAiSyntheticCheck("cron");
  return NextResponse.json(result, { status: result.ok ? 200 : 503 });
}
