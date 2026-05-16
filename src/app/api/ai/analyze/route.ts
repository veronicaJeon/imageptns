import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AnalyzeResponse {
  caption: string;
  tags: string[];
}

interface BlipResult {
  generated_text: string;
}

interface DetrResult {
  score: number;
  label: string;
  box: { xmin: number; ymin: number; xmax: number; ymax: number };
}

interface HuggingFaceError {
  error: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HF_BASE = "https://api-inference.huggingface.co/models";
const BLIP_MODEL = "Salesforce/blip-image-captioning-base";
const DETR_MODEL = "facebook/detr-resnet-50";

/** 8 MB expressed as a base64 character count (base64 ≈ 4/3 × bytes). */
const MAX_BASE64_CHARS = Math.ceil(8 * 1024 * 1024 * (4 / 3));

const RETRY_DELAY_MS = 3000;
const DETR_SCORE_THRESHOLD = 0.5;
const MIN_TAG_LENGTH = 3;
const MAX_TAGS = 10;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip the `data:<mime>;base64,` prefix from a data URL. */
function stripDataUrlPrefix(dataUrl: string): string {
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex !== -1) {
    return dataUrl.slice(commaIndex + 1);
  }
  return dataUrl;
}

/** Call a HuggingFace Inference endpoint, retrying once on 503. */
async function callHuggingFace(
  model: string,
  base64Data: string,
  apiKey: string
): Promise<Response> {
  const url = `${HF_BASE}/${model}`;
  const options: RequestInit = {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ inputs: base64Data }),
  };

  const res = await fetch(url, options);

  if (res.status === 503) {
    // Model is loading — wait and retry once
    await new Promise<void>((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    return fetch(url, options);
  }

  return res;
}

/** Fetch a caption from BLIP. Returns null on any failure. */
async function fetchCaption(
  base64Data: string,
  apiKey: string
): Promise<string | null> {
  try {
    const res = await callHuggingFace(BLIP_MODEL, base64Data, apiKey);
    if (!res.ok) return null;

    const json: BlipResult[] | HuggingFaceError = await res.json();

    if (!Array.isArray(json)) return null;
    return json[0]?.generated_text ?? null;
  } catch {
    return null;
  }
}

/** Fetch object-detection labels from DETR. Returns empty array on any failure. */
async function fetchTags(
  base64Data: string,
  apiKey: string
): Promise<string[]> {
  try {
    const res = await callHuggingFace(DETR_MODEL, base64Data, apiKey);
    if (!res.ok) return [];

    const json: DetrResult[] | HuggingFaceError = await res.json();

    if (!Array.isArray(json)) return [];

    const seen = new Set<string>();
    const tags: string[] = [];

    for (const detection of json) {
      if (detection.score <= DETR_SCORE_THRESHOLD) continue;

      const label = detection.label.toLowerCase().trim();

      if (label.length < MIN_TAG_LENGTH) continue;
      if (seen.has(label)) continue;

      seen.add(label);
      tags.push(label);

      if (tags.length >= MAX_TAGS) break;
    }

    return tags;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Route Handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse<AnalyzeResponse | { error: string }>> {
  // ── 1. Parse body ──────────────────────────────────────────────────────────
  let imageBase64: string;
  try {
    const body = await req.json();
    imageBase64 = body?.imageBase64;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof imageBase64 !== "string" || !imageBase64) {
    return NextResponse.json(
      { error: "imageBase64 is required" },
      { status: 400 }
    );
  }

  // ── 2. Size guard ──────────────────────────────────────────────────────────
  if (imageBase64.length > MAX_BASE64_CHARS) {
    return NextResponse.json(
      { error: "Image exceeds the 8 MB size limit" },
      { status: 400 }
    );
  }

  // ── 3. Graceful degradation when API key is absent ────────────────────────
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ caption: "", tags: [] });
  }

  // ── 4. Strip data-URL prefix ───────────────────────────────────────────────
  const base64Data = stripDataUrlPrefix(imageBase64);

  // ── 5. Run both calls in parallel; tolerate individual failures ───────────
  const [captionResult, tagsResult] = await Promise.allSettled([
    fetchCaption(base64Data, apiKey),
    fetchTags(base64Data, apiKey),
  ]);

  const caption =
    captionResult.status === "fulfilled" && captionResult.value
      ? captionResult.value
      : "";

  const tags =
    tagsResult.status === "fulfilled" ? tagsResult.value : [];

  return NextResponse.json({ caption, tags });
}
