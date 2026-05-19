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

export const COPYRIGHT_LICENSES: CopyrightLicenseOption[] = [
  {
    code: "standard",
    label: "Image Partners Standard",
    summary: "플랫폼 유료 라이선스로 판매합니다. 무료 사용 권한은 별도 정책을 따릅니다.",
    url: null,
    requiresAttribution: false,
    allowsCommercialUse: true,
    allowsDerivatives: true,
    requiresShareAlike: false,
  },
  {
    code: "cc0",
    label: "CC0",
    summary: "가능한 범위에서 저작권을 포기해 누구나 자유롭게 사용할 수 있습니다.",
    url: "https://creativecommons.org/publicdomain/zero/1.0/",
    requiresAttribution: false,
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
