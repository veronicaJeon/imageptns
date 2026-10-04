import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const route = readFileSync(join(process.cwd(), "src/app/api/images/search/route.ts"), "utf8");
const suggestRoute = readFileSync(join(process.cwd(), "src/app/api/search/suggest/route.ts"), "utf8");
const suggestMigration = readFileSync(join(process.cwd(), "supabase/migrations/077_search_term_suggestions.sql"), "utf8");
const page = readFileSync(join(process.cwd(), "src/app/(public)/library/page.tsx"), "utf8");

describe("search result pagination and sorting", () => {
  it("filters every ranked candidate before slicing a page", () => {
    expect(route).toContain('.in("id", rankedIds)');
    expect(route).not.toContain("rankedIds.slice(offset");
    expect(route).toContain("matchingImages.slice(offset, offset + limit)");
    expect(route).toContain("hasMore: matchingImages.length > offset + limit");
  });

  it("applies the library sort to search results", () => {
    expect(route).toContain('parseSearchSort(searchParams.get("sort"))');
    expect(route).toContain("sortRankedImages(");
  });

  it("defaults the library to relevance while searching until a sort is chosen", () => {
    expect(page).toContain('chosenSort ?? (debouncedQuery ? "relevant" : "newest")');
    expect(page).toContain("setChosenSort(event.target.value as SortKey)");
  });
});

describe("search autocomplete", () => {
  it("queries every public image through a server-only RPC", () => {
    expect(suggestRoute).toContain('admin.rpc("suggest_search_terms"');
    expect(suggestRoute).not.toContain(".limit(200)");
    expect(suggestMigration).toContain("image_row.status = 'approved'");
    expect(suggestMigration).toContain("image_row.lifecycle_status = 'active'");
    expect(suggestMigration).toContain("image_row.is_published = true");
    expect(suggestMigration).toContain("auth.role() <> 'service_role'");
    expect(suggestMigration).toMatch(/revoke all on function public\.suggest_search_terms\(text, integer\)\s*from public, anon, authenticated/);
  });

  it("matches the query literally and ranks prefix matches before frequency", () => {
    expect(suggestMigration).toContain("'%', '\\%'), '_', '\\_')");
    expect(suggestMigration).toContain("order by grouped.is_prefix desc, grouped.image_count desc");
  });
});
