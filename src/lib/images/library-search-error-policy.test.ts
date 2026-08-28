import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync("src/app/(public)/library/page.tsx", "utf8");

describe("library search failure visibility", () => {
  it("does not present a failed search request as an empty result", () => {
    expect(page).toContain("setLibraryError(debouncedQuery ? copy.textSearchFailed : copy.imageLoadFailed)");
    expect(page).toContain('role="alert"');
    expect(page).toContain("libraryError && images.length === 0 ? null");
    expect(page).toContain("fetchImages(0, false)");
  });
});
