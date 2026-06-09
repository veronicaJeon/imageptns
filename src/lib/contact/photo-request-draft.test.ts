import { describe, expect, it } from "vitest";
import {
  buildPhotoRequestHref,
  draftPhotoRequestFromSearchParams,
} from "./photo-request-draft";

describe("photo request draft helpers", () => {
  it("builds a contact URL from library search state", () => {
    expect(buildPhotoRequestHref({
      query: "지리산 천왕봉 겨울 설경",
      category: "nature",
      freeOnly: true,
      educationFreeOnly: false,
      commercialOnly: true,
      derivativesOnly: true,
    })).toBe(
      "/contact?mode=photo&query=%EC%A7%80%EB%A6%AC%EC%82%B0+%EC%B2%9C%EC%99%95%EB%B4%89+%EA%B2%A8%EC%9A%B8+%EC%84%A4%EA%B2%BD&category=nature&free=true&commercial=true&derivatives=true",
    );
  });

  it("creates buyer-friendly photo request defaults from search params", () => {
    const draft = draftPhotoRequestFromSearchParams(new URLSearchParams({
      mode: "photo",
      query: "전북 익산 석탑 낮 사진",
      category: "architecture",
      educationFree: "true",
      commercial: "true",
      derivatives: "true",
    }));

    expect(draft.mode).toBe("photo");
    expect(draft.title).toBe("전북 익산 석탑 낮 사진 사진 의뢰");
    expect(draft.brief).toContain("전북 익산 석탑 낮 사진");
    expect(draft.brief).toContain("교육용 무료 사용 가능");
    expect(draft.brief).toContain("상업 사용 가능");
    expect(draft.brief).toContain("원 저작물 변경 가능");
    expect(draft.location_guidance).toContain("촬영 위치");
    expect(draft.location_guidance).toContain("대상 지역");
    expect(draft.category).toBe("architecture");
    expect(draft.tags).toBe("전북, 익산, 석탑, 낮, 사진");
    expect(draft.usage_intent).toBe("검색 조건과 동일한 사용 목적 검토");
  });

  it("does not force photo mode when no photo request context is present", () => {
    const draft = draftPhotoRequestFromSearchParams(new URLSearchParams({ query: "산" }));

    expect(draft.mode).toBeNull();
    expect(draft.title).toBe("");
    expect(draft.brief).toBe("");
  });
});
