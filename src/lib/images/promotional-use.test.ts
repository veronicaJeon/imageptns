import { describe, expect, it } from "vitest";
import { automaticPromotionalUseBasis } from "./promotional-use";

describe("automaticPromotionalUseBasis", () => {
  it("treats free-for-all as a direct promotional grant", () => {
    expect(automaticPromotionalUseBasis({
      copyrightLicense: "cc_by_nc",
      freeUsagePolicy: "all",
    })).toBe("free_all");
  });

  it.each([
    ["cc0", "cc0"],
    ["cc_by", "cc_by"],
  ])("automatically allows %s", (copyrightLicense, expected) => {
    expect(automaticPromotionalUseBasis({
      copyrightLicense,
      freeUsagePolicy: "none",
    })).toBe(expected);
  });

  it.each(["standard", "cc_by_sa", "cc_by_nc", "cc_by_nc_sa", "cc_by_nd", "cc_by_nc_nd"])(
    "keeps %s on explicit consent",
    (copyrightLicense) => {
      expect(automaticPromotionalUseBasis({
        copyrightLicense,
        freeUsagePolicy: "none",
      })).toBeNull();
    },
  );
});
