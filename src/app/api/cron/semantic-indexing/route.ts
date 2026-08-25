import { NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/security/cron";
import { AiIndexingConfigurationError, runScheduledAiIndexing } from "@/lib/images/semantic-indexing-schedule";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const authorization = authorizeCronRequest(request.headers);
  if (!authorization.authorized) {
    return NextResponse.json({ error: authorization.error }, { status: authorization.status });
  }

  try {
    return NextResponse.json(await runScheduledAiIndexing());
  } catch (error) {
    if (error instanceof AiIndexingConfigurationError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    // Never serialize provider payloads, image paths, job IDs, or credentials.
    return NextResponse.json({ error: "Semantic indexing run failed" }, { status: 500 });
  }
}
