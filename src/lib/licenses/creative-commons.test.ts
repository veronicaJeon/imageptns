import { describe, expect, it } from "vitest";
import { getCopyrightLicense, getFreeUsagePolicy, normalizeCopyrightLicenseCode, normalizeFreeUsagePolicy } from "./creative-commons";

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

  it("normalizes free usage policies", () => {
    expect(getFreeUsagePolicy("education").label).toBe("교육용 무료");
    expect(normalizeFreeUsagePolicy("bad-value")).toBe("none");
  });
});
