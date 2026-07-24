import { NextRequest, NextResponse } from "next/server";
import { forbidden, requireAdminUser } from "@/lib/admin/auth";
import {
  normalizeAboutPageContent,
  type AboutPageContent,
  type AboutPageLocaleContent,
} from "@/lib/about/content";

export const maxDuration = 60;

function parseProviderJson(raw: string): unknown {
  const cleaned = raw.trim().startsWith("```")
    ? raw.trim().replace(/^```[a-z]*\n?/, "").replace(/\n?```$/, "")
    : raw.trim();
  return JSON.parse(cleaned);
}

function translationPrompt(content: AboutPageContent) {
  return `Translate the Korean Image Partners about-page content into polished English for an image licensing and editorial curation website.

Keep the JSON schema exactly as provided. Translate meaning faithfully, use concise professional English, and keep proper nouns or asset IDs such as IP-EDIT-042 unchanged.

Return ONLY valid JSON with this exact shape:
{
  "hero": { "badge": "", "headline1": "", "headline2": "", "description": "" },
  "about": { "headline1": "", "headline2": "", "body": "" },
  "curation": {
    "kicker": "",
    "title": "",
    "body": "",
    "panelTitle": "",
    "panelMeta": "",
    "previewLabel": "",
    "reviewed": "",
    "noteLabel": "",
    "note": "",
    "panelFooter": "",
    "records": [
      { "label": "", "value": "", "detail": "" }
    ]
  },
  "cta": { "headline1": "", "headline2": "", "browse": "", "contact": "" }
}

Korean source:
${JSON.stringify(content.locales.ko, null, 2)}`;
}

export async function POST(req: NextRequest) {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Mistral API key is not configured" }, { status: 503 });
  }

  const payload = await req.json().catch(() => null) as { content?: unknown } | null;
  const content = normalizeAboutPageContent(payload?.content);

  try {
    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "mistral-small-latest",
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: translationPrompt(content) }],
        max_tokens: 1800,
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(45_000),
    });

    if (!response.ok) {
      return NextResponse.json({ error: `Translation failed with status ${response.status}` }, { status: 502 });
    }

    const json = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const raw = json.choices?.[0]?.message?.content ?? "";
    const translated = parseProviderJson(raw) as AboutPageLocaleContent;
    const normalized = normalizeAboutPageContent({
      ...content,
      locales: { ...content.locales, en: translated },
    });

    return NextResponse.json({ content: normalized, locale: normalized.locales.en });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Translation failed" },
      { status: 500 },
    );
  }
}
