import { describe, expect, it } from "vitest";
import { parseMistralAnalyzeResponse } from "./mistral";

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
});
