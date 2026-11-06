import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("supabase/migrations/081_r2_image_storage_provider.sql", "utf8");
const presign = readFileSync("src/app/api/uploads/presign/route.ts", "utf8");
const r2Upload = readFileSync("src/app/api/uploads/r2/[sessionId]/route.ts", "utf8");
const upload = readFileSync("src/app/api/uploads/route.ts", "utf8");
const publicAsset = readFileSync("src/app/api/image-assets/[...path]/route.ts", "utf8");
const storage = readFileSync("src/lib/storage/image-storage-server.ts", "utf8");
const apiWrangler = readFileSync("wrangler.api.jsonc", "utf8");
const adminWrangler = readFileSync("wrangler.admin-api.jsonc", "utf8");

describe("R2 image storage transition policy", () => {
  it("keeps existing rows on Supabase by default", () => {
    expect(migration).toContain("storage_provider text not null default 'supabase'");
    expect(migration).toContain("storage_provider_original text not null default 'supabase'");
  });

  it("switches only when the R2 feature flag and binding are available", () => {
    expect(presign).toContain("r2ImageStorageRequested()");
    expect(presign).toContain("r2ImageStorageAvailable()");
    expect(presign).toContain("Image storage temporarily unavailable");
    expect(r2Upload).toContain('storage_provider", "r2"');
    expect(r2Upload).toContain("requireApprovedPhotographer");
    expect(r2Upload).toContain("await req.arrayBuffer()");
    expect(r2Upload).toContain("uploadBytes.byteLength !== declaredSize");
    expect(r2Upload).toContain("r2.put(key, uploadBytes");
    for (const config of [apiWrangler, adminWrangler]) {
      expect(config).toContain('"binding": "IMAGE_STORAGE"');
      expect(config).toContain('"bucket_name": "imagepartners-images"');
      expect(config).toContain('"R2_IMAGE_STORAGE_ENABLED": "true"');
    }
  });

  it("stores every new image derivative with the provider-aware adapter", () => {
    expect(upload).toContain('putImageObject(admin, "images-analysis"');
    expect(upload).toContain('putImageObject(admin, "images-preview", storage_path_original');
    expect(upload).toContain('putImageObject(admin, "images-preview", `thumbs/${storage_path_original}`');
    expect(upload).toContain("storage_provider_original: storageProvider");
    expect(upload).toContain("storage_provider_preview: storageProvider");
  });

  it("exposes only the public preview namespace", () => {
    expect(publicAsset).toContain('getR2ImageObject("images-preview", path)');
    expect(publicAsset).not.toContain("images-original");
    expect(publicAsset).not.toContain("images-analysis");
    expect(storage).toContain("IMAGE_STORAGE");
  });
});
