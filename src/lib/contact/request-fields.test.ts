import { describe, expect, it } from "vitest";
import {
  PHOTO_REQUEST_MATCH_STATUSES,
  PHOTO_REQUEST_STATUSES,
  normalizeContactSubmissionInput,
  normalizeInquiryType,
  normalizePhotoRequestStatus,
  normalizeSourcingPurposes,
  validatePhotoRequestBuyerFields,
  normalizeReferenceUrl,
  normalizeTargetRegions,
} from "./request-fields";

const NOW = new Date("2026-05-20T00:00:00.000Z");

describe("normalizeInquiryType", () => {
  it("defaults missing values to general", () => {
    expect(normalizeInquiryType(undefined)).toBe("general");
    expect(normalizeInquiryType(null)).toBe("general");
    expect(normalizeInquiryType("")).toBe("general");
  });

  it("accepts only supported inquiry types", () => {
    expect(normalizeInquiryType(" photo_request ")).toBe("photo_request");
    expect(() => normalizeInquiryType("sales")).toThrow("inquiry_type");
  });
});

describe("normalizeTargetRegions", () => {
  it("normalizes arrays and delimited strings into unique labels", () => {
    expect(normalizeTargetRegions([" Seoul ", "Busan", "seoul", "Jeju Island"])).toEqual([
      "Seoul",
      "Busan",
      "Jeju Island",
    ]);
    expect(normalizeTargetRegions("Seoul, Busan\nJeju Island")).toEqual([
      "Seoul",
      "Busan",
      "Jeju Island",
    ]);
  });

  it("requires at least one target region and caps region labels", () => {
    expect(() => normalizeTargetRegions([])).toThrow("target_regions");
    expect(() => normalizeTargetRegions(["Seoul", 123])).toThrow("target_regions");
    expect(() => normalizeTargetRegions(["S".repeat(81)])).toThrow("target_regions");
    expect(() => normalizeTargetRegions(Array.from({ length: 13 }, (_, index) => `Region ${index}`))).toThrow("target_regions");
  });
});

describe("normalizeSourcingPurposes", () => {
  it("normalizes unique supported sourcing purposes", () => {
    expect(normalizeSourcingPurposes(["rights_check", "similar_search", "context_reference", "shooting_request", "rights_check"])).toEqual([
      "rights_check",
      "similar_search",
      "context_reference",
      "shooting_request",
    ]);
  });

  it("defaults empty purpose input to similar search", () => {
    expect(normalizeSourcingPurposes(undefined)).toEqual(["similar_search"]);
  });

  it("rejects unsupported purpose values", () => {
    expect(() => normalizeSourcingPurposes(["photographer_matching"])).toThrow("sourcing_purposes");
  });
});

describe("normalizeReferenceUrl", () => {
  it("normalizes blank or https reference URLs", () => {
    expect(normalizeReferenceUrl("")).toBeNull();
    expect(normalizeReferenceUrl(" https://example.com/mood.jpg ")).toBe("https://example.com/mood.jpg");
  });

  it("rejects non-http URLs and oversized values", () => {
    expect(() => normalizeReferenceUrl("ftp://example.com/mood.jpg")).toThrow("reference_url");
    expect(() => normalizeReferenceUrl(`https://example.com/${"a".repeat(2049)}`)).toThrow("reference_url");
  });
});

describe("status values", () => {
  it("exports request and match workflow statuses", () => {
    expect(PHOTO_REQUEST_STATUSES).toContain("submitted");
    expect(PHOTO_REQUEST_MATCH_STATUSES).toContain("interested");
    expect(normalizePhotoRequestStatus(" submitted ")).toBe("submitted");
    expect(() => normalizePhotoRequestStatus("draft")).toThrow("request_status");
  });
});

