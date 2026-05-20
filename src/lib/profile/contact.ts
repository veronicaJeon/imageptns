const PHONE_ALLOWED_CHARS = /^[+\d\s().-]+$/;
const MAX_PHONE_LENGTH = 32;
const MIN_PHONE_DIGITS = 7;
const MAX_PHONE_DIGITS = 15;
const MAX_REGIONS = 12;
const MAX_REGION_LENGTH = 80;

export function normalizePhoneNumber(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") {
    throw new Error("phone_number must be a string");
  }

  const phone = value.trim().replace(/\s+/g, " ");
  if (!phone) return null;
  if (phone.length > MAX_PHONE_LENGTH || !PHONE_ALLOWED_CHARS.test(phone)) {
    throw new Error("phone_number contains invalid characters");
  }

  const plusCount = (phone.match(/\+/g) ?? []).length;
  if (plusCount > 1 || (plusCount === 1 && !phone.startsWith("+"))) {
    throw new Error("phone_number must include + only as a country prefix");
  }

  const digitCount = phone.replace(/\D/g, "").length;
  if (digitCount < MIN_PHONE_DIGITS || digitCount > MAX_PHONE_DIGITS) {
    throw new Error(`phone_number must contain ${MIN_PHONE_DIGITS}-${MAX_PHONE_DIGITS} digits`);
  }

  return phone;
}

export function normalizePrimaryActivityRegions(value: unknown): string[] {
  if (value === null || value === undefined) return [];

  const rawRegions = typeof value === "string" ? value.split(/[,\n]/) : value;
  if (!Array.isArray(rawRegions)) {
    throw new Error("primary_activity_regions must be a list of region names");
  }

  const regions: string[] = [];
  const seen = new Set<string>();

  for (const rawRegion of rawRegions) {
    if (typeof rawRegion !== "string") {
      throw new Error("primary_activity_regions must be a list of region names");
    }

    const region = rawRegion.trim().replace(/\s+/g, " ");
    if (!region) continue;
    if (region.length > MAX_REGION_LENGTH) {
      throw new Error(`primary_activity_regions entries must be ${MAX_REGION_LENGTH} characters or fewer`);
    }

    const key = region.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    regions.push(region);
  }

  if (regions.length > MAX_REGIONS) {
    throw new Error(`primary_activity_regions must include ${MAX_REGIONS} regions or fewer`);
  }

  return regions;
}
