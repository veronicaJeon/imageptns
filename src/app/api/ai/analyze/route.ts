import { NextRequest, NextResponse } from "next/server";

interface AnalyzeResponse {
  caption: string;
  tags: string[];
  category: string;
}

interface BlipResult {
  generated_text: string;
}

interface DetrResult {
  score: number;
  label: string;
  box: { xmin: number; ymin: number; xmax: number; ymax: number };
}

const HF_BASE = "https://api-inference.huggingface.co/models";
const BLIP_MODEL = "Salesforce/blip-image-captioning-base";
const DETR_MODEL = "facebook/detr-resnet-50";

const RETRY_DELAY_MS = 3000;
const DETR_SCORE_THRESHOLD = 0.5;
const MIN_TAG_LENGTH = 3;
const MAX_TAGS = 10;
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

// Ordered by priority — first match wins
const CATEGORY_RULES: Array<{ keywords: string[]; category: string }> = [
  {
    keywords: ["person", "people", "man", "woman", "child", "face", "crowd", "boy", "girl", "human", "portrait"],
    category: "people",
  },
  {
    keywords: ["building", "church", "cathedral", "tower", "skyscraper", "bridge", "monument", "facade", "architecture"],
    category: "architecture",
  },
  {
    keywords: ["car", "bus", "truck", "traffic light", "road", "street", "taxi", "motorcycle", "vehicle", "urban"],
    category: "urban",
  },
  {
    keywords: ["tree", "forest", "mountain", "river", "ocean", "sea", "beach", "flower", "bird", "dog", "cat", "animal", "wildlife", "sunset", "lake", "sky", "grass", "plant", "field"],
    category: "nature",
  },
  {
    keywords: ["newspaper", "protest", "ceremony", "event", "rally", "demonstration", "speech", "conference"],
    category: "editorial",
  },
];

function inferCategory(labels: string[], caption: string): string {
  const haystack = [
    ...labels.map((l) => l.toLowerCase()),
    ...caption.toLowerCase().split(/\W+/),
  ];
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((kw) => haystack.some((t) => t.includes(kw)))) {
      return rule.category;
    }
  }
  return "";
}

// HuggingFace image models expect raw binary — NOT JSON with base64
async function callHuggingFace(
  model: string,
  imageArrayBuffer: ArrayBuffer,
  mimeType: string,
  apiKey: string
): Promise<Response> {
  const url = `${HF_BASE}/${model}`;
  const options: RequestInit = {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": mimeType,
    },
    body: imageArrayBuffer,
  };

  const res = await fetch(url, options);

  if (res.status === 503) {
    // Model is loading — retry once after delay
    await new Promise<void>((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    return fetch(url, options);
  }

  return res;
}

async function fetchCaption(
  imageArrayBuffer: ArrayBuffer,
  mimeType: string,
  apiKey: string
): Promise<string | null> {
  try {
    const res = await callHuggingFace(BLIP_MODEL, imageArrayBuffer, mimeType, apiKey);
    if (!res.ok) return null;
    const json: BlipResult[] = await res.json();
    if (!Array.isArray(json)) return null;
    return json[0]?.generated_text ?? null;
  } catch {
    return null;
  }
}

async function fetchTags(
  imageArrayBuffer: ArrayBuffer,
  mimeType: string,
  apiKey: string
): Promise<string[]> {
  try {
    const res = await callHuggingFace(DETR_MODEL, imageArrayBuffer, mimeType, apiKey);
    if (!res.ok) return [];
    const json: DetrResult[] = await res.json();
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

export async function POST(
  req: NextRequest
): Promise<NextResponse<AnalyzeResponse | { error: string }>> {
  let imageBase64: string;
  try {
    const body = await req.json();
    imageBase64 = body?.imageBase64;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof imageBase64 !== "string" || !imageBase64) {
    return NextResponse.json({ error: "imageBase64 is required" }, { status: 400 });
  }

  const apiKey = process.env.HUGGINGFACE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ caption: "", tags: [], category: "" });
  }

  // Parse data URL: "data:<mime>;base64,<data>"
  const commaIndex = imageBase64.indexOf(",");
  if (commaIndex === -1) {
    return NextResponse.json({ error: "Invalid data URL" }, { status: 400 });
  }
  const mimeType = imageBase64.slice(5, commaIndex).split(";")[0] || "image/jpeg";
  const base64Data = imageBase64.slice(commaIndex + 1);

  // Decode base64 → ArrayBuffer (ArrayBuffer is valid BodyInit, no SharedArrayBuffer issues)
  const binary = atob(base64Data);
  const imageArrayBuffer = new ArrayBuffer(binary.length);
  const view = new Uint8Array(imageArrayBuffer);
  for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i);

  if (imageArrayBuffer.byteLength > MAX_BYTES) {
    return NextResponse.json(
      { error: "Image exceeds 8 MB limit for AI analysis" },
      { status: 400 }
    );
  }

  const [captionResult, tagsResult] = await Promise.allSettled([
    fetchCaption(imageArrayBuffer, mimeType, apiKey),
    fetchTags(imageArrayBuffer, mimeType, apiKey),
  ]);

  const caption =
    captionResult.status === "fulfilled" && captionResult.value
      ? captionResult.value
      : "";

  const tags = tagsResult.status === "fulfilled" ? tagsResult.value : [];
  const category = inferCategory(tags, caption);

  return NextResponse.json({ caption, tags, category });
}
