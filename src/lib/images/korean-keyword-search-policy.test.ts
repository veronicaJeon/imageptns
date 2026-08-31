import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/075_korean_prefix_keyword_search.sql"),
  "utf8",
);

describe("Korean keyword search database policy", () => {
  it("uses prefix queries for Korean terms with at least two characters", () => {
    expect(migration).toContain("v_term ~ '^[가-힣]{2,}$'");
    expect(migration).toContain("to_tsquery('simple', v_term || ':*')");
  });

  it("keeps one-character Korean and non-Korean terms exact", () => {
    expect(migration).toContain("plainto_tsquery('simple', v_term)");
  });

  it("preserves AND semantics across multiple search terms", () => {
    expect(migration).toContain("v_query := v_query && v_term_query");
    expect(migration).toContain("to_tsvector('simple', '서울 한강 북단의 모습')");
    expect(migration).toContain("to_tsvector('simple', '서울 한강 남단의 모습')");
  });

  it("preserves visibility, structured filters, and service-role access", () => {
    expect(migration).toContain("auth.role() <> 'service_role'");
    expect(migration).toContain("image_row.status = 'approved'");
    expect(migration).toContain("image_row.lifecycle_status = 'active'");
    expect(migration).toContain("image_row.is_published = true");
    expect(migration).toContain("image_row.orientation_class = p_orientation_filter");
    expect(migration).toMatch(/revoke all on function public\.rank_keyword_images[\s\S]*from public, anon, authenticated/);
  });
});
