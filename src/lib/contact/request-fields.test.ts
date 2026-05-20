import { describe, expect, it } from "vitest";
import {
  PHOTO_REQUEST_MATCH_STATUSES,
  PHOTO_REQUEST_STATUSES,
  normalizeContactSubmissionInput,
  normalizeInquiryType,
  normalizePhotoRequestStatus,
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
      location_label: " Seoul, South Korea ",
      target_regions: ["Seoul", "Jongno-gu", "seoul"],
      category: " Editorial ",
      tags: [" rooftop ", "campaign", "Rooftop"],
      usage_intent: "Brand social and newsletter use",
      license_intent: "Commercial digital campaign",
      budget_min_krw: 150000,
      budget_max_krw: 300000,
      deadline_at: "2026-06-10T09:00:00.000Z",
      reference_url: "https://example.com/reference.png",
      reference_note: "Use as mood only; do not copy composition.",
      non_copying_attested: true,
    }, NOW)).toEqual({
      name: "Buyer",
      email: "buyer@example.com",
      subject: "Rooftop campaign",
      message: "Need bright Seoul rooftop lifestyle images with morning light.",
      inquiry_type: "photo_request",
      location_label: "Seoul, South Korea",
      target_regions: ["Seoul", "Jongno-gu"],
      category: "Editorial",
      tags: ["rooftop", "campaign"],
      usage_intent: "Brand social and newsletter use",
      license_intent: "Commercial digital campaign",
      budget_min_krw: 150000,
      budget_max_krw: 300000,
      deadline_at: "2026-06-10T09:00:00.000Z",
      reference_url: "https://example.com/reference.png",
      reference_note: "Use as mood only; do not copy composition.",
      non_copying_attested: true,
      request_status: "submitted",
    });
  });

  it("requires request-specific fields for photo requests", () => {
    expect(() => normalizeContactSubmissionInput({
      inquiry_type: "photo_request",
      name: "Buyer",
      email: "buyer@example.com",
      subject: "Rooftop campaign",
      message: "Need bright Seoul rooftop lifestyle images with morning light.",
      location_label: "Seoul, South Korea",
      target_regions: ["Seoul"],
      usage_intent: "Brand social and newsletter use",
      license_intent: "Commercial digital campaign",
      budget_min_krw: 150000,
      budget_max_krw: 300000,
      deadline_at: "2026-06-10T09:00:00.000Z",
      non_copying_attested: false,
    }, NOW)).toThrow("non_copying_attested");
  });

  it("rejects invalid budget ranges and deadlines", () => {
    const base = {
      inquiry_type: "photo_request",
      name: "Buyer",
      email: "buyer@example.com",
      subject: "Rooftop campaign",
      message: "Need bright Seoul rooftop lifestyle images with morning light.",
      location_label: "Seoul, South Korea",
      target_regions: ["Seoul"],
      usage_intent: "Brand social and newsletter use",
      license_intent: "Commercial digital campaign",
      budget_min_krw: 300000,
      budget_max_krw: 150000,
      deadline_at: "2026-06-10T09:00:00.000Z",
      non_copying_attested: true,
    };

    expect(() => normalizeContactSubmissionInput(base, NOW)).toThrow("budget");
    expect(() => normalizeContactSubmissionInput({
      ...base,
      budget_min_krw: 150000,
      deadline_at: "2026-05-19T23:59:59.000Z",
    }, NOW)).toThrow("deadline_at");
  });
});