describe("normalizeContactSubmissionInput", () => {
  it("keeps existing general contact payloads compatible", () => {
    expect(normalizeContactSubmissionInput({
      name: " 홍길동 ",
      email: " buyer@example.com ",
      subject: " 라이선스 문의 ",
      message: "이미지 사용 범위를 알고 싶습니다.",
    }, NOW)).toEqual({
      name: "홍길동",
      email: "buyer@example.com",
      subject: "라이선스 문의",
      message: "이미지 사용 범위를 알고 싶습니다.",
      inquiry_type: "general",
      location_label: null,
      target_regions: [],
      category: null,
      tags: [],
      usage_intent: null,
      license_intent: null,
      budget_min_krw: null,
      budget_max_krw: null,
      deadline_at: null,
      reference_url: null,
      reference_note: null,
      non_copying_attested: false,
      requester_organization: null,
      requester_phone: null,
      usage_project: null,
      usage_context: null,
      buyer_id: null,
      sourcing_purposes: [],
      internal_sourcing_status: "submitted",
      buyer_sourcing_status: "received",
      request_status: "submitted",
    });
  });

  it("normalizes a contact-backed photo request payload", () => {
    expect(normalizeContactSubmissionInput({
      inquiry_type: "photo_request",
      name: "Buyer",
      email: "buyer@example.com",
      subject: "Rooftop campaign",
      message: "Need bright Seoul rooftop lifestyle images with morning light.",
      requester_organization: " Image Partners Books ",
      requester_phone: "010-1234-5678",
      usage_project: " Middle school history workbook ",
      usage_context: " Opening spread about modern Seoul lifestyles ",
      deadline_at: "2026-06-10T09:00:00.000Z",
      reference_url: "https://example.com/reference.png",
      reference_note: "Use the composition only.",
      sourcing_purposes: ["rights_check", "similar_search", "context_reference", "shooting_request"],
    }, NOW)).toEqual({
      name: "Buyer",
      email: "buyer@example.com",
      subject: "Rooftop campaign",
      message: "Need bright Seoul rooftop lifestyle images with morning light.",
      inquiry_type: "photo_request",
      location_label: null,
      target_regions: [],
      category: null,
      tags: [],
      usage_intent: null,
      license_intent: null,
      budget_min_krw: null,
      budget_max_krw: null,
      deadline_at: "2026-06-10T09:00:00.000Z",
      reference_url: "https://example.com/reference.png",
      reference_note: "Use the composition only.",
      non_copying_attested: false,
      requester_organization: "Image Partners Books",
      requester_phone: "010-1234-5678",
      usage_project: "Middle school history workbook",
      usage_context: "Opening spread about modern Seoul lifestyles",
      buyer_id: null,
      sourcing_purposes: ["rights_check", "similar_search", "context_reference", "shooting_request"],
      internal_sourcing_status: "submitted",
      buyer_sourcing_status: "received",
      request_status: "submitted",
    });
  });

  it("allows an empty organization while requiring project and usage context", () => {
    const normalized = normalizeContactSubmissionInput({
      inquiry_type: "photo_request",
      name: "Buyer",
      email: "buyer@example.com",
      subject: "Rooftop campaign",
      message: "Need bright Seoul rooftop lifestyle images with morning light.",
      requester_organization: "",
      requester_phone: "010-1234-5678",
      usage_project: "Middle school history workbook",
      usage_context: "Chapter opener",
      deadline_at: "2026-06-10T09:00:00.000Z",
    }, NOW);
    expect(normalized.requester_organization).toBeNull();
    expect(() => normalizeContactSubmissionInput({
      inquiry_type: "photo_request",
      name: "Buyer",
      email: "buyer@example.com",
      subject: "Rooftop campaign",
      message: "Need bright Seoul rooftop lifestyle images with morning light.",
      requester_organization: "",
      requester_phone: "010-1234-5678",
      usage_project: "",
      usage_context: "Chapter opener",
      deadline_at: "2026-06-10T09:00:00.000Z",
    }, NOW)).toThrow("usage_project");
  });

  it("rejects invalid deadlines while allowing omitted budget and region fields", () => {
    const base = {
      inquiry_type: "photo_request",
      name: "Buyer",
      email: "buyer@example.com",
      subject: "Rooftop campaign",
      message: "Need bright Seoul rooftop lifestyle images with morning light.",
      requester_organization: "Image Partners Books",
      requester_phone: "010-1234-5678",
      usage_project: "Middle school history workbook",
      usage_context: "Chapter opener",
      deadline_at: "2026-06-10T09:00:00.000Z",
    };

    expect(normalizeContactSubmissionInput(base, NOW).budget_min_krw).toBeNull();
    expect(() => normalizeContactSubmissionInput({
      ...base,
      deadline_at: "2026-05-19T23:59:59.000Z",
    }, NOW)).toThrow("deadline_at");
  });
});

