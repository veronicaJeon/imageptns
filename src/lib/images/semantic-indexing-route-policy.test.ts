import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("semantic indexing cron policy", () => {
  const route = readFileSync("src/app/api/cron/semantic-indexing/route.ts", "utf8");
  const schedule = readFileSync("src/lib/images/semantic-indexing-schedule.ts", "utf8");

  it("requires cron authorization and the dedicated indexing flag", () => {
    expect(route).toContain("authorizeCronRequest(request.headers)");
    expect(schedule).toContain("!config.indexingEnabled");
    expect(schedule).not.toContain("SEMANTIC_IMAGE_QUERY_ENABLED");
  });

  it("never logs raw image or provider payloads", () => {
    expect(route).not.toContain("console.log");
    expect(route).not.toContain("console.error");
    expect(route).not.toContain("storage_path_preview");
    expect(schedule).not.toContain("console.log");
    expect(schedule).not.toContain("storage_path_preview");
  });
});
