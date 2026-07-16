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
      "/contact?mode=photo&query=%EC%A7%80%EB%A6%AC%EC%82%B0+%EC%B2%9C%EC%99%95%EB%B4%89+%EA%B2%A8%EC%9A%B8+%EC%84%A4%EA%B2%BD&category=nature&free=true&commercial=true&derivatives=true&similarSearch=true",
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
    expect(draft.title).toBe("전북 익산 석탑 낮 사진 이미지(사진)요청");
    expect(draft.brief).toBe("전북 익산 석탑 낮 사진");
    expect(draft.brief).not.toContain("마감일, 예산");
    expect(draft.usage_context).toBe("검색 조건과 동일한 사용 조건 검토: 교육용 무료 사용 가능, 상업 사용 가능, 원 저작물 변경 가능");
    expect(draft.sourcing_purposes).toEqual(["similar_search"]);
  });

  it("creates English photo request defaults when requested", () => {
    const draft = draftPhotoRequestFromSearchParams(new URLSearchParams({
      mode: "photo",
      query: "winter landscape of Jirisan Cheonwangbong",
      educationFree: "true",
      commercial: "true",
    }), "en");

    expect(draft.mode).toBe("photo");
    expect(draft.title).toBe("winter landscape of Jirisan Cheonwangbong image request");
    expect(draft.brief).toBe("winter landscape of Jirisan Cheonwangbong");
    expect(draft.brief).not.toContain("이미지 소싱 요청");
    expect(draft.usage_context).toBe("Review the same usage terms as the search filters: Free for education, Commercial use");
  });

  it("keeps multiple sourcing purpose hints from search params", () => {
    const draft = draftPhotoRequestFromSearchParams(new URLSearchParams({
      mode: "photo",
      query: "지리산 천왕봉 사진",
      rightsCheck: "true",
      similarSearch: "true",
      supplyCheck: "true",
    }));

    expect(draft.sourcing_purposes).toEqual(["rights_check", "similar_search", "supply_check"]);
  });

  it("does not force photo mode when no photo request context is present", () => {
    const draft = draftPhotoRequestFromSearchParams(new URLSearchParams({ query: "산" }));

    expect(draft.mode).toBeNull();
    expect(draft.title).toBe("");
    expect(draft.brief).toBe("");
    expect(draft.sourcing_purposes).toEqual([]);
  });
});
