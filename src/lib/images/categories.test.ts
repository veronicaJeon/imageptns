import { describe, expect, it } from "vitest";
import {
  categoryAssignmentRows,
  normalizeCategoryCodes,
  primaryCategoryCode,
} from "./categories";

describe("image category helpers", () => {
  it("deduplicates category codes while preserving the first occurrence order", () => {
    expect(normalizeCategoryCodes(["nature", "people", "nature", " editorial ", "people"])).toEqual([
      "nature",
      "people",
      "editorial",
    ]);
  });

  it("filters invalid categories when allowed codes are provided", () => {
    expect(normalizeCategoryCodes(["nature", "unknown", "people"], new Set(["nature", "people"]))).toEqual([
      "nature",
      "people",
    ]);
  });

  it("selects the first normalized category as primary with a fallback", () => {
    expect(primaryCategoryCode(["unknown", "urban"], "nature", new Set(["nature", "urban"]))).toBe("urban");
    expect(primaryCategoryCode([], "nature", new Set(["nature", "urban"]))).toBe("nature");
  });

  it("builds assignment rows with only the first category marked primary", () => {
    expect(categoryAssignmentRows("image-1", ["nature", "people", "nature"])).toEqual([
      { image_id: "image-1", category_code: "nature", is_primary: true },
      { image_id: "image-1", category_code: "people", is_primary: false },
    ]);
  });
});
