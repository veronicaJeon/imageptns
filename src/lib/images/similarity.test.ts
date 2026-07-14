import { describe, expect, it } from "vitest";
import { rankSimilarImages, similaritySearchTerms } from "./similarity";

const current = {
  id: "current",
  title: "안성성당 정면 전경",
  title_ko: "안성성당 정면 전경",
  title_en: "Front view of Anseong Cathedral",
  description: "경기도 안성의 성당 건축물",
  description_ko: null,
  description_en: null,
  tags: ["안성성당", "성당", "안성"],
  tags_ko: null,
  tags_en: ["cathedral", "anseong"],
  exif_location: "안성시",
  photographer_id: "photographer-1",
  categoryCodes: ["architecture"],
};

describe("similar image ranking", () => {
  it("puts another angle of the same place ahead of a generic category match", () => {
    const ranked = rankSimilarImages(current, [
      {
        ...current,
        id: "unrelated",
        title: "서울의 현대식 빌딩",
        title_ko: null,
        title_en: null,
        description: null,
        tags: ["빌딩"],
        tags_en: null,
        exif_location: "서울시",
        photographer_id: "photographer-2",
      },
      {
        ...current,
        id: "same-place",
        title: "안성성당 측면",
        title_ko: "안성성당 측면",
        title_en: "Side view of Anseong Cathedral",
        description: "안성성당의 다른 각도",
        exif_location: "안성시",
      },
    ]);

    expect(ranked.map(({ image }) => image.id)).toEqual(["same-place"]);
  });

  it("does not label category-only matches as similar", () => {
    const ranked = rankSimilarImages(current, [{
      ...current,
      id: "unrelated",
      title: "도심 고층 빌딩 야경",
      title_ko: null,
      title_en: null,
      description: null,
      tags: ["야경"],
      tags_ko: null,
      tags_en: null,
      exif_location: "부산시",
      photographer_id: "photographer-2",
    }]);

    expect(ranked).toEqual([]);
  });

  it("extracts useful, safe title terms for candidate lookup", () => {
    expect(similaritySearchTerms(current)).toEqual(expect.arrayContaining(["안성성당", "anseong", "cathedral"]));
    expect(similaritySearchTerms(current)).not.toContain("전경");
  });
});
