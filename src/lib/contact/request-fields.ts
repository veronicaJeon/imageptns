export const INQUIRY_TYPES = ["general", "photo_request"] as const;

export const PHOTO_REQUEST_STATUSES = [
  "submitted",
  "matching",
  "in_progress",
  "fulfilled",
  "cancelled",
  "rejected",
] as const;

export const PHOTO_REQUEST_MATCH_STATUSES = [
  "candidate",
  "invited",
  "interested",
  "declined",
  "selected",
  "cancelled",
] as const;

export const SOURCING_PURPOSES = [
  "rights_check",
  "similar_search",
  "supply_check",
  "context_reference",
  "shooting_request",
] as const;

const MAX_REGIONS = 12;
const MAX_REGION_LENGTH = 80;
const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 48;
const MAX_REFERENCE_URL_LENGTH = 2048;
const MAX_DEADLINE_YEARS_AHEAD = 2;

export type InquiryType = (typeof INQUIRY_TYPES)[number];
export type PhotoRequestStatus = (typeof PHOTO_REQUEST_STATUSES)[number];
export type PhotoRequestMatchStatus = (typeof PHOTO_REQUEST_MATCH_STATUSES)[number];
export type SourcingPurpose = (typeof SOURCING_PURPOSES)[number];

export interface NormalizedContactSubmission {
  name: string;
  email: string;
  subject: string;
  message: string;
  inquiry_type: InquiryType;
  location_label: string | null;
  target_regions: string[];
  category: string | null;
  tags: string[];
  usage_intent: string | null;
  license_intent: string | null;
  budget_min_krw: number | null;
  budget_max_krw: number | null;
  deadline_at: string | null;
  reference_url: string | null;
  reference_note: string | null;
  non_copying_attested: boolean;
  requester_organization: string | null;
  usage_project: string | null;
  usage_context: string | null;
  buyer_id: string | null;
  sourcing_purposes: SourcingPurpose[];
  internal_sourcing_status: "submitted";
  buyer_sourcing_status: "received";
  request_status: "submitted";
}

export interface PhotoRequestBuyerValidationFields {
  requester_organization: unknown;
  usage_project: unknown;
  usage_context: unknown;
  deadline_at: unknown;
  reference_url: unknown;
}

type BuyerValidationLocale = "ko" | "en";

const BUYER_VALIDATION_MESSAGES = {
  ko: {
    requesterOrganization: "요청자 소속을 입력해주세요. 예: ○○출판사, 국립○○박물관, 프리랜서",
    usageProject: "사용 프로젝트를 입력해주세요. 예: 중학교 한국사 보조교재, 전시 리플렛, 단행본 개정판",
    usageContextTooLong: "사용 맥락은 1000자 이내로 입력해주세요.",
    usageContextRequired: "사용 맥락을 입력해주세요. 이미지가 어떤 내용 옆에서 어떤 역할로 쓰이는지 적어주세요.",
    deadline: "희망 마감일은 오늘 이후 날짜로 선택해주세요.",
    referenceUrl: "참고 URL은 http:// 또는 https://로 시작하는 웹 주소만 입력할 수 있습니다.",
  },
  en: {
    requesterOrganization: "Enter your organization. For example: a publisher, museum, agency, or freelance practice.",
    usageProject: "Enter the project where this image will be used. For example: a textbook, exhibition leaflet, or revised book edition.",
    usageContextTooLong: "Usage context must be 1,000 characters or fewer.",
    usageContextRequired: "Enter the usage context. Explain what content the image will appear next to and what role it should play.",
    deadline: "Choose a response date after today.",
    referenceUrl: "Reference URL must be a web address starting with http:// or https://.",
  },
} as const;

function hasValue<T extends readonly string[]>(values: T, value: string): value is T[number] {
  return values.includes(value as T[number]);
}

