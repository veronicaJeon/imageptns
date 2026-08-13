import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("semantic image search storage policy", () => {
  const migration = source("supabase/migrations/069_semantic_image_search_foundation.sql");

  it("keeps embeddings private and the cosine RPC service-role only", () => {
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("revoke all on public.image_semantic_embeddings from public, anon, authenticated");
    expect(migration).toContain("auth.role() <> 'service_role'");
    expect(migration).toContain("to service_role");
  });

  it("matches only ready embeddings for public approved active images", () => {
    expect(migration).toContain("embedding_row.status = 'ready'");
    expect(migration).toContain("image_row.status = 'approved'");
    expect(migration).toContain("image_row.lifecycle_status = 'active'");
    expect(migration).toContain("image_row.is_published = true");
  });

  it("supports multiple provider/model versions without a fixed vector dimension", () => {
    expect(migration).toContain("embedding extensions.halfvec");
    expect(migration).not.toContain("halfvec(");
    expect(migration).toContain("unique (image_id, provider, model, model_version)");
    expect(migration).toContain("extensions.vector_dims(embedding) = dimension");
  });
});
