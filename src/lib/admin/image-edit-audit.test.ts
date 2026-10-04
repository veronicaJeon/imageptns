import { describe, expect, it } from "vitest";
import { diffImageEdit, sortPriceOverrides, staleOverrideCodes } from "./image-edit-audit";

describe("diffImageEdit", () => {
  it("records only fields that changed", () => {
    const diff = diffImageEdit(
      { title: "한옥", tags: ["서울"], is_published: true, price_overrides: [], status: "approved" },
      { title: "북촌 한옥", tags: ["서울"], is_published: false, price_overrides: [], status: "approved" },
    );

    expect(diff.changedFields).toEqual(["title", "is_published"]);
    expect(diff.before).toEqual({ title: "한옥", is_published: true });
    expect(diff.after).toEqual({ title: "북촌 한옥", is_published: false });
  });

  it("detects price override changes and treats missing values as null", () => {
    const diff = diffImageEdit(
      { title: "한옥", price_overrides: [{ license_code: "web", price_krw: 30000 }] },
      { title: "한옥", description: null, price_overrides: [{ license_code: "web", price_krw: 50000 }] },
    );

    expect(diff.changedFields).toEqual(["price_overrides"]);
  });

  it("reports no change for identical edits", () => {
    const image = { title: "한옥", tags: ["서울"], category_codes: ["architecture"] };
    expect(diffImageEdit(image, { ...image }).changedFields).toEqual([]);
  });
});

describe("price override helpers", () => {
  it("removes only license codes missing from the new list", () => {
    expect(staleOverrideCodes(
      [{ license_code: "web", price_krw: 1 }, { license_code: "print", price_krw: 2 }],
      [{ license_code: "web", price_krw: 3 }],
    )).toEqual(["print"]);
    expect(staleOverrideCodes([], [{ license_code: "web", price_krw: 3 }])).toEqual([]);
  });

  it("sorts overrides and drops extra columns", () => {
    expect(sortPriceOverrides([
      { license_code: "web", price_krw: 2, image_id: "i", updated_by: "a" } as never,
      { license_code: "print", price_krw: 1 },
    ])).toEqual([
      { license_code: "print", price_krw: 1 },
      { license_code: "web", price_krw: 2 },
    ]);
  });
});
