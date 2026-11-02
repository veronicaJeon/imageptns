import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Cloudflare migration boundary", () => {
  const worker = readFileSync("cloudflare-worker.ts", "utf8");
  const wrangler = readFileSync("wrangler.jsonc", "utf8");
  const packageJson = readFileSync("package.json", "utf8");
  const buildScript = readFileSync("scripts/build-cloudflare.mjs", "utf8");

  it("builds the Next application with OpenNext on Workers", () => {
    expect(packageJson).toContain('"build:cloudflare": "node scripts/build-cloudflare.mjs"');
    expect(buildScript).toContain('spawn(executable, ["build"]');
    expect(buildScript).toContain('.replace(/\\\\n$/g, "")');
    expect(buildScript).toContain('.replace(/\\n$/g, "")');
    expect(wrangler).toContain('"main": "cloudflare-worker.ts"');
    expect(wrangler).toContain('"nodejs_compat"');
    expect(wrangler).toContain('"binding": "IMAGES"');
  });

  it("isolates native Sharp routes behind the temporary image origin", () => {
    expect(wrangler).toContain("https://legacy-origin.imagepartners.kr");
    expect(worker).toContain('"/api/images/search-by-photo"');
    expect(worker).toContain('"/api/images/thumbnail"');
    expect(worker).toContain('"/api/uploads"');
    expect(worker).toContain('"/api/admin/about-page/library-assets"');
    expect(worker).toContain('"/api/admin/auth-pages/library-assets"');
    expect(worker).toContain("proxyToLegacyImageRuntime");
    expect(worker).toContain('x-imagepartners-runtime", "legacy-image"');
    expect(worker).toContain("AbortSignal.timeout(65_000)");
  });

  it("runs only retention cleanup from the Cloudflare scheduled handler", () => {
    expect(worker).toContain('controller.cron !== "0 2 * * *"');
    expect(worker).toContain("/api/cron/auto-reject-stale");
    expect(worker).not.toContain('controller.cron !== "0 3 * * *"');
  });
});
