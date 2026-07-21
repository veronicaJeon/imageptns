import { imageCategoryPromptList, isImageCategoryCode } from "../images/categories";

export interface AnalyzeResponse {
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
    ? value.filter((tag): tag is string => typeof tag === "string").map((tag) => tag.toLowerCase().trim()).filter(Boolean).slice(0, 10)
    : [];
}

export function parseMistralAnalyzeResponse(raw: string): AnalyzeResponse | null {
  try {
    const cleaned = raw.trim().startsWith("```")
      ? raw.trim().replace(/^```[a-z]*\n?/, "").replace(/\n?```$/, "")
      : raw.trim();
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    const title = typeof parsed.title === "string" ? parsed.title.trim() : "";
    const caption = typeof parsed.caption === "string" ? parsed.caption.trim() : "";
    const tags = normalizeTags(parsed.tags);
    const titleKo = typeof parsed.title_ko === "string" ? parsed.title_ko.trim() : "";
    const titleEn = typeof parsed.title_en === "string" ? parsed.title_en.trim() : "";
    const captionKo = typeof parsed.caption_ko === "string" ? parsed.caption_ko.trim() : "";
    const captionEn = typeof parsed.caption_en === "string" ? parsed.caption_en.trim() : "";
    const tagsKo = normalizeTags(parsed.tags_ko);
    const tagsEn = normalizeTags(parsed.tags_en);
    const category = typeof parsed.category === "string" && isImageCategoryCode(parsed.category) ? parsed.category : "";
    return {
      title: title || titleKo || titleEn,
      caption: caption || captionKo || captionEn,
      tags: tags.length > 0 ? tags : tagsKo.length > 0 ? tagsKo : tagsEn,
      title_ko: titleKo || title,
      title_en: titleEn || title,
      caption_ko: captionKo || caption,
      caption_en: captionEn || caption,
      tags_ko: tagsKo.length > 0 ? tagsKo : tags,
      tags_en: tagsEn.length > 0 ? tagsEn : tags,
      category,
    };
  } catch {
    return null;
  }
}

export async function analyzeWithMistral(dataUrl: string, primaryLanguage: "ko" | "en"): Promise<AnalyzeResponse> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) throw new Error("Mistral API key is not configured");

  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "mistral-small-latest",
      messages: [{
        role: "user",
        content: [
          { type: "image_url", image_url: { url: dataUrl } },
          { type: "text", text: visionPrompt(primaryLanguage) },
        ],
      }],
      max_tokens: 256,
      temperature: 0.1,
    }),
    signal: AbortSignal.timeout(45_000),
  });

  if (!response.ok) throw new Error(`Mistral request failed with status ${response.status}`);

  const json = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const raw = json.choices?.[0]?.message?.content ?? "";
  const parsed = parseMistralAnalyzeResponse(raw);
  if (!parsed || (!parsed.caption && parsed.tags.length === 0)) {
    throw new Error("Mistral returned an unusable result");
  }
  return parsed;
}