describe("validatePhotoRequestBuyerFields", () => {
  const base = {
    requester_organization: "Image Partners Books",
    requester_phone: "010-1234-5678",
    usage_project: "중학교 한국사 보조교재",
    usage_context: "백제 문화 설명 본문 옆 삽입 이미지",
    deadline_at: "2026-06-10T23:59:59.000Z",
    reference_url: "https://example.com/reference",
  };

  it("accepts a complete buyer-facing photo request validation set", () => {
    expect(validatePhotoRequestBuyerFields(base, NOW)).toBeNull();
  });

  it("allows a blank organization and explains required source context fields in Korean", () => {
    expect(validatePhotoRequestBuyerFields({
      ...base,
      requester_organization: "",
    }, NOW)).toBeNull();

    expect(validatePhotoRequestBuyerFields({
      ...base,
      usage_project: "",
    }, NOW)).toBe("사용 프로젝트를 입력해주세요. 예: 중학교 한국사 보조교재, 전시 리플렛, 단행본 개정판");
  });

  it("requires and validates a requester phone number", () => {
    expect(validatePhotoRequestBuyerFields({ ...base, requester_phone: "010-1234-5678" }, NOW)).toBeNull();
    expect(validatePhotoRequestBuyerFields({ ...base, requester_phone: "" }, NOW)).toBe("휴대전화번호를 입력해주세요. 숫자 7~15자리의 전화번호 형식이어야 합니다.");
    expect(validatePhotoRequestBuyerFields({ ...base, requester_phone: "123" }, NOW)).toBe("휴대전화번호를 입력해주세요. 숫자 7~15자리의 전화번호 형식이어야 합니다.");
  });

  it("explains deadline and usage context validation in Korean", () => {
    expect(validatePhotoRequestBuyerFields({
      ...base,
      usage_context: "",
    }, NOW)).toBe("사용 맥락을 입력해주세요. 이미지가 어떤 내용 옆에서 어떤 역할로 쓰이는지 적어주세요.");

    expect(validatePhotoRequestBuyerFields({
      ...base,
      usage_context: "웹".repeat(1001),
    }, NOW)).toBe("사용 맥락은 1000자 이내로 입력해주세요.");

    expect(validatePhotoRequestBuyerFields({
      ...base,
      deadline_at: "2026-05-19T23:59:59.000Z",
    }, NOW)).toBe("희망 마감일은 오늘 이후 날짜로 선택해주세요.");
  });

  it("explains reference URL validation in Korean", () => {
    expect(validatePhotoRequestBuyerFields({
      ...base,
      reference_url: "ftp://example.com/reference",
    }, NOW)).toBe("참고 URL은 http:// 또는 https://로 시작하는 웹 주소만 입력할 수 있습니다.");
  });

  it("explains buyer-facing validation in English", () => {
    expect(validatePhotoRequestBuyerFields({
      ...base,
      usage_context: "",
    }, NOW, "en")).toBe("Enter the usage context. Explain what content the image will appear next to and what role it should play.");

    expect(validatePhotoRequestBuyerFields({
      ...base,
      reference_url: "ftp://example.com/reference",
    }, NOW, "en")).toBe("Reference URL must be a web address starting with http:// or https://.");
  });
});
