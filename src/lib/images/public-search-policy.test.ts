import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const route = readFileSync(join(process.cwd(), "src/app/api/images/search/route.ts"), "utf8");
const semanticConfig = readFileSync(join(process.cwd(), "src/lib/images/semantic-embedding.ts"), "utf8");
const derivativeVersion = readFileSync(join(process.cwd(), "src/lib/images/analysis-derivative-version.ts"), "utf8");

describe("public keyword-first search policy", () => {
  it("runs the private weighted keyword RPC before considering Voyage", () => {
    expect(route.indexOf('admin.rpc("rank_keyword_images"')).toBeGreaterThan(-1);
    expect(route.indexOf("admin.rpc(\"rank_keyword_images\"") ).toBeLessThan(
      route.indexOf("new VoyageMultimodalEmbeddingProvider"),
    );
    expect(route).toContain("decision.shouldRequestSemanticFallback");
  });

  it("keeps semantic search behind the query flag and a minimum similarity", () => {
    expect(route).toContain("config.queryEnabled");
    expect(route).toContain("p_min_similarity: thresholds.semanticMinimum");
    expect(route).toContain("searchSource: decision.source");
  });

  it("keeps keyword text and orientation filtering independent from Sharp", () => {
    expect(route).toContain("p_search_query: resolved.textQuery");
    expect(route).toContain("p_orientation_filter: resolved.effectiveOrientation");
    expect(semanticConfig).toContain('from "./analysis-derivative-version"');
    expect(semanticConfig).not.toContain('from "./analysis-derivative"');
    expect(derivativeVersion).not.toContain('from "sharp"');
    expect(route).not.toContain('from "sharp"');
  });

  it("rechecks public visibility and all usage filters after ranking", () => {
    expect(route).toContain('.eq("status", "approved")');
    expect(route).toContain('.eq("lifecycle_status", "active")');
    expect(route).toContain('.eq("is_published", true)');
    expect(route).toContain('imageQuery.in("free_usage_policy"');
    expect(route).toContain('imageQuery.in("copyright_license"');
  });
});
