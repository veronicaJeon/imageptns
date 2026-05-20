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

const MAX_REGIONS = 12;
const MAX_REGION_LENGTH = 80;
const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 48;
const MAX_BUDGET_KRW = 1_000_000_000;
const MAX_REFERENCE_URL_LENGTH = 2048;
const MAX_DEADLINE_YEARS_AHEAD = 2;

export type InquiryType = (typeof INQUIRY_TYPES)[number];
export type PhotoRequestStatus = (typeof PHOTO_REQUEST_STATUSES)[number];
export type PhotoRequestMatchStatus = (typeof PHOTO_REQUEST_MATCH_STATUSES)[number];

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
  request_status: "submitted";
}

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

function normalizeBudgetRange(minValue: unknown, maxValue: unknown): {
  budget_min_krw: number;
  budget_max_krw: number;
} {
  if (!Number.isInteger(minValue) || !Number.isInteger(maxValue)) {
    throw new Error("budget_min_krw and budget_max_krw must be integer KRW amounts");
  }

  const budget_min_krw = minValue as number;
  const budget_max_krw = maxValue as number;
  if (budget_min_krw < 0 || budget_max_krw < 0) {
    throw new Error("budget amounts must be zero or greater");
  }
  if (budget_min_krw > budget_max_krw) {
    throw new Error("budget_min_krw must be less than or equal to budget_max_krw");
  }
  if (budget_max_krw > MAX_BUDGET_KRW) {
    throw new Error(`budget_max_krw must be ${MAX_BUDGET_KRW} or less`);
  }

  return { budget_min_krw, budget_max_krw };
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
    };
  }

  if (body.non_copying_attested !== true) {
    throw new Error("non_copying_attested must be true for photo requests");
  }

  const budget = normalizeBudgetRange(body.budget_min_krw, body.budget_max_krw);
  return {
    ...base,
    location_label: normalizeText(body.location_label, "location_label", 160),
    target_regions: normalizeTargetRegions(body.target_regions),
    category: normalizeOptionalText(body.category, "category", 80),
    tags: normalizeTags(body.tags),
    usage_intent: normalizeText(body.usage_intent, "usage_intent", 500),
    license_intent: normalizeText(body.license_intent, "license_intent", 240),
    budget_min_krw: budget.budget_min_krw,
    budget_max_krw: budget.budget_max_krw,
    deadline_at: normalizeDeadline(body.deadline_at, now),
    reference_url: normalizeReferenceUrl(body.reference_url),
    reference_note: normalizeOptionalText(body.reference_note, "reference_note", 1000),
    non_copying_attested: true,
  };
}
