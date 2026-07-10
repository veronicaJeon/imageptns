import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "page.tsx"),
  "utf8"
);

describe("about page hero text contrast", () => {
  it("uses fixed light text for the image-backed hero heading", () => {
    const headingClass = source.match(
      /<h1 className="([^"]*)">[\s\S]*?\{h\.hero\.headline1\}/
    )?.[1];

    expect(headingClass?.split(/\s+/)).toContain("text-white");
    expect(headingClass).not.toContain("text-on-surface");
  });

  it("uses fixed white text for the image-backed hero description", () => {
    const descriptionClass = source.match(
      /<p className="([^"]*)">[\s\S]*?\{h\.hero\.description\}/
    )?.[1];

    expect(descriptionClass?.split(/\s+/)).toContain("text-white");
    expect(descriptionClass).not.toContain("text-white/");
    expect(descriptionClass).not.toContain("text-zinc-300");
    expect(descriptionClass).not.toContain("text-on-surface-variant");
  });
});
