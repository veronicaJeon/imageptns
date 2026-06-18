import { describe, expect, it } from "vitest";
import { normalizeLicensePrice, priceCartItemsFromLicenses } from "./pricing";

describe("commerce pricing", () => {
  const licenses = [
    { code: "editorial", price_krw: 15000 },
    { code: "commercial", price_krw: 55000 },
  ];

  it("uses global license prices when no image override exists", () => {
    expect(priceCartItemsFromLicenses([{ id: "img-1", license: "editorial" }], licenses)).toEqual([
      { id: "img-1", license: "editorial", priceKrw: 15000 },
    ]);
  });

  it("uses image-specific override before the global license price", () => {
    expect(priceCartItemsFromLicenses(
      [{ id: "img-1", license: "commercial" }],
      licenses,
      [{ image_id: "img-1", license_code: "commercial", price_krw: 30000 }],
    )).toEqual([
      { id: "img-1", license: "commercial", priceKrw: 30000 },
    ]);
  });

  it("allows zero KRW image overrides for free admin pricing", () => {
    expect(priceCartItemsFromLicenses(
      [{ id: "img-1", license: "commercial" }],
      licenses,
      [{ image_id: "img-1", license_code: "commercial", price_krw: 0 }],
    )[0]?.priceKrw).toBe(0);
  });

  it("rejects invalid prices", () => {
    expect(() => normalizeLicensePrice(-1)).toThrow("price_krw must be between");
    expect(() => normalizeLicensePrice(1.5)).toThrow("whole KRW");
  });
});
