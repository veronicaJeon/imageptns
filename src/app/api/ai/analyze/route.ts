import { NextRequest, NextResponse } from "next/server";
import {
  MAX_AI_ANALYZE_REQUEST_BYTES,
  normalizePositiveLimit,
  parseAiImageInput,
  requestBodyTooLarge,
  type AiImageInput,
  type AiAnalyzeBody,
} from "@/lib/ai/analyze-security";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApprovedPhotographer } from "@/lib/photographers/approval";
import { analyzeWithMistral, type AnalyzeResponse } from "@/lib/ai/mistral";
import { recordOperationalEvent } from "@/lib/monitoring/events";

export const maxDuration = 60;

// ── Handler ────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest): Promise<NextResponse<AnalyzeResponse | { error: string }>> {
  const startedAt = Date.now();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const authorization = await requireApprovedPhotographer(admin, user.id);
  if (!authorization.ok) {
    return authorization.response as NextResponse<AnalyzeResponse | { error: string }>;
  }

  if (requestBodyTooLarge(req.headers.get("content-length"))) {
    return NextResponse.json({ error: "AI analysis request is too large" }, { status: 413 });
  }

  let body: AiAnalyzeBody;

  try {
    const rawBody = await req.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_AI_ANALYZE_REQUEST_BYTES) {
      return NextResponse.json({ error: "AI analysis request is too large" }, { status: 413 });
    }
    const parsedBody: unknown = JSON.parse(rawBody);
    if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
      throw new Error("Invalid JSON body");
    }
    body = parsedBody as AiAnalyzeBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const primaryLanguage = body.language === "en" ? "en" : "ko";

  let imageInput: AiImageInput;
  try {
    imageInput = parseAiImageInput(body.imageBase64);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid AI image input";
    return NextResponse.json(
      { error: message },
      { status: message.includes("too large") ? 413 : 400 },
    );
  }
  const { dataUrl } = imageInput;

  if (!dataUrl) {
    return NextResponse.json({ error: "Image is required" }, { status: 400 });
  }

  const hourlyLimit = normalizePositiveLimit(process.env.AI_ANALYSIS_HOURLY_LIMIT, 60);
  const dailyLimit = normalizePositiveLimit(process.env.AI_ANALYSIS_DAILY_LIMIT, 300);
  const { data: quotaAllowed, error: quotaError } = await admin.rpc("consume_ai_analysis_quota", {
    target_user_id: user.id,
    hourly_limit: hourlyLimit,
    daily_limit: dailyLimit,
  });
  if (quotaError) {
    console.error("[ai/analyze] quota check failed", quotaError.message);
    return NextResponse.json({ error: "AI analysis quota is unavailable" }, { status: 503 });
  }
  if (quotaAllowed !== true) {
    return NextResponse.json(
      { error: "AI analysis usage limit exceeded" },
      { status: 429, headers: { "Retry-After": "3600" } },
    );
  }

  const errors: string[] = [];

  // Analyze the image only with the currently declared production processor.
  if (process.env.MISTRAL_API_KEY && dataUrl) {
    try {
      const result = await analyzeWithMistral(dataUrl, primaryLanguage);
      await recordOperationalEvent({
        eventType: "ai_analysis",
        component: "ai",
        provider: "mistral",
        status: "ok",
        route: "/api/ai/analyze",
        statusCode: 200,
        durationMs: Date.now() - startedAt,
      });
      return NextResponse.json(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[ai/analyze] Mistral failed:", msg);
      await recordOperationalEvent({
        eventType: "ai_analysis",
        component: "ai",
        provider: "mistral",
        status: "error",
        route: "/api/ai/analyze",
        statusCode: 500,
        durationMs: Date.now() - startedAt,
        errorCode: "provider_failure",
        message: msg,
      });
      errors.push(`Mistral: ${msg}`);
    }
  }

  console.error("[ai/analyze] All providers failed:", errors);
  return NextResponse.json({ error: "AI analysis failed" }, { status: 500 });
}
