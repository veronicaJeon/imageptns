import { describe, expect, it } from "vitest";
import { normalizeDeletionFeeConfig } from "./deletion-fees";

describe("deletion fee settings", () => {
  it("falls back to default fees when rows are missing or invalid", () => {
    expect(normalizeDeletionFeeConfig([])).toEqual({
      simpleFeeKrw: 5000,
      complexFeeKrw: 30000,
    });

    expect(normalizeDeletionFeeConfig([
      { code: "image_delete_simple", amount_krw: -1, active: true },
      { code: "image_delete_complex", amount_krw: 0, active: false },
    ])).toEqual({
      simpleFeeKrw: 5000,
      complexFeeKrw: 30000,
    });
  });

  it("maps active database settings into deletion fee config", () => {
    expect(normalizeDeletionFeeConfig([
      { code: "image_delete_simple", amount_krw: 8000, active: true },
      { code: "image_delete_complex", amount_krw: 55000, active: true },
    ])).toEqual({
      simpleFeeKrw: 8000,
      complexFeeKrw: 55000,
    });
  });
});
