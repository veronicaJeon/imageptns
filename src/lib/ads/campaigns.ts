import { isOriginalStorageUrl } from "../about/content";

export const LIBRARY_AD_PLACEMENTS = ["right_rail"] as const;
export const LIBRARY_AD_CAMPAIGN_TYPES = ["house", "partner"] as const;

export type LibraryAdPlacement = typeof LIBRARY_AD_PLACEMENTS[number];
export type LibraryAdCampaignType = typeof LIBRARY_AD_CAMPAIGN_TYPES[number];

export interface LibraryAdCampaignRow {
  id: string;
  name: string;
  campaign_type: LibraryAdCampaignType;
  placement: LibraryAdPlacement;
  title_ko: string;
  title_en: string | null;
  body_ko: string | null;
  body_en: string | null;
  cta_ko: string;
  cta_en: string | null;
  image_url: string | null;
  image_alt_ko: string | null;
  image_alt_en: string | null;
  destination_url: string;
  sponsor_name: string | null;
  is_active: boolean;
  starts_at: string;
  ends_at: string | null;
  priority: number;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface LibraryAdCampaignInput {
  name: string;
  campaign_type: LibraryAdCampaignType;
  placement: LibraryAdPlacement;
  title_ko: string;
  title_en: string | null;
  body_ko: string | null;
  body_en: string | null;
  cta_ko: string;
  cta_en: string | null;
  image_url: string | null;
  image_alt_ko: string | null;
  image_alt_en: string | null;
  destination_url: string;
  sponsor_name: string | null;
  is_active: boolean;
  starts_at: string;
  ends_at: string | null;
  priority: number;
}

export interface PublicLibraryAd {
  id: string;
  campaignType: LibraryAdCampaignType;
  placement: LibraryAdPlacement;
  label: string;
  title: string;
  body: string | null;
  cta: string;
  imageUrl: string | null;
  imageAlt: string;
  destinationUrl: string;
  sponsorName: string | null;
}

function requiredText(value: unknown, label: string, maxLength: number) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized || normalized.length > maxLength) {
    throw new Error(`${label}은(는) 1~${maxLength}자로 입력해주세요.`);
  }
  return normalized;
}

function optionalText(value: unknown, label: string, maxLength: number) {
  if (value === null || value === undefined || value === "") return null;
  const normalized = typeof value === "string" ? value.trim() : "";
  if (normalized.length > maxLength) {
    throw new Error(`${label}은(는) ${maxLength}자 이내로 입력해주세요.`);
  }
  return normalized || null;
}

export function isSafeCampaignUrl(value: string) {
  if (value.startsWith("/") && !value.startsWith("//")) {
    return !isOriginalStorageUrl(value);
  }

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") return false;
    if (parsed.username || parsed.password) return false;
    return !isOriginalStorageUrl(parsed.toString());
  } catch {
    return false;
  }
}

function campaignUrl(value: unknown, label: string, required: boolean) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized && !required) return null;
  if (!normalized || normalized.length > 2048 || !isSafeCampaignUrl(normalized)) {
    throw new Error(`${label}은(는) 내부 경로(/...) 또는 안전한 HTTPS URL이어야 합니다.`);
  }
  return normalized;
}

function campaignDate(value: unknown, label: string, required: boolean) {
  if ((value === null || value === undefined || value === "") && !required) return null;
  const date = new Date(typeof value === "string" ? value : "");
  if (Number.isNaN(date.getTime())) throw new Error(`${label} 형식이 올바르지 않습니다.`);
  return date.toISOString();
}

export function parseLibraryAdCampaignInput(value: unknown): LibraryAdCampaignInput {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const campaignType = LIBRARY_AD_CAMPAIGN_TYPES.includes(source.campaign_type as LibraryAdCampaignType)
    ? source.campaign_type as LibraryAdCampaignType
    : "house";
  const placement = LIBRARY_AD_PLACEMENTS.includes(source.placement as LibraryAdPlacement)
    ? source.placement as LibraryAdPlacement
    : "right_rail";
  const startsAt = campaignDate(source.starts_at, "노출 시작일", true) as string;
  const endsAt = campaignDate(source.ends_at, "노출 종료일", false);
  if (endsAt && new Date(endsAt) <= new Date(startsAt)) {
    throw new Error("노출 종료일은 시작일보다 늦어야 합니다.");
  }
  const priorityNumber = Number(source.priority ?? 0);
  if (!Number.isInteger(priorityNumber) || priorityNumber < 0 || priorityNumber > 1000) {
    throw new Error("우선순위는 0~1000 사이의 정수여야 합니다.");
  }

  return {
    name: requiredText(source.name, "관리용 캠페인명", 100),
    campaign_type: campaignType,
    placement,
    title_ko: requiredText(source.title_ko, "한국어 제목", 100),
    title_en: optionalText(source.title_en, "영문 제목", 100),
    body_ko: optionalText(source.body_ko, "한국어 설명", 240),
    body_en: optionalText(source.body_en, "영문 설명", 240),
    cta_ko: requiredText(source.cta_ko, "한국어 버튼 문구", 40),
    cta_en: optionalText(source.cta_en, "영문 버튼 문구", 40),
    image_url: campaignUrl(source.image_url, "광고 이미지 URL", false),
    image_alt_ko: optionalText(source.image_alt_ko, "한국어 이미지 설명", 160),
    image_alt_en: optionalText(source.image_alt_en, "영문 이미지 설명", 160),
    destination_url: campaignUrl(source.destination_url, "이동 URL", true) as string,
    sponsor_name: optionalText(source.sponsor_name, "광고주·제휴사명", 100),
    is_active: source.is_active === true,
    starts_at: startsAt,
    ends_at: endsAt,
    priority: priorityNumber,
  };
}

export function localizeLibraryAdCampaign(
  campaign: LibraryAdCampaignRow,
  lang: "ko" | "en",
): PublicLibraryAd {
  const english = lang === "en";
  return {
    id: campaign.id,
    campaignType: campaign.campaign_type,
    placement: campaign.placement,
    label: campaign.campaign_type === "partner"
      ? (english ? "Advertising · Partnership" : "광고·제휴")
      : (english ? "Image Partners" : "이미지파트너스 안내"),
    title: english ? campaign.title_en || campaign.title_ko : campaign.title_ko,
    body: english ? campaign.body_en || campaign.body_ko : campaign.body_ko,
    cta: english ? campaign.cta_en || campaign.cta_ko : campaign.cta_ko,
    imageUrl: campaign.image_url,
    imageAlt: english
      ? campaign.image_alt_en || campaign.image_alt_ko || campaign.title_en || campaign.title_ko
      : campaign.image_alt_ko || campaign.title_ko,
    destinationUrl: campaign.destination_url,
    sponsorName: campaign.sponsor_name,
  };
}
