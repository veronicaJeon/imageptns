import { describe, expect, it } from "vitest";
import { scaledPhotoSearchDimensions } from "./photo-search-client";

describe("photo search client preparation", () => {
  it("keeps small images at their original size", () => {
    expect(scaledPhotoSearchDimensions(1200, 800)).toEqual({ width: 1200, height: 800 });
  });

  it("scales landscape and portrait images within the search edge", () => {
    expect(scaledPhotoSearchDimensions(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(scaledPhotoSearchDimensions(2000, 4000)).toEqual({ width: 800, height: 1600 });
  });

  it("rejects invalid source dimensions", () => {
    expect(() => scaledPhotoSearchDimensions(0, 100)).toThrow("Invalid photo dimensions");
  });
});
