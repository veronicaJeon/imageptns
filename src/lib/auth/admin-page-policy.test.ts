import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("auth page admin policy", () => {
  it("offers the consent-filtered library picker and derivative endpoint", () => {
    const page = read("src/app/(admin)/admin/auth-pages/page.tsx");
    const route = read("src/app/api/admin/auth-pages/library-assets/route.ts");
    expect(page).toContain('promotionalUse: "true"');
    expect(page).toContain("라이브러리에서 선택");
    expect(route).toContain("createAuthLibraryAsset");
  });

  it("renders the company preview in a dialog instead of a sticky side panel", () => {
    const page = read("src/app/(admin)/admin/about-page/page.tsx");
    expect(page).toContain('aria-label="회사소개 미리보기"');
    expect(page).toContain("setPreviewOpen(true)");
    expect(page).not.toContain("xl:sticky xl:top-6");
  });
});
