import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Cloudflare migration boundary", () => {
  const worker = readFileSync("cloudflare-worker.ts", "utf8");
  const wrangler = readFileSync("wrangler.jsonc", "utf8");
  const imageWorker = readFileSync("cloudflare-image-worker.ts", "utf8");
  const imageWrangler = readFileSync("wrangler.image-runtime.jsonc", "utf8");
  const serverWrangler = readFileSync("wrangler.server.jsonc", "utf8");
  const apiWrangler = readFileSync("wrangler.api.jsonc", "utf8");
  const packageJson = readFileSync("package.json", "utf8");
  const buildScript = readFileSync("scripts/build-cloudflare.mjs", "utf8");
  const secretsScript = readFileSync("scripts/upload-cloudflare-secrets.mjs", "utf8");
  const siteAssetSource = readFileSync("src/lib/images/site-asset-source.ts", "utf8");

  it("builds the Next application with OpenNext on Workers", () => {
    expect(packageJson).toContain('"build:cloudflare": "node scripts/build-cloudflare.mjs"');
    expect(buildScript).toContain('spawn(executable, ["build"]');
    expect(buildScript).toContain("bundle-cloudflare-api.mjs");
    expect(readFileSync("scripts/bundle-cloudflare-api.mjs", "utf8")).toContain(
      'replaceAll(\n    ".open-next/server-functions/default",\n    ".open-next/server-functions/api"',
    );
    expect(buildScript).toContain('.replace(/\\\\n$/g, "")');
    expect(buildScript).toContain('.replace(/\\n$/g, "")');
    expect(wrangler).toContain('"main": "cloudflare-worker.ts"');
    expect(wrangler).toContain('"nodejs_compat"');
    expect(wrangler).toContain('"binding": "IMAGE_RUNTIME"');
    expect(wrangler).toContain('"binding": "DEFAULT_WORKER"');
    expect(wrangler).toContain('"service": "imagepartners-server"');
    expect(wrangler).toContain('"binding": "API_WORKER"');
    expect(wrangler).toContain('"service": "imagepartners-api"');
    expect(serverWrangler).toContain('"main": "cloudflare-server-worker.ts"');
    expect(apiWrangler).toContain('"main": "cloudflare-api-worker.ts"');
    expect(apiWrangler).toContain('"@opentelemetry/api": "./src/lib/cloudflare/unavailable-module.ts"');
    expect(readFileSync("cloudflare-api-worker.ts", "utf8")).toContain(
      'server-functions/api/handler.mjs',
    );
    expect(serverWrangler).toContain('"__dirname": "\\\"/\\\""');
    expect(imageWrangler).toContain('"main": "cloudflare-image-worker.ts"');
    expect(imageWrangler).toContain('"binding": "IMAGES"');
    expect(imageWorker).toContain("createCloudflareImageFingerprint");
    expect(siteAssetSource).toContain("CLOUDFLARE_IMAGE_INPUT_MAX_BYTES");
    expect(siteAssetSource).toContain('download(admin, "images-analysis"');
    expect(secretsScript).toContain('["NX_", "TURBO_", "VERCEL"]');
    expect(secretsScript).toContain("APP_RELEASE_SHA");
  });

  it("routes API and page traffic to separate Workers", () => {
    expect(worker).toContain('pathname.startsWith("/api/") ? env.API_WORKER : env.DEFAULT_WORKER');
    expect(worker).toContain("env.API_WORKER.fetch");
  });

  it("isolates native Sharp routes behind the temporary image origin", () => {
    expect(wrangler).toContain("https://legacy-origin.imagepartners.kr");
    const legacyPaths = worker.slice(
      worker.indexOf("const LEGACY_IMAGE_PATHS"),
      worker.indexOf("function shouldUseLegacyImageRuntime"),
    );
    expect(legacyPaths).not.toContain('"/api/images/search-by-photo"');
    expect(legacyPaths).not.toContain('"/api/images/thumbnail"');
    expect(worker).toContain('"/api/uploads"');
    expect(legacyPaths).not.toContain('"/api/admin/about-page/library-assets"');
    expect(legacyPaths).not.toContain('"/api/admin/auth-pages/library-assets"');
    expect(worker).toContain('"/__internal/image-transform"');
    expect(imageWorker).toContain("createTransformResponse");
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
