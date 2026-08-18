import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const route = readFileSync("src/app/api/images/search-by-photo/route.ts", "utf8");

describe("photo semantic fallback policy", () => {
  it("keeps exact and visual fingerprints ahead of semantic search", () => {
    expect(route).toContain("if (matches.length === 0)");
    expect(route.indexOf("rankVisualMatches")).toBeLessThan(route.indexOf("embedImageQuery"));
  });

  it("requires the query flag, a strict provider limit, and the semantic threshold", () => {
    expect(route).toContain("config.queryEnabled");
    expect(route).toContain('scope: "semantic-photo-search"');
    expect(route).toContain("limit: 2");
    expect(route).toContain("p_min_similarity: semanticMinimum");
  });

  it("normalizes the query without exposing storage URLs to Voyage", () => {
    expect(route).toContain("withoutEnlargement: true");
    expect(route).toContain('mimeType: "image/jpeg"');
    expect(route).not.toContain("embedImageQuery({\n            image_url");
  });
});
