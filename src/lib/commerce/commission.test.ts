import { describe, expect, it } from "vitest";
import { calculateCommission, selectCommissionPolicy } from "./commission";

const now = new Date("2026-05-19T00:00:00.000Z");

describe("selectCommissionPolicy", () => {
  it("prefers image policy over photographer, license, and default policies", () => {
    const policy = selectCommissionPolicy({
      imageId: "image-1",
      photographerId: "photographer-1",
      licenseCode: "commercial",
      now,
      policies: [
        { id: "default", scope: "default", rate: 0.2, active: true },
        { id: "license", scope: "license", license_code: "commercial", rate: 0.18, active: true },
        { id: "photographer", scope: "photographer", photographer_id: "photographer-1", rate: 0.15, active: true },
        { id: "image", scope: "image", image_id: "image-1", rate: 0.1, active: true },
      ],
    });

    expect(policy.id).toBe("image");
    expect(policy.rate).toBe(0.1);
  });

  it("ignores inactive and out-of-window policies", () => {
    const policy = selectCommissionPolicy({
      imageId: "image-1",
      photographerId: "photographer-1",
      licenseCode: "commercial",
      now,
      policies: [
        { id: "inactive", scope: "image", image_id: "image-1", rate: 0.1, active: false },
        { id: "expired", scope: "photographer", photographer_id: "photographer-1", rate: 0.12, active: true, ends_at: "2026-05-18T23:59:59.000Z" },
        { id: "future", scope: "license", license_code: "commercial", rate: 0.14, active: true, starts_at: "2026-05-20T00:00:00.000Z" },
        { id: "default", scope: "default", rate: 0.2, active: true },
      ],
    });

    expect(policy.id).toBe("default");
    expect(policy.rate).toBe(0.2);
  });
});

describe("calculateCommission", () => {
  it("rounds commission to the nearest KRW and returns net amount", () => {
    expect(calculateCommission(55000, 0.175)).toEqual({
      grossKrw: 55000,
      commissionRate: 0.175,
      commissionKrw: 9625,
      netKrw: 45375,
    });
  });
});
