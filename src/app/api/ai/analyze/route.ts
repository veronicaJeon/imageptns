import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

interface AnalyzeResponse {
  caption: string;
  tags: string[];
  category: string;
}

const VALID_CATEGORIES = ["nature", "people", "editorial", "urban", "abstract", "architecture"] as const;

const VISION_PROMPT = `Analyze this stock photo. Respond with ONLY valid JSON — no markdown fences, no explanation.

{
  "caption": "<one factual English sentence describing the photo, max 20 words>",
  "tags": ["<up to 10 lowercase English keywords that describe the image content>"],
  "category": "<exactly one of: nature | people | editorial | urban | abstract | architecture>"
}`;

function parseJsonResponse(raw: string): { caption: string; tags: string[]; category: string } | null {
  try {
    const cleaned = raw.trim().startsWith("```")
      ? raw.trim().replace(/^```[a-z]*\n?/, "").replace(/\n?```$/, "")
      : raw.trim();
    const parsed = JSON.parse(cleaned);
    const caption: string = typeof parsed.caption === "string" ? parsed.caption.trim() : "";
    const tags: string[] = Array.isArray(parsed.tags)
      ? parsed.tags.filter((t: unknown) => typeof t === "string").map((t: string) => t.toLowerCase().trim()).slice(0, 10)
      : [];
    const category: string = VALID_CATEGORIES.includes(parsed.category) ? parsed.category : "";
    return { caption, tags, category };
  } catch {
    return null;
  }
}

// ── Vision: Mistral pixtral-12b ────────────────────────────────────────────
async function analyzeWithMistral(dataUrl: string): Promise<AnalyzeResponse> {
  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "pixtral-12b-2409",
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: dataUrl } },
            { type: "text", text: VISION_PROMPT },
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

// ── Vision: Google Gemini flash-lite ──────────────────────────────────────
async function analyzeWithGemini(base64Data: string, mimeType: string): Promise<AnalyzeResponse> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { inline_data: { mime_type: mimeType, data: base64Data } },
              { text: VISION_PROMPT },
            ],
          },
        ],
        generationConfig: { maxOutputTokens: 256, temperature: 0.1 },
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gemini ${res.status}: ${text.slice(0, 200)}`);
  }

  const json = await res.json();
  const raw: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const parsed = parseJsonResponse(raw);
  if (!parsed || (!parsed.caption && parsed.tags.length === 0)) {
    throw new Error(`Gemini returned unusable result: ${raw.slice(0, 100)}`);
  }
  return parsed;
}

// ── Vision: Groq llama-3.2-11b-vision ────────────────────────────────────────
async function analyzeWithGroqVision(dataUrl: string): Promise<AnalyzeResponse> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama-3.2-11b-vision-preview",
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: dataUrl } },
            { type: "text", text: VISION_PROMPT },
          ],
        },
      ],
      max_tokens: 256,
      temperature: 0.1,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Groq vision ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = await res.json();
  const raw: string = json?.choices?.[0]?.message?.content ?? "";
  const parsed = parseJsonResponse(raw);
  if (!parsed || (!parsed.caption && parsed.tags.length === 0)) {
    throw new Error(`Groq vision returned unusable result: ${raw.slice(0, 100)}`);
  }
  return parsed;
}

// ── Last resort: Groq text model with filename + EXIF ────────────────────────
async function analyzeWithGroqText(body: {
  filename?: string;
  exifData?: { locationLabel?: string; camera?: string; takenAt?: string };
}): Promise<AnalyzeResponse> {
  const fileBase = (body.filename ?? "")
    .replace(/\.[^/.]+$/, "")
    .replace(/[-_.]/g, " ")
    .replace(/\d{4,}/g, "")
    .trim();

  const parts: string[] = [];
  if (fileBase) parts.push(`Filename keywords: ${fileBase}`);
  if (body.exifData?.locationLabel) parts.push(`Location: ${body.exifData.locationLabel}`);
  if (body.exifData?.camera) parts.push(`Camera: ${body.exifData.camera}`);
  if (body.exifData?.takenAt) {
    const d = new Date(body.exifData.takenAt);
    if (!isNaN(d.getTime())) parts.push(`Taken: ${d.toLocaleDateString("en-US", { month: "long", year: "numeric" })}`);
  }

  if (parts.length === 0) throw new Error("No metadata to analyze");

  const prompt = `You are a stock photo metadata specialist.

Photo metadata:
${parts.join("\n")}

Respond with ONLY valid JSON:
{
  "caption": "<one factual English sentence, max 20 words>",
  "tags": ["<up to 10 lowercase English keywords>"],
  "category": "<one of: nature | people | editorial | urban | abstract | architecture>"
}`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 256,
      temperature: 0.2,
    }),
  });

  if (!res.ok) throw new Error(`Groq text ${res.status}`);
  const json = await res.json();
  const raw: string = json?.choices?.[0]?.message?.content ?? "";
  const parsed = parseJsonResponse(raw);
  if (!parsed || (!parsed.caption && parsed.tags.length === 0)) throw new Error("Groq text returned unusable result");
  return parsed;
}

// ── Handler ────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest): Promise<NextResponse<AnalyzeResponse | { error: string }>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    imageBase64?: string;
    filename?: string;
    exifData?: { locationLabel?: string; camera?: string; takenAt?: string; lat?: number; lng?: number };
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { imageBase64, filename, exifData } = body;

  // Parse data URL once (shared by vision providers)
  let dataUrl = "";
  let base64Data = "";
  let mimeType = "image/jpeg";

  if (imageBase64) {
    const comma = imageBase64.indexOf(",");
    if (comma !== -1) {
      mimeType = imageBase64.slice(5, comma).split(";")[0] || "image/jpeg";
      base64Data = imageBase64.slice(comma + 1);
      dataUrl = `data:${mimeType};base64,${base64Data}`;
    }
  }

  const errors: string[] = [];

  // 1. Try Mistral vision (pixtral-12b)
  if (process.env.MISTRAL_API_KEY && dataUrl) {
    try {
      const result = await analyzeWithMistral(dataUrl);
      return NextResponse.json(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[ai/analyze] Mistral failed:", msg);
      errors.push(`Mistral: ${msg}`);
    }
  }

  // 2. Try Groq vision (llama-3.2-11b-vision-preview) — free tier
  if (process.env.GROQ_API_KEY && dataUrl) {
    try {
      const result = await analyzeWithGroqVision(dataUrl);
      return NextResponse.json(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[ai/analyze] Groq vision failed:", msg);
      errors.push(`Groq vision: ${msg}`);
    }
  }

  // 3. Try Gemini vision (gemini-2.0-flash-lite)
  if (process.env.GEMINI_API_KEY && base64Data) {
    try {
      const result = await analyzeWithGemini(base64Data, mimeType);
      return NextResponse.json(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[ai/analyze] Gemini failed:", msg);
      errors.push(`Gemini: ${msg}`);
    }
  }

  // 4. Last resort: Groq text + filename/EXIF (no vision)
  if (process.env.GROQ_API_KEY && (filename || exifData)) {
    try {
      const result = await analyzeWithGroqText({ filename, exifData });
      return NextResponse.json(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[ai/analyze] Groq text fallback failed:", msg);
      errors.push(`Groq text: ${msg}`);
    }
  }

  console.error("[ai/analyze] All providers failed:", errors);
  return NextResponse.json({ error: "AI analysis failed" }, { status: 500 });
}
