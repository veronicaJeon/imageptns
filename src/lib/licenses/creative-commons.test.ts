import { describe, expect, it } from "vitest";
import {
  buyerUsageConditions,
  creditLineForName,
  getCopyrightLicense,
  getFreeUsagePolicy,
  normalizeCopyrightLicenseCode,
  normalizeFreeUsagePolicy,
} from "./creative-commons";

describe("creative commons metadata", () => {
  it("normalizes supported copyright license codes", () => {
    expect(normalizeCopyrightLicenseCode("cc-by-nc-sa")).toBe("cc_by_nc_sa");
    expect(normalizeCopyrightLicenseCode("CC0")).toBe("cc0");
    expect(normalizeCopyrightLicenseCode("unknown")).toBe("standard");
  });

  it("describes CC BY-NC as attribution required, non-commercial, derivatives allowed", () => {
    const license = getCopyrightLicense("cc_by_nc");

    expect(license.label).toBe("CC BY-NC 4.0");
    expect(license.requiresAttribution).toBe(true);
    expect(license.allowsCommercialUse).toBe(false);
    expect(license.allowsDerivatives).toBe(true);
  });

  it("requires attribution for the standard platform license", () => {
    const license = getCopyrightLicense("standard");

    expect(license.requiresAttribution).toBe(true);
  });

  it("requires platform attribution for CC0-like assets", () => {
    const license = getCopyrightLicense("cc0");

    expect(license.requiresAttribution).toBe(true);
  });

  it("normalizes free usage policies", () => {
    expect(getFreeUsagePolicy("education").label).toBe("교육용 무료");
    expect(normalizeFreeUsagePolicy("bad-value")).toBe("none");
  });

  it("builds the platform credit line from the photographer display name", () => {
    expect(creditLineForName("김지리")).toBe("김지리 / Image Partners");
  });

  it("uses an unassigned credit line fallback when photographer name is missing", () => {
    expect(creditLineForName(null)).toBe("unassigned / Image Partners");
  });

  it("maps backend license fields into buyer-friendly usage conditions", () => {
    const conditions = buyerUsageConditions({
      copyrightLicense: "cc_by",
      freeUsagePolicy: "education",
    });

    expect(conditions).toEqual([
      { key: "education_free", label: "교육용 무료 사용 가능", allowed: true },
      { key: "commercial", label: "상업 사용 가능", allowed: true },
      { key: "derivatives", label: "원 저작물 변경 가능", allowed: true },
      { key: "attribution", label: "저작자 표시 필요", allowed: true },
    ]);
  });

  it("maps non-commercial no-derivatives licenses into restricted buyer conditions", () => {
    const conditions = buyerUsageConditions({
      copyrightLicense: "cc_by_nc_nd",
      freeUsagePolicy: "none",
    });

    expect(conditions).toEqual([
      { key: "commercial", label: "상업 사용 제한", allowed: false },
      { key: "derivatives", label: "원 저작물 변경 제한", allowed: false },
      { key: "attribution", label: "저작자 표시 필요", allowed: true },
    ]);
  });

  it("includes free and platform attribution conditions for the standard free policy", () => {
    const conditions = buyerUsageConditions({
      copyrightLicense: "standard",
      freeUsagePolicy: "all",
    });

    expect(conditions).toEqual([
      { key: "free", label: "무료 사용 가능", allowed: true },
      { key: "commercial", label: "상업 사용 가능", allowed: true },
      { key: "derivatives", label: "원 저작물 변경 가능", allowed: true },
      { key: "attribution", label: "저작자 표시 필요", allowed: true },
    ]);
  });
});
