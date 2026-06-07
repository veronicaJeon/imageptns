import { describe, expect, it } from "vitest";
import {
  buyerUsageConditions,
  creditLineForPhotographerId,
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

  it("normalizes free usage policies", () => {
    expect(getFreeUsagePolicy("education").label).toBe("교육용 무료");
    expect(normalizeFreeUsagePolicy("bad-value")).toBe("none");
  });

  it("builds the platform credit line from immutable photographer id", () => {
    expect(creditLineForPhotographerId("jiri_mountain_01")).toBe("jiri_mountain_01 / Image Partners");
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
});
