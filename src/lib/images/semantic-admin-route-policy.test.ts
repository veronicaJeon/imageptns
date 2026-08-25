import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const route = readFileSync("src/app/api/admin/semantic-indexing/route.ts", "utf8");

describe("admin semantic indexing endpoint", () => {
  it("requires an authenticated administrator for status and manual backfill", () => {
    expect(route.match(/requireAdminUser\(\)/g)).toHaveLength(2);
    expect(route).toContain("runScheduledAiIndexing()");
  });

  it("does not return job IDs, image paths, or provider errors", () => {
    expect(route).not.toContain("storage_path_preview");
    expect(route).not.toContain("last_error_message");
    expect(route).not.toContain("error.message");
  });
});
