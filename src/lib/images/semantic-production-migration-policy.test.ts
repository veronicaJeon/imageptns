import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("supabase/migrations/072_semantic_backfill_and_caption_queue.sql", "utf8");

describe("semantic production queue migration", () => {
  it("backfills only approved active published previews in bounded batches", () => {
    expect(migration).toContain("image_row.status = 'approved'");
    expect(migration).toContain("image_row.lifecycle_status = 'active'");
    expect(migration).toContain("image_row.is_published = true");
    expect(migration).toContain("image_row.storage_path_preview is not null");
    expect(migration).toContain("p_batch_size > 10");
  });

  it("keeps caption data service-role only and photographer text untouched", () => {
    expect(migration).toContain("alter table public.image_ai_captions enable row level security");
    expect(migration).toContain("revoke all on public.image_ai_captions from public, anon, authenticated");
    expect(migration).not.toMatch(/update\s+public\.images\s+set\s+description/i);
    expect(migration).toContain("coalesce(v_ai_caption, '')");
    expect(migration).toContain("refresh_image_fts_after_ai_caption");
  });

  it("uses atomic caption claims and retries", () => {
    expect(migration).toContain("for update skip locked");
    expect(migration).toContain("attempt_count < 3");
    expect(migration).toContain("caption_row.claim_token = p_claim_token");
  });
});
