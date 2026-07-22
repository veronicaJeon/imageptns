export type CopyrightLicenseCode =
  | "standard"
  | "cc0"
  | "cc_by"
  | "cc_by_sa"
  | "cc_by_nc"
  | "cc_by_nc_sa"
  | "cc_by_nd"
  | "cc_by_nc_nd";

export type FreeUsagePolicyCode = "none" | "all" | "education";

export interface CopyrightLicenseOption {
  code: CopyrightLicenseCode;
  label: string;
  summary: string;
  url: string | null;
  requiresAttribution: boolean;
  allowsCommercialUse: boolean;
  allowsDerivatives: boolean;
  requiresShareAlike: boolean;
}

export interface FreeUsagePolicyOption {
  code: FreeUsagePolicyCode;
  label: string;
  summary: string;
}

export type LicenseDisplayLang = "ko" | "en";

const COPYRIGHT_LICENSE_TRANSLATIONS: Record<LicenseDisplayLang, Record<CopyrightLicenseCode, { label: string; summary: string }>> = {
  ko: {
    standard: { label: "Image Partners Standard", summary: "플랫폼 유료 라이선스로 판매합니다. 무료 사용 권한은 별도 정책을 따릅니다." },
    cc0: { label: "CC0", summary: "폭넓은 사용이 가능하지만 Image Partners 출처 표시는 필요합니다." },
    cc_by: { label: "CC BY 4.0", summary: "출처를 표시하면 상업적 이용과 변경이 가능합니다." },
    cc_by_sa: { label: "CC BY-SA 4.0", summary: "출처 표시와 동일조건 변경허락을 지키면 상업적 이용과 변경이 가능합니다." },
    cc_by_nc: { label: "CC BY-NC 4.0", summary: "출처를 표시하면 비영리 목적의 이용과 변경이 가능합니다." },
    cc_by_nc_sa: { label: "CC BY-NC-SA 4.0", summary: "출처 표시와 동일조건 변경허락을 지키면 비영리 목적의 이용과 변경이 가능합니다." },
    cc_by_nd: { label: "CC BY-ND 4.0", summary: "출처를 표시하면 공유와 상업적 이용은 가능하지만 변경본 배포는 제한됩니다." },
    cc_by_nc_nd: { label: "CC BY-NC-ND 4.0", summary: "출처를 표시하면 비영리 목적 공유는 가능하지만 상업적 이용과 변경본 배포는 제한됩니다." },
  },
  en: {
    standard: { label: "Image Partners Standard", summary: "Sold under the platform's paid license. Free-use permissions follow the separate policy selected below." },
    cc0: { label: "CC0", summary: "Broad use is allowed, while Image Partners still requires source credit on this platform." },
    cc_by: { label: "CC BY 4.0", summary: "Commercial use and modifications are allowed with attribution." },
    cc_by_sa: { label: "CC BY-SA 4.0", summary: "Commercial use and modifications are allowed with attribution and share-alike terms." },
    cc_by_nc: { label: "CC BY-NC 4.0", summary: "Non-commercial use and modifications are allowed with attribution." },
    cc_by_nc_sa: { label: "CC BY-NC-SA 4.0", summary: "Non-commercial use and modifications are allowed with attribution and share-alike terms." },
    cc_by_nd: { label: "CC BY-ND 4.0", summary: "Sharing and commercial use are allowed with attribution, but modified versions may not be distributed." },
    cc_by_nc_nd: { label: "CC BY-NC-ND 4.0", summary: "Non-commercial sharing is allowed with attribution, but commercial use and distribution of modified versions are restricted." },
  },
};

const FREE_USAGE_POLICY_TRANSLATIONS: Record<LicenseDisplayLang, Record<FreeUsagePolicyCode, { label: string; summary: string }>> = {
  ko: {
    none: { label: "무료 사용 없음", summary: "무료 사용은 허용하지 않고 선택한 라이선스/판매 정책을 따릅니다." },
    all: { label: "전체 무료", summary: "플랫폼 방문자에게 무료 사용 가능 작품으로 표시합니다." },
    education: { label: "교육용 무료", summary: "수업, 연구, 비상업 교육 자료 제작 등 교육 목적 무료 사용 가능 작품으로 표시합니다." },
  },
  en: {
    none: { label: "No free use", summary: "Free use is not allowed; usage follows the selected license and sales policy." },
    all: { label: "Free for all uses", summary: "Shown to platform visitors as an image available for free use." },
    education: { label: "Free for education", summary: "Shown as free for educational uses such as classes, research, and non-commercial learning materials." },
  },
};

