import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const source = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("auth page content wiring", () => {
  it("removes dummy image services and loads managed content on both auth pages", () => {
    for (const file of ["src/app/(auth)/login/page.tsx", "src/app/(auth)/signup/page.tsx"]) {
      const page = source(file);
      expect(page).toContain("useAuthPageContent");
      expect(page).not.toContain("picsum.photos");
    }
  });

  it("places the editor under webpage management", () => {
    expect(source("src/lib/admin/nav.ts")).toContain("/admin/auth-pages");
  });
});
