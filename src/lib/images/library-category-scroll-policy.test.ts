import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync("src/app/(public)/library/page.tsx", "utf8");

describe("library category scrolling", () => {
  it("keeps overflowing categories anchored at the left edge", () => {
    expect(page).toContain('className="overflow-x-auto overscroll-x-contain pb-1" aria-label="카테고리"');
    expect(page).toContain("flex w-max min-w-full flex-nowrap justify-start gap-2 md:justify-center");
    expect(page).not.toContain("gap-2 overflow-x-auto pb-1 md:justify-center");
  });
});
