import { describe, expect, it } from "vitest";
import { normalizeLicensePrice, priceCartItemsFromLicenses } from "./pricing";

describe("normalizeLicensePrice", () => {
  it("accepts free or positive whole KRW prices", () => {
    expect(normalizeLicensePrice(0)).toBe(0);
    expect(normalizeLicensePrice(55000)).toBe(55000);
    expect(normalizeLicensePrice("180000")).toBe(180000);
  });

  it("rejects invalid prices", () => {
    expect(() => normalizeLicensePrice(-1)).toThrow("price_krw must be between");
    expect(() => normalizeLicensePrice(1000.5)).toThrow("price_krw must be a whole KRW amount");
  });
});

describe("priceCartItemsFromLicenses", () => {
  it("prices cart items from server license rows instead of client prices", () => {
    const priced = priceCartItemsFromLicenses(
      [
        { id: "image-1", license: "editorial", price: 1 },
        { id: "image-2", license: "commercial", price: 1 },
      ],
      [
        { code: "editorial", price_krw: 15000 },
        { code: "commercial", price_krw: 55000 },
      ],
    );

    expect(priced.map((item) => item.priceKrw)).toEqual([15000, 55000]);
    expect(priced.reduce((sum, item) => sum + item.priceKrw, 0)).toBe(70000);
  });

  it("throws when a requested license is not configured", () => {
    expect(() => priceCartItemsFromLicenses(
      [{ id: "image-1", license: "missing", price: 1 }],
      [{ code: "editorial", price_krw: 15000 }],
    )).toThrow("Invalid license: missing");
  });
});
