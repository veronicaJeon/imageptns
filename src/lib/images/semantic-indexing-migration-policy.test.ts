import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("supabase/migrations/071_semantic_indexing_worker.sql", "utf8");

describe("semantic indexing worker database policy", () => {
  it("claims jobs atomically with a bounded batch and stale-claim recovery", () => {
    expect(migration).toContain("for update skip locked");
    expect(migration).toContain("p_batch_size > 10");
    expect(migration).toContain("interval '15 minutes'");
    expect(migration).toContain("attempt_count < 5");
  });

  it("completes only the active claim for an eligible approved image", () => {
    expect(migration).toContain("embedding_row.claim_token = p_claim_token");
    expect(migration).toContain("image_row.status = 'approved'");
    expect(migration).toContain("image_row.lifecycle_status = 'active'");
    expect(migration).toContain("image_row.is_published = true");
  });

  it("keeps every worker RPC service-role only", () => {
    expect(migration.match(/auth\.role\(\) <> 'service_role'/g)).toHaveLength(3);
    expect(migration.match(/from public, anon, authenticated/g)).toHaveLength(3);
  });
});
