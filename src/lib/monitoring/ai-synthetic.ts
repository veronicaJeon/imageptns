import sharp from "sharp";
import { analyzeWithMistral } from "../ai/mistral";
import { recordOperationalEvent, sanitizeOperationalMessage } from "./events";

async function syntheticImageDataUrl() {
  const bytes = await sharp({
    create: {
      width: 160,
      height: 120,
      channels: 3,
      background: { r: 42, g: 111, b: 151 },
    },
  }).jpeg({ quality: 70 }).toBuffer();
  return `data:image/jpeg;base64,${bytes.toString("base64")}`;
}

type AiSyntheticSource = "admin" | "ai-cron" | "operations-cron";

function sourceRoute(source: AiSyntheticSource) {
  if (source === "admin") return "/api/admin/operations";
  if (source === "operations-cron") return "/api/cron/operations-review";
  return "/api/cron/ai-synthetic";
}

export async function runAiSyntheticCheck(source: AiSyntheticSource) {
  const startedAt = Date.now();
  try {
    const result = await analyzeWithMistral(await syntheticImageDataUrl(), "ko");
    const valid = Boolean(result.title && result.caption && result.tags.length > 0);
    if (!valid) throw new Error("Synthetic analysis returned incomplete metadata");

    await recordOperationalEvent({
      eventType: "ai_synthetic_check",
      component: "ai",
      provider: "mistral",
      status: "ok",
      route: sourceRoute(source),
      statusCode: 200,
      durationMs: Date.now() - startedAt,
      metadata: { source, tagCount: result.tags.length },
    });
    return { ok: true as const, durationMs: Date.now() - startedAt };
  } catch (error) {
    const message = sanitizeOperationalMessage(error) ?? "AI synthetic check failed";
    await recordOperationalEvent({
      eventType: "ai_synthetic_check",
      component: "ai",
      provider: "mistral",
      status: "error",
      route: sourceRoute(source),
      statusCode: 503,
      durationMs: Date.now() - startedAt,
      errorCode: "synthetic_check_failed",
      message,
      metadata: { source },
    });
    return { ok: false as const, durationMs: Date.now() - startedAt, error: message };
  }
}