function normalizeText(value: unknown, fieldName: string, maxLength: number): string {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} is required`);
  }

  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) {
    throw new Error(`${fieldName} is required`);
  }
  if (normalized.length > maxLength) {
    throw new Error(`${fieldName} must be ${maxLength} characters or fewer`);
  }

  return normalized;
}

function normalizeOptionalText(value: unknown, fieldName: string, maxLength: number): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a string`);
  }

  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) return null;
  if (normalized.length > maxLength) {
    throw new Error(`${fieldName} must be ${maxLength} characters or fewer`);
  }

  return normalized;
}

export function normalizeInquiryType(value: unknown): InquiryType {
  if (value === null || value === undefined) return "general";
  if (typeof value !== "string") {
    throw new Error("inquiry_type must be a string");
  }

  const inquiryType = value.trim();
  if (!inquiryType) return "general";
  if (!hasValue(INQUIRY_TYPES, inquiryType)) {
    throw new Error("inquiry_type is not supported");
  }

  return inquiryType;
}

export function normalizePhotoRequestStatus(value: unknown): PhotoRequestStatus {
  if (typeof value !== "string") {
    throw new Error("request_status must be a string");
  }

  const status = value.trim();
  if (!hasValue(PHOTO_REQUEST_STATUSES, status)) {
    throw new Error("request_status is not supported");
  }

  return status;
}

export function normalizeTargetRegions(value: unknown): string[] {
  const rawRegions = typeof value === "string" ? value.split(/[,\n]/) : value;
  if (!Array.isArray(rawRegions)) {
    throw new Error("target_regions must be a list of region names");
  }

  const regions: string[] = [];
  const seen = new Set<string>();
  for (const rawRegion of rawRegions) {
    if (typeof rawRegion !== "string") {
      throw new Error("target_regions must be a list of region names");
    }

    const region = rawRegion.trim().replace(/\s+/g, " ");
    if (!region) continue;
    if (region.length > MAX_REGION_LENGTH) {
      throw new Error(`target_regions entries must be ${MAX_REGION_LENGTH} characters or fewer`);
    }

    const key = region.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    regions.push(region);
  }

  if (regions.length === 0) {
    throw new Error("target_regions must include at least one region");
  }
  if (regions.length > MAX_REGIONS) {
    throw new Error(`target_regions must include ${MAX_REGIONS} regions or fewer`);
  }

  return regions;
}

function normalizeTags(value: unknown): string[] {
  if (value === null || value === undefined) return [];

  const rawTags = typeof value === "string" ? value.split(/[,\n]/) : value;
  if (!Array.isArray(rawTags)) {
    throw new Error("tags must be a list of labels");
  }

  const tags: string[] = [];
  const seen = new Set<string>();
  for (const rawTag of rawTags) {
    if (typeof rawTag !== "string") {
      throw new Error("tags must be a list of labels");
    }

    const tag = rawTag.trim().replace(/\s+/g, " ");
    if (!tag) continue;
    if (tag.length > MAX_TAG_LENGTH) {
      throw new Error(`tags entries must be ${MAX_TAG_LENGTH} characters or fewer`);
    }

    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
  }

  if (tags.length > MAX_TAGS) {
    throw new Error(`tags must include ${MAX_TAGS} entries or fewer`);
  }

  return tags;
}

export function normalizeSourcingPurposes(value: unknown): SourcingPurpose[] {
  const raw = Array.isArray(value) ? value : [];
  const purposes: SourcingPurpose[] = [];
  const seen = new Set<string>();

  for (const item of raw) {
    if (typeof item !== "string") {
      throw new Error("sourcing_purposes must be a list of labels");
    }

    const purpose = item.trim();
    if (!purpose) continue;
    if (!hasValue(SOURCING_PURPOSES, purpose)) {
      throw new Error("sourcing_purposes contains unsupported values");
    }
    if (seen.has(purpose)) continue;
    seen.add(purpose);
    purposes.push(purpose);
  }

  return purposes.length > 0 ? purposes : ["similar_search"];
}

