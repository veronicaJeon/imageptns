import { NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/security/cron";
import { getSemanticImageSearchConfig } from "@/lib/images/semantic-embedding";
import { createSupabaseSemanticIndexingRepository } from "@/lib/images/semantic-indexing-repository";
import { runSemanticIndexingWorker } from "@/lib/images/semantic-indexing-worker";
import { VoyageMultimodalEmbeddingProvider } from "@/lib/images/voyage-multimodal";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const authorization = authorizeCronRequest(request.headers);
  if (!authorization.authorized) {
    return NextResponse.json({ error: authorization.error }, { status: authorization.status });
  }

  let config;
  try {
    config = getSemanticImageSearchConfig();
  } catch {
    return NextResponse.json({ error: "Semantic indexing configuration is invalid" }, { status: 503 });
  }
  if (!config.enabled || !config.indexingEnabled) {
    return NextResponse.json({ ok: true, skipped: "semantic_indexing_disabled" });
  }
  if (config.provider !== "voyage" || !config.model || !config.modelVersion || !config.dimensions) {
    return NextResponse.json({ error: "Voyage semantic indexing is not configured" }, { status: 503 });
  }

  const apiKey = process.env.VOYAGE_API_KEY?.trim();
  if (!apiKey) return NextResponse.json({ error: "VOYAGE_API_KEY is not configured" }, { status: 503 });

  try {
    const result = await runSemanticIndexingWorker({
      repository: createSupabaseSemanticIndexingRepository(),
      provider: new VoyageMultimodalEmbeddingProvider({
        apiKey,
        model: config.model,
        modelVersion: config.modelVersion,
        dimensions: config.dimensions,
      }),
    });
    return NextResponse.json({ ok: true, result });
  } catch {
    // Never serialize provider payloads, image paths, job IDs, or credentials.
    return NextResponse.json({ error: "Semantic indexing run failed" }, { status: 500 });
  }
}