export const COPYRIGHT_LICENSES: CopyrightLicenseOption[] = [
  {
    code: "standard",
    label: "Image Partners Standard",
    summary: "플랫폼 유료 라이선스로 판매합니다. 무료 사용 권한은 별도 정책을 따릅니다.",
    url: null,
    requiresAttribution: true,
    allowsCommercialUse: true,
    allowsDerivatives: true,
    requiresShareAlike: false,
  },
  {
    code: "cc0",
    label: "CC0",
    summary: "폭넓은 사용이 가능하지만 Image Partners 출처 표시는 필요합니다.",
    url: "https://creativecommons.org/publicdomain/zero/1.0/",
    requiresAttribution: true,
    allowsCommercialUse: true,
    allowsDerivatives: true,
    requiresShareAlike: false,
  },
  {
    code: "cc_by",
    label: "CC BY 4.0",
    summary: "출처를 표시하면 상업적 이용과 변경이 가능합니다.",
    url: "https://creativecommons.org/licenses/by/4.0/",
    requiresAttribution: true,
    allowsCommercialUse: true,
    allowsDerivatives: true,
    requiresShareAlike: false,
  },
  {
    code: "cc_by_sa",
    label: "CC BY-SA 4.0",
    summary: "출처 표시와 동일조건 변경허락을 지키면 상업적 이용과 변경이 가능합니다.",
    url: "https://creativecommons.org/licenses/by-sa/4.0/",
    requiresAttribution: true,
    allowsCommercialUse: true,
    allowsDerivatives: true,
    requiresShareAlike: true,
  },
  {
    code: "cc_by_nc",
    label: "CC BY-NC 4.0",
    summary: "출처를 표시하면 비영리 목적의 이용과 변경이 가능합니다.",
    url: "https://creativecommons.org/licenses/by-nc/4.0/",
    requiresAttribution: true,
    allowsCommercialUse: false,
    allowsDerivatives: true,
    requiresShareAlike: false,
  },
  {
    code: "cc_by_nc_sa",
    label: "CC BY-NC-SA 4.0",
    summary: "출처 표시와 동일조건 변경허락을 지키면 비영리 목적의 이용과 변경이 가능합니다.",
    url: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
    requiresAttribution: true,
    allowsCommercialUse: false,
    allowsDerivatives: true,
    requiresShareAlike: true,
  },
  {
    code: "cc_by_nd",
    label: "CC BY-ND 4.0",
    summary: "출처를 표시하면 공유와 상업적 이용은 가능하지만 변경본 배포는 제한됩니다.",
    url: "https://creativecommons.org/licenses/by-nd/4.0/",
    requiresAttribution: true,
    allowsCommercialUse: true,
    allowsDerivatives: false,
    requiresShareAlike: false,
  },
  {
    code: "cc_by_nc_nd",
    label: "CC BY-NC-ND 4.0",
    summary: "출처를 표시하면 비영리 목적 공유는 가능하지만 상업적 이용과 변경본 배포는 제한됩니다.",
    url: "https://creativecommons.org/licenses/by-nc-nd/4.0/",
    requiresAttribution: true,
    allowsCommercialUse: false,
    allowsDerivatives: false,
    requiresShareAlike: false,
  },
];

export const FREE_USAGE_POLICIES: FreeUsagePolicyOption[] = [
  {
    code: "none",
    label: "무료 사용 없음",
    summary: "무료 사용은 허용하지 않고 선택한 라이선스/판매 정책을 따릅니다.",
  },
  {
    code: "all",
    label: "전체 무료",
    summary: "플랫폼 방문자에게 무료 사용 가능 작품으로 표시합니다.",
  },
  {
    code: "education",
    label: "교육용 무료",
    summary: "수업, 연구, 비상업 교육 자료 제작 등 교육 목적 무료 사용 가능 작품으로 표시합니다.",
  },
];

export function normalizeCopyrightLicenseCode(value: unknown): CopyrightLicenseCode {
  if (typeof value !== "string") return "standard";
  const normalized = value.trim().toLowerCase().replaceAll("-", "_");
  return COPYRIGHT_LICENSES.some((license) => license.code === normalized)
    ? normalized as CopyrightLicenseCode
    : "standard";
}

