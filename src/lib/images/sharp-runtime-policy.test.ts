import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Vercel Sharp runtime packaging", () => {
  const config = readFileSync("next.config.ts", "utf8");

  it("ships the Linux Sharp binary and libvips with image-processing routes", () => {
    expect(config).toContain('"./node_modules/sharp/**/*"');
    expect(config).toContain('"./node_modules/@img/sharp-linux-x64/**/*"');
    expect(config).toContain('"./node_modules/@img/sharp-libvips-linux-x64/**/*"');
    expect(config).toContain('"/api/images/thumbnail": sharpRuntimeFiles');
    expect(config).toContain('"/api/images/search-by-photo": sharpRuntimeFiles');
    expect(config).toContain('"/api/uploads": sharpRuntimeFiles');
  });
});