function normalizeDeadline(value: unknown, now: Date): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("deadline_at is required");
  }

  const deadline = new Date(value);
  if (Number.isNaN(deadline.getTime())) {
    throw new Error("deadline_at must be a valid date");
  }
  if (deadline <= now) {
    throw new Error("deadline_at must be in the future");
  }

  const maxDeadline = new Date(now.getTime());
  maxDeadline.setFullYear(maxDeadline.getFullYear() + MAX_DEADLINE_YEARS_AHEAD);
  if (deadline > maxDeadline) {
    throw new Error(`deadline_at must be within ${MAX_DEADLINE_YEARS_AHEAD} years`);
  }

  return deadline.toISOString();
}

export function normalizeReferenceUrl(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") {
    throw new Error("reference_url must be a string");
  }

  const referenceUrl = value.trim();
  if (!referenceUrl) return null;
  if (referenceUrl.length > MAX_REFERENCE_URL_LENGTH) {
    throw new Error(`reference_url must be ${MAX_REFERENCE_URL_LENGTH} characters or fewer`);
  }

  let url: URL;
  try {
    url = new URL(referenceUrl);
  } catch {
    throw new Error("reference_url must be a valid URL");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("reference_url must use http or https");
  }

  return url.toString();
}

export function validatePhotoRequestBuyerFields(
  input: PhotoRequestBuyerValidationFields,
  now: Date = new Date(),
  locale: BuyerValidationLocale = "ko",
): string | null {
  const messages = BUYER_VALIDATION_MESSAGES[locale];
  try {
    normalizeText(input.requester_organization, "requester_organization", 160);
  } catch {
    return messages.requesterOrganization;
  }

  try {
    normalizeText(input.usage_project, "usage_project", 240);
  } catch {
    return messages.usageProject;
  }

  try {
    normalizeText(input.usage_context, "usage_context", 1000);
  } catch {
    const value = typeof input.usage_context === "string" ? input.usage_context.trim() : "";
    return value ? messages.usageContextTooLong : messages.usageContextRequired;
  }

  try {
    normalizeDeadline(input.deadline_at, now);
  } catch {
    return messages.deadline;
  }

  try {
    normalizeReferenceUrl(input.reference_url);
  } catch {
    return messages.referenceUrl;
  }

  return null;
}

export function normalizeContactSubmissionInput(
  input: unknown,
  now: Date = new Date(),
): NormalizedContactSubmission {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("contact submission payload must be an object");
  }

  const body = input as Record<string, unknown>;
  const inquiry_type = normalizeInquiryType(body.inquiry_type);
  const base = {
    name: normalizeText(body.name, "name", 80),
    email: normalizeText(body.email, "email", 254),
    subject: normalizeText(body.subject, "subject", 160),
    message: normalizeText(body.message, "message", 5000),
    inquiry_type,
    buyer_id: null,
    request_status: "submitted" as const,
  };

  if (inquiry_type === "general") {
    return {
      ...base,
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
      usage_project: null,
      usage_context: null,
      sourcing_purposes: [],
      internal_sourcing_status: "submitted",
      buyer_sourcing_status: "received",
    };
  }

  const deadline_at = normalizeDeadline(body.deadline_at, now);
  return {
    ...base,
    location_label: normalizeOptionalText(body.location_label, "location_label", 160),
    target_regions: body.target_regions === undefined || body.target_regions === null ? [] : normalizeTargetRegions(body.target_regions),
    category: normalizeOptionalText(body.category, "category", 80),
    tags: normalizeTags(body.tags),
    usage_intent: normalizeOptionalText(body.usage_intent, "usage_intent", 500),
    license_intent: normalizeOptionalText(body.license_intent, "license_intent", 240),
    budget_min_krw: null,
    budget_max_krw: null,
    deadline_at,
    reference_url: normalizeReferenceUrl(body.reference_url),
    reference_note: normalizeOptionalText(body.reference_note, "reference_note", 1000),
    non_copying_attested: body.non_copying_attested === true,
    requester_organization: normalizeText(body.requester_organization, "requester_organization", 160),
    usage_project: normalizeText(body.usage_project, "usage_project", 240),
    usage_context: normalizeText(body.usage_context, "usage_context", 1000),
    sourcing_purposes: normalizeSourcingPurposes(body.sourcing_purposes),
    internal_sourcing_status: "submitted",
    buyer_sourcing_status: "received",
  };
}
