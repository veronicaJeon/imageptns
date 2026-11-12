import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("backup and restore policy", () => {
  const migration = readFileSync("supabase/migrations/084_restore_legacy_photo_requests.sql", "utf8");
  const drill = readFileSync("scripts/backup-restore-drill.mjs", "utf8");
  const r2Worker = readFileSync("scripts/r2-restore-drill-worker.mjs", "utf8");
  const r2Runner = readFileSync("scripts/run-r2-restore-drill.mjs", "utf8");

  it("keeps historical photo requests restorable without weakening new intake validation", () => {
    expect(migration).toContain("created_at < timestamptz '2026-07-16 13:17:17+00'");
    expect(migration).toContain("requester_phone is not null");
    expect(migration).toContain("usage_project is not null");
    expect(migration).toContain("deadline_at is not null");
    expect(migration).toContain(") not valid;");
  });

  it("restores a private snapshot and verifies hashes plus foreign keys", () => {
    expect(drill).toContain("mode: 0o700");
    expect(drill).toContain("mode: 0o600");
    expect(drill).toContain("publicForeignKeyOrphans");
    expect(drill).toContain("verifyImageStorageReferences");
    expect(drill).toContain("sample hash mismatch");
    expect(drill).toContain("restore-drill+");
    expect(drill).not.toContain("SUPABASE_SERVICE_ROLE_KEY=");
  });

  it("copies an R2 object into an isolated bucket, verifies it, and removes the drill resources", () => {
    expect(r2Worker).toContain('crypto.subtle.digest("SHA-256"');
    expect(r2Worker).toContain("SOURCE_BUCKET.get");
    expect(r2Worker).toContain("SOURCE_BUCKET.put");
    expect(r2Worker).toContain("SOURCE_BUCKET.delete");
    expect(r2Worker).toContain("TARGET_BUCKET.put");
    expect(r2Worker).toContain("TARGET_BUCKET.delete");
    expect(r2Runner).toContain('command(["delete", workerName, "--force"])');
    expect(r2Runner).toContain('command(["r2", "bucket", "delete", bucketName])');
  });
});
