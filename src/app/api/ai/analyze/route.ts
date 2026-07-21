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
import { imageCategoryPromptList, isImageCategoryCode } from "@/lib/images/categories";
import { requireApprovedPhotographer } from "@/lib/photographers/approval";

export const maxDuration = 60;

interface AnalyzeResponse {
  title: string;
  caption: string;
  tags: string[];
  title_ko?: string;
  title_en?: string;
  caption_ko?: string;
  caption_en?: string;
  tags_ko?: string[];
  tags_en?: string[];
  category: string;
}

function visionPrompt(primaryLanguage: "ko" | "en") {
  const primary = primaryLanguage === "ko" ? "Korean" : "English";
  const secondary = primaryLanguage === "ko" ? "English" : "Korean";
  return `Analyze this stock photo. Generate ${primary} first, then a faithful ${secondary} translation. Respond with ONLY valid JSON — no markdown fences, no explanation.

{
  "title": "<primary-language title, short and factual>",
  "caption": "<primary-language factual sentence describing the photo, max 25 words>",
  "tags": ["<up to 10 primary-language keywords>"],
  "title_ko": "<Korean title>",
  "title_en": "<English title, max 6 words, title case>",
  "caption_ko": "<one factual Korean sentence, max 25 words>",
  "caption_en": "<one factual English sentence, max 20 words>",
  "tags_ko": ["<up to 10 Korean keywords>"],
  "tags_en": ["<up to 10 lowercase English keywords>"],
  "category": "<exactly one of: ${imageCategoryPromptList()}>"
}`;
}

function normalizeTags(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((t: unknown) => typeof t === "string").map((t: string) => t.toLowerCase().trim()).filter(Boolean).slice(0, 10)
    : [];
}

function parseJsonResponse(raw: string): AnalyzeResponse | null {
  try {
    const cleaned = raw.trim().startsWith("```")
      ? raw.trim().replace(/^```[a-z]*\n?/, "").replace(/\n?```$/, "")
      : raw.trim();
    const parsed = JSON.parse(cleaned);
    const title: string = typeof parsed.title === "string" ? parsed.title.trim() : "";
    const caption: string = typeof parsed.caption === "string" ? parsed.caption.trim() : "";
    const tags = normalizeTags(parsed.tags);
    const title_ko = typeof parsed.title_ko === "string" ? parsed.title_ko.trim() : "";
    const title_en = typeof parsed.title_en === "string" ? parsed.title_en.trim() : "";
    const caption_ko = typeof parsed.caption_ko === "string" ? parsed.caption_ko.trim() : "";
    const caption_en = typeof parsed.caption_en === "string" ? parsed.caption_en.trim() : "";
    const tags_ko = normalizeTags(parsed.tags_ko);
    const tags_en = normalizeTags(parsed.tags_en);
    const category: string = typeof parsed.category === "string" && isImageCategoryCode(parsed.category) ? parsed.category : "";
    return {
      title: title || title_ko || title_en,
      caption: caption || caption_ko || caption_en,
      tags: tags.length > 0 ? tags : tags_ko.length > 0 ? tags_ko : tags_en,
      title_ko: title_ko || title,
      title_en: title_en || title,
      caption_ko: caption_ko || caption,
      caption_en: caption_en || caption,
      tags_ko: tags_ko.length > 0 ? tags_ko : tags,
      tags_en: tags_en.length > 0 ? tags_en : tags,
      category,
    };
  } catch {
    return null;
  }
}

// ── Vision: Mistral ────────────────────────────────────────────────────────
async function analyzeWithMistral(dataUrl: string, primaryLanguage: "ko" | "en"): Promise<AnalyzeResponse> {
  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "mistral-small-latest",
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: dataUrl } },
            { type: "text", text: visionPrompt(primaryLanguage) },
          ],
        },
      ],
      max_tokens: 256,
      temperature: 0.1,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Mistral ${res.status}: ${text.slice(0, 200)}`);
  }

  const json = await res.json();
  const raw: string = json?.choices?.[0]?.message?.content ?? "";
  const parsed = parseJsonResponse(raw);
  if (!parsed || (!parsed.caption && parsed.tags.length === 0)) {
    throw new Error(`Mistral returned unusable result: ${raw.slice(0, 100)}`);
  }
  return parsed;
}

// ── Handler ────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest): Promise<NextResponse<AnalyzeResponse | { error: string }>> {
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
      return NextResponse.json(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[ai/analyze] Mistral failed:", msg);
      errors.push(`Mistral: ${msg}`);
    }
  }

  console.error("[ai/analyze] All providers failed:", errors);
  return NextResponse.json({ error: "AI analysis failed" }, { status: 500 });
}
