import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync("src/app/(public)/library/page.tsx", "utf8");
const adminActivity = readFileSync("src/app/(admin)/admin/activity/page.tsx", "utf8");

describe("library zero-result screen", () => {
  it("offers filter reset, category browsing and a prefilled image request", () => {
    expect(page).toContain("copy.noResultsTitle(debouncedQuery.trim())");
    expect(page).toContain("filtersActive && (");
    expect(page).toContain("onClick={clearFilters}");
    expect(page).toContain("setCategory(item.code)");
    expect(page).toContain("buildPhotoRequestHref({ query: debouncedQuery, category, freeOnly, educationFreeOnly, commercialOnly, derivativesOnly })");
  });

  it("records text searches only, never the photo search", () => {
    expect(page).toContain("if (debouncedQuery && !append) {");
    expect(page).toContain("sendLibrarySearchEvent({");
    const photoSearch = page.slice(page.indexOf("async function handlePhotoSearch"), page.indexOf("function endPhotoSearch"));
    expect(photoSearch).not.toContain("sendLibrarySearchEvent");
  });

  it("summarizes zero-result queries for administrators", () => {
    expect(adminActivity).toContain("summarizeZeroResultQueries(events)");
    expect(adminActivity).toContain("결과 없는 검색어");
  });
});
