import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Cloudflare migration boundary", () => {
  const worker = readFileSync("cloudflare-worker.ts", "utf8");
  const wrangler = readFileSync("wrangler.jsonc", "utf8");
  const imageWorker = readFileSync("cloudflare-image-worker.ts", "utf8");
  const imageWrangler = readFileSync("wrangler.image-runtime.jsonc", "utf8");
  const serverWrangler = readFileSync("wrangler.server.jsonc", "utf8");
  const apiWrangler = readFileSync("wrangler.api.jsonc", "utf8");
  const adminApiWrangler = readFileSync("wrangler.admin-api.jsonc", "utf8");
  const packageJson = readFileSync("package.json", "utf8");
  const buildScript = readFileSync("scripts/build-cloudflare.mjs", "utf8");
  const secretsScript = readFileSync("scripts/upload-cloudflare-secrets.mjs", "utf8");
  const workerUploadScript = readFileSync(
    "scripts/upload-cloudflare-worker-with-curl.mjs",
    "utf8",
  );
  const siteAssetSource = readFileSync("src/lib/images/site-asset-source.ts", "utf8");
  const uploadRoute = readFileSync("src/app/api/uploads/route.ts", "utf8");
  const uploadLimits = readFileSync("src/lib/uploads/limits.ts", "utf8");

  it("builds the Next application with OpenNext on Workers", () => {
    expect(packageJson).toContain('"build:cloudflare": "node scripts/build-cloudflare.mjs"');
    expect(buildScript).toContain('spawn(executable, ["build"]');
    expect(buildScript).toContain("bundle-cloudflare-api.mjs");
    expect(readFileSync("scripts/bundle-cloudflare-api.mjs", "utf8")).toContain(
      "`.open-next/server-functions/${functionName}`",
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
    expect(wrangler).toContain('"binding": "ADMIN_API_WORKER"');
    expect(wrangler).toContain('"service": "imagepartners-admin-api"');
    expect(serverWrangler).toContain('"main": "cloudflare-server-worker.ts"');
    expect(apiWrangler).toContain('"main": "cloudflare-api-worker.ts"');
    expect(adminApiWrangler).toContain('"main": "cloudflare-admin-api-worker.ts"');
    expect(apiWrangler).toContain('"@opentelemetry/api": "./src/lib/cloudflare/unavailable-module.ts"');
    expect(readFileSync("cloudflare-api-worker.ts", "utf8")).toContain(
      'server-functions/api/handler.mjs',
    );
    expect(serverWrangler).toContain('"__dirname": "\\\"/\\\""');
    expect(imageWrangler).toContain('"main": "cloudflare-image-worker.ts"');
    expect(imageWrangler).toContain('"binding": "IMAGES"');
    expect(imageWorker).toContain("createCloudflareImageFingerprint");
    expect(siteAssetSource).toContain("CLOUDFLARE_IMAGE_INPUT_MAX_BYTES");
    expect(siteAssetSource).toContain('downloadImageObject(admin, bucket, path)');
    expect(secretsScript).toContain('["NX_", "TURBO_", "VERCEL"]');
    expect(secretsScript).toContain('"R2_IMAGE_STORAGE_ENABLED"');
    expect(secretsScript).toContain("APP_RELEASE_SHA");
    expect(workerUploadScript).toContain("config.r2_buckets");
    expect(workerUploadScript).toContain('type: "r2_bucket"');
    expect(workerUploadScript).toContain("bucket_name");
  });

  it("routes API and page traffic to separate Workers", () => {
    expect(worker).toContain('pathname.startsWith("/api/admin/") || pathname.startsWith("/api/cron/")');
    expect(worker).toContain("env.ADMIN_API_WORKER");
    expect(worker).toContain("env.API_WORKER");
  });

  it("runs image processing without the legacy Vercel origin", () => {
    expect(wrangler).not.toContain("LEGACY_IMAGE_ORIGIN");
    expect(worker).not.toContain("LEGACY_IMAGE_PATHS");
    expect(worker).not.toContain("proxyToLegacyImageRuntime");
    expect(worker).toContain('"/__internal/image-transform"');
    expect(worker).toContain('"/__internal/image-watermark"');
    expect(worker).toContain('"/__internal/upload-fingerprint"');
    expect(imageWorker).toContain("createTransformResponse");
    expect(imageWorker).toContain("createWatermarkResponse");
    expect(imageWorker).toContain("createUploadFingerprintResponse");
    expect(uploadRoute).toContain("fingerprintUploadWithCloudflare");
    expect(uploadLimits).toContain("MAX_UPLOAD_FILE_BYTES = 20_000_000");
  });

  it("runs only retention cleanup from the Cloudflare scheduled handler", () => {
    expect(worker).toContain('controller.cron !== "0 2 * * *"');
    expect(worker).toContain("/api/cron/auto-reject-stale");
    expect(worker).not.toContain('controller.cron !== "0 3 * * *"');
  });
});
