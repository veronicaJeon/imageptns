import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("photo search privacy and visibility policy", () => {
  it("accepts a bounded in-memory image and rate limits public requests", () => {
    const route = source("src/app/api/images/search-by-photo/route.ts");

    expect(route).toContain('scope: "photo-search"');
    expect(route).toContain("PHOTO_SEARCH_MAX_FILE_BYTES");
    expect(route).toContain("PHOTO_SEARCH_MAX_IMAGE_PIXELS");
    expect(route).toContain('formData.get("image")');
    expect(route).not.toContain("storage.upload");
    expect(route).not.toContain(".insert(");
    expect(route).not.toContain("original_filename");
  });

  it("restricts candidates to public approved active images and disables caching", () => {
    const route = source("src/app/api/images/search-by-photo/route.ts");

    expect(route).toContain('.eq("image.status", "approved")');
    expect(route).toContain('.eq("image.lifecycle_status", "active")');
    expect(route).toContain('.eq("image.is_published", true)');
    expect(route).toContain("buyerCanViewImage");
    expect(route).toContain('"Cache-Control": "private, no-store"');
  });

  it("documents the non-persistent query and semantic-search boundary", () => {
    const design = source("docs/superpowers/specs/2026-08-11-photo-search-design.md");

    expect(design).toContain("입력 바이트를 보관하지 않는다");
    expect(design).toContain("의미 기반 검색이 아니다");
    expect(design).toContain("임베딩");
  });
});
