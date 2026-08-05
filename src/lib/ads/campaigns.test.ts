import { describe, expect, it } from "vitest";
import {
  isSafeCampaignUrl,
  localizeLibraryAdCampaign,
  parseLibraryAdCampaignInput,
  type LibraryAdCampaignRow,
} from "./campaigns";

const validInput = {
  name: "이미지 요청 안내",
  campaign_type: "house",
  placement: "right_rail",
  title_ko: "원하는 이미지가 없나요?",
  title_en: "Need another image?",
  body_ko: "필요한 장면을 알려주세요.",
  body_en: "",
  cta_ko: "이미지 요청하기",
  cta_en: "Request a photo",
  image_url: "",
  image_alt_ko: "",
  image_alt_en: "",
  destination_url: "/contact?mode=photo",
  sponsor_name: "",
  is_active: true,
  starts_at: "2026-07-28T00:00:00.000Z",
  ends_at: "",
  priority: 10,
};

describe("library ad campaign validation", () => {
  it("normalizes a valid house campaign", () => {
    expect(parseLibraryAdCampaignInput(validInput)).toMatchObject({
      campaign_type: "house",
      destination_url: "/contact?mode=photo",
      image_url: null,
      is_active: true,
      priority: 10,
    });
  });

  it("blocks executable, protocol-relative, credentialed, and original-image URLs", () => {
    expect(isSafeCampaignUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeCampaignUrl("//tracker.example/ad")).toBe(false);
    expect(isSafeCampaignUrl("https://user:pass@example.com/ad")).toBe(false);
    expect(isSafeCampaignUrl("https://example.supabase.co/storage/v1/object/sign/images-original/a.jpg")).toBe(false);
    expect(isSafeCampaignUrl("https://example.supabase.co/storage/v1/object/sign/images-full/a.jpg")).toBe(false);
  });

  it("requires the campaign window to be ordered", () => {
    expect(() => parseLibraryAdCampaignInput({
      ...validInput,
      ends_at: "2026-07-27T00:00:00.000Z",
    })).toThrow("노출 종료일");
  });
});

describe("library ad campaign localization", () => {
  const row = {
    ...parseLibraryAdCampaignInput(validInput),
    id: "campaign-1",
    created_at: "2026-07-28T00:00:00.000Z",
    updated_at: null,
  } as LibraryAdCampaignRow;

  it("uses Korean copy for Korean visitors", () => {
    expect(localizeLibraryAdCampaign(row, "ko")).toMatchObject({
      label: "이미지파트너스 안내",
      title: "원하는 이미지가 없나요?",
      cta: "이미지 요청하기",
    });
  });

  it("falls back to Korean when optional English copy is absent", () => {
    const localized = localizeLibraryAdCampaign({
      ...row,
      title_en: null,
      body_en: null,
      cta_en: null,
    }, "en");
    expect(localized.title).toBe(row.title_ko);
    expect(localized.body).toBe(row.body_ko);
    expect(localized.cta).toBe(row.cta_ko);
  });
});