export function normalizeFreeUsagePolicy(value: unknown): FreeUsagePolicyCode {
  if (typeof value !== "string") return "none";
  const normalized = value.trim().toLowerCase();
  return FREE_USAGE_POLICIES.some((policy) => policy.code === normalized)
    ? normalized as FreeUsagePolicyCode
    : "none";
}

export function getCopyrightLicense(value: unknown) {
  const code = normalizeCopyrightLicenseCode(value);
  return COPYRIGHT_LICENSES.find((license) => license.code === code) ?? COPYRIGHT_LICENSES[0];
}

export function getFreeUsagePolicy(value: unknown) {
  const code = normalizeFreeUsagePolicy(value);
  return FREE_USAGE_POLICIES.find((policy) => policy.code === code) ?? FREE_USAGE_POLICIES[0];
}

export function getLocalizedCopyrightLicense(value: unknown, lang: LicenseDisplayLang = "ko") {
  const license = getCopyrightLicense(value);
  return { ...license, ...COPYRIGHT_LICENSE_TRANSLATIONS[lang][license.code] };
}

export function getLocalizedFreeUsagePolicy(value: unknown, lang: LicenseDisplayLang = "ko") {
  const policy = getFreeUsagePolicy(value);
  return { ...policy, ...FREE_USAGE_POLICY_TRANSLATIONS[lang][policy.code] };
}

export function localizedCopyrightLicenses(lang: LicenseDisplayLang = "ko") {
  return COPYRIGHT_LICENSES.map((license) => ({ ...license, ...COPYRIGHT_LICENSE_TRANSLATIONS[lang][license.code] }));
}

export function localizedFreeUsagePolicies(lang: LicenseDisplayLang = "ko") {
  return FREE_USAGE_POLICIES.map((policy) => ({ ...policy, ...FREE_USAGE_POLICY_TRANSLATIONS[lang][policy.code] }));
}

export function copyrightLicenseFromConditions(input: {
  allowsCommercialUse: boolean;
  allowsDerivatives: boolean;
  requiresShareAlike: boolean;
}): Exclude<CopyrightLicenseCode, "standard" | "cc0"> {
  const shareAlike = input.allowsDerivatives && input.requiresShareAlike;

  if (!input.allowsDerivatives) {
    return input.allowsCommercialUse ? "cc_by_nd" : "cc_by_nc_nd";
  }
  if (input.allowsCommercialUse) {
    return shareAlike ? "cc_by_sa" : "cc_by";
  }
  return shareAlike ? "cc_by_nc_sa" : "cc_by_nc";
}

export type BuyerUsageConditionKey =
  | "free"
  | "education_free"
  | "commercial"
  | "derivatives"
  | "attribution";

export interface BuyerUsageCondition {
  key: BuyerUsageConditionKey;
  label: string;
  allowed: boolean;
}

export function creditLineForName(name: string | null | undefined): string {
  const normalized = (name ?? "").trim();
  return `${normalized || "unassigned"} / Image Partners`;
}

export const creditLineForPhotographerId = creditLineForName;

export function buyerUsageConditions(input: {
  copyrightLicense: unknown;
  freeUsagePolicy: unknown;
  lang?: LicenseDisplayLang;
}): BuyerUsageCondition[] {
  const lang = input.lang ?? "ko";
  const license = getLocalizedCopyrightLicense(input.copyrightLicense, lang);
  const freePolicy = getLocalizedFreeUsagePolicy(input.freeUsagePolicy, lang);

  const conditions: BuyerUsageCondition[] = [];

  if (freePolicy.code === "all") {
    conditions.push({ key: "free", label: lang === "ko" ? "무료 사용 가능" : "Free use available", allowed: true });
  }

  if (freePolicy.code === "education") {
    conditions.push({ key: "education_free", label: lang === "ko" ? "교육용 무료 사용 가능" : "Free for educational use", allowed: true });
  }

  conditions.push(
    { key: "commercial", label: license.allowsCommercialUse ? (lang === "ko" ? "상업 사용 가능" : "Commercial use allowed") : (lang === "ko" ? "상업 사용 제한" : "Commercial use restricted"), allowed: license.allowsCommercialUse },
    { key: "derivatives", label: license.allowsDerivatives ? (lang === "ko" ? "원 저작물 변경 가능" : "Modifications allowed") : (lang === "ko" ? "원 저작물 변경 제한" : "Modifications restricted"), allowed: license.allowsDerivatives },
    { key: "attribution", label: lang === "ko" ? "저작자 표시 필요" : "Credit required", allowed: true },
  );

  return conditions;
}
