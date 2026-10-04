import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const globals = readFileSync(join(here, "globals.css"), "utf8");
const layout = readFileSync(join(here, "layout.tsx"), "utf8");

describe("design typography and color baseline", () => {
  it("renders every text role with a Korean-capable typeface", () => {
    expect(globals).toMatch(/--font-display:\s*"Pretendard Variable"/);
    for (const role of ["--font-headline", "--font-body", "--font-sans"]) {
      expect(globals).toContain(`${role}:`);
      expect(globals).toMatch(new RegExp(`${role}:\\s*var\\(--font-display\\)`));
    }
    expect(layout).toContain("pretendardvariable-dynamic-subset");
    expect(layout).not.toMatch(/Epilogue|from "next\/font\/google"/);
  });

  it("does not use fluorescent accents, gradients, blur panels or template names", () => {
    expect(globals.toLowerCase()).not.toContain("#00ff7b");
    expect(globals).not.toMatch(/linear-gradient|backdrop-filter/);
    expect(globals).not.toMatch(/Lumina|Digital Curator/);
    expect(layout).not.toContain("Digital Curator");
  });
});
