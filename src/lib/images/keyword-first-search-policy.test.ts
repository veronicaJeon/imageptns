import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/070_keyword_first_search.sql"),
  "utf8",
);

describe("keyword-first search database policy", () => {
  it("weights titles and tags above descriptions and categories", () => {
    expect(migration).toContain("), 'A')");
    expect(migration).toContain("), 'B')");
    expect(migration).toContain("), 'C')");
    expect(migration).toContain("array[0.1, 0.2, 0.4, 1.0]::real[]");
  });

  it("limits the RPC to service role and all public visibility states", () => {
    expect(migration).toContain("auth.role() <> 'service_role'");
    expect(migration).toContain("image_row.status = 'approved'");
    expect(migration).toContain("image_row.lifecycle_status = 'active'");
    expect(migration).toContain("image_row.is_published = true");
    expect(migration).toMatch(/revoke all on function public\.rank_keyword_images[\s\S]*from public, anon, authenticated/);
  });

  it("applies category, orientation, and usage filters inside the ranked query", () => {
    expect(migration).toContain("assignment.category_code = p_category_filter");
    expect(migration).toContain("image_row.orientation_class = p_orientation_filter");
    expect(migration).toContain("image_row.free_usage_policy in ('education', 'all')");
    expect(migration).toContain("image_row.free_usage_policy = 'all'");
    expect(migration).toContain("'cc_by_nd'");
    expect(migration).toContain("'cc_by_nc_sa'");
  });
});
