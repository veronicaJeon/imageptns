import {
  normalizeCopyrightLicenseCode,
  normalizeFreeUsagePolicy,
} from "../licenses/creative-commons";

export const PROMOTIONAL_USE_CONSENT_VERSION = "2026-07-27-v2";

export type PromotionalUseBasis =
  | "explicit"
  | "free_all"
  | "cc0"
  | "cc_by"
  | "owner_backfill";

export function automaticPromotionalUseBasis(input: {
  copyrightLicense: unknown;
  freeUsagePolicy: unknown;
}): Exclude<PromotionalUseBasis, "explicit" | "owner_backfill"> | null {
  const freeUsagePolicy = normalizeFreeUsagePolicy(input.freeUsagePolicy);
  if (freeUsagePolicy === "all") return "free_all";

  const copyrightLicense = normalizeCopyrightLicenseCode(input.copyrightLicense);
  if (copyrightLicense === "cc0") return "cc0";
  if (copyrightLicense === "cc_by") return "cc_by";
  return null;
}

export function promotionalUseBasisLabel(
  basis: PromotionalUseBasis | null,
  lang: "ko" | "en",
) {
  if (lang === "en") {
    if (basis === "free_all") return "Automatically included with Free for all uses";
    if (basis === "cc0") return "Automatically allowed under CC0";
    if (basis === "cc_by") return "Automatically allowed under CC BY 4.0 with attribution";
    return "";
  }
  if (basis === "free_all") return "‘전체 무료’ 범위에 회사소개·공식 홍보 활용이 포함됩니다.";
  if (basis === "cc0") return "CC0 조건에 따라 홍보 활용이 자동 허용됩니다.";
  if (basis === "cc_by") return "출처를 표시하는 조건으로 CC BY 4.0에 따라 홍보 활용이 자동 허용됩니다.";
  return "";
}
