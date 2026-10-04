import { describe, expect, it } from "vitest";
import { parseSearchSort, sortRankedImages } from "./search-sort";

const ranked = [
  { id: "best-match", created_at: "2026-01-01T00:00:00Z", sales_count: 1 },
  { id: "newest", created_at: "2026-09-01T00:00:00Z", sales_count: 0 },
  { id: "popular", created_at: "2026-05-01T00:00:00Z", sales_count: 9 },
  { id: "tie", created_at: "2026-05-01T00:00:00Z", sales_count: 9 },
];

describe("search result sorting", () => {
  it("keeps relevance order by default and for unknown values", () => {
    expect(parseSearchSort(null)).toBe("relevant");
    expect(parseSearchSort("random")).toBe("relevant");
    expect(sortRankedImages(ranked, "relevant").map((image) => image.id)).toEqual(["best-match", "newest", "popular", "tie"]);
  });

  it("orders by newest upload and keeps relevance order on ties", () => {
    expect(sortRankedImages(ranked, parseSearchSort("newest")).map((image) => image.id)).toEqual(["newest", "popular", "tie", "best-match"]);
  });

  it("orders by sales count and keeps relevance order on ties", () => {
    expect(sortRankedImages(ranked, "popular").map((image) => image.id)).toEqual(["popular", "tie", "best-match", "newest"]);
  });

  it("does not mutate the ranked input", () => {
    sortRankedImages(ranked, "newest");
    expect(ranked[0].id).toBe("best-match");
  });
});
