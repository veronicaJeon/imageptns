import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/076_keyword_search_infix_partial_category.sql"),
  "utf8",
);
const route = readFileSync(join(process.cwd(), "src/app/api/images/search/route.ts"), "utf8");

describe("keyword search quality database policy", () => {
  it("matches Korean terms inside compounds through trigram-indexed text", () => {
    expect(migration).toContain("images_search_text_primary_trgm_idx");
    expect(migration).toContain("gin (search_text_primary gin_trgm_ops)");
    expect(migration).toContain("v_infix := v_infix || (v_term ~ '^[가-힣]{2,}$')");
    expect(migration).toContain("visible.search_text_primary like '%' || term.text || '%' then 0.3");
    expect(migration).toContain("visible.search_text_secondary like '%' || term.text || '%' then 0.15");
  });

  it("indexes Korean and English labels of primary and assigned categories", () => {
    expect(migration).toContain("category_row.label_ko || ' ' || category_row.label_en");
    expect(migration).toContain("assignment.category_code = category_row.code");
    expect(migration).toContain("after insert or update or delete on public.image_category_assignments");
  });

  it("keeps strict AND by default and allows partial matches only for multi-term queries", () => {
    expect(migration).toContain("p_match_any boolean default false");
    expect(migration).toContain("ranked.matched_terms >= case when p_match_any then 1 else v_term_count end");
    expect(migration).toContain("(not p_match_any or v_term_count > 1)");
  });

  it("replaces the previous signature and keeps the RPC server-only", () => {
    expect(migration).toMatch(/drop function if exists public\.rank_keyword_images\(\s*text, text, text, boolean, boolean, boolean, boolean, integer, integer, real\s*\)/);
    expect(migration).toContain("auth.role() <> 'service_role'");
    expect(migration).toContain("image_row.status = 'approved'");
    expect(migration).toContain("image_row.lifecycle_status = 'active'");
    expect(migration).toContain("image_row.is_published = true");
    expect(migration).toMatch(/revoke all on function public\.rank_keyword_images\([^)]*real, boolean\s*\) from public, anon, authenticated/);
  });
});

describe("partial keyword fallback in the search route", () => {
  it("runs only after strict keyword and semantic results are empty", () => {
    const partialCall = route.indexOf("rankKeywordImages(true)");
    expect(partialCall).toBeGreaterThan(route.indexOf("chooseKeywordFirstSearchResults(keywordSignals, semanticSignals, thresholds)"));
    expect(route).toContain('decision.source === "none"');
    expect(route).toContain("choosePartialKeywordResults(");
  });
});
