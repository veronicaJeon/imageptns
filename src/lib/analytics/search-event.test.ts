import { describe, expect, it } from "vitest";
import { buildLibrarySearchEvent, summarizeZeroResultQueries } from "./search-event";

describe("library search events", () => {
  it("records a bounded query with result count and filters", () => {
    const event = buildLibrarySearchEvent({
      query: `  서울   야경 ${"가".repeat(200)}`,
      resultCount: 0,
      hasMore: false,
      searchSource: "none",
      category: "all",
      orientation: "portrait",
      usageFilters: ["free"],
    }, "session-1");
    expect(event.eventType).toBe("search");
    expect(event.path).toBe("/library");
    expect(event.metadata.query.startsWith("서울 야경 가")).toBe(true);
    expect(event.metadata.query).toHaveLength(100);
    expect(event.metadata).toMatchObject({ resultCount: 0, searchSource: "none", orientation: "portrait", usageFilters: ["free"] });
  });
});

describe("zero-result query summary", () => {
  it("groups empty searches case-insensitively by frequency", () => {
    const summary = summarizeZeroResultQueries([
      { event_type: "search", metadata: { query: "Seoul tower", resultCount: 0 }, created_at: "2026-10-01T00:00:00Z" },
      { event_type: "search", metadata: { query: "seoul tower", resultCount: 0 }, created_at: "2026-10-03T00:00:00Z" },
      { event_type: "search", metadata: { query: "한복", resultCount: 0 }, created_at: "2026-10-02T00:00:00Z" },
      { event_type: "search", metadata: { query: "한강", resultCount: 12 }, created_at: "2026-10-02T00:00:00Z" },
      { event_type: "page_view", metadata: { query: "x", resultCount: 0 }, created_at: "2026-10-02T00:00:00Z" },
    ]);
    expect(summary).toEqual([
      { query: "Seoul tower", count: 2, lastSeenAt: "2026-10-03T00:00:00Z" },
      { query: "한복", count: 1, lastSeenAt: "2026-10-02T00:00:00Z" },
    ]);
  });
});
