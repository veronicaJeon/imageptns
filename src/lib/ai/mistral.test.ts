import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeWithMistral, parseMistralAnalyzeResponse } from "./mistral";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("parseMistralAnalyzeResponse", () => {
  it("normalizes a bilingual metadata response", () => {
    const result = parseMistralAnalyzeResponse(JSON.stringify({
      title: "서울 야경",
      caption: "한강 너머로 서울의 불빛이 보인다.",
      tags: ["서울", "야경"],
      title_ko: "서울 야경",
      title_en: "Seoul Night View",
      caption_ko: "한강 너머로 서울의 불빛이 보인다.",
      caption_en: "Seoul lights appear beyond the Han River.",
      tags_ko: ["서울", "야경"],
      tags_en: ["Seoul", "Night"],
      category: "travel",
    }));

    expect(result?.title_en).toBe("Seoul Night View");
    expect(result?.tags_en).toEqual(["seoul", "night"]);
  });

  it("rejects non-JSON provider output", () => {
    expect(parseMistralAnalyzeResponse("not json")).toBeNull();
  });

  it("requests JSON mode with enough room for bilingual metadata", async () => {
    vi.stubEnv("MISTRAL_API_KEY", "test-key");
    const providerResult = {
      title: "푸른 하늘",
      caption: "푸른 하늘에 구름이 떠 있다.",
      tags: ["하늘", "구름"],
      title_ko: "푸른 하늘",
      title_en: "Blue Sky",
      caption_ko: "푸른 하늘에 구름이 떠 있다.",
      caption_en: "Clouds float in a blue sky.",
      tags_ko: ["하늘", "구름"],
      tags_en: ["sky", "clouds"],
      category: "nature",
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ finish_reason: "stop", message: { content: JSON.stringify(providerResult) } }],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(analyzeWithMistral("data:image/jpeg;base64,AA==", "ko"))
      .resolves.toMatchObject({ title_en: "Blue Sky", category: "nature" });

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(request.body)) as {
      max_tokens: number;
      response_format: { type: string };
    };
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.max_tokens).toBeGreaterThanOrEqual(512);
  });

  it("reports token truncation distinctly", async () => {
    vi.stubEnv("MISTRAL_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ finish_reason: "length", message: { content: '{"title":"잘린 결과"' } }],
    }), { status: 200 })));

    await expect(analyzeWithMistral("data:image/jpeg;base64,AA==", "ko"))
      .rejects.toThrow("Mistral output exceeded 768 tokens");
  });
});
