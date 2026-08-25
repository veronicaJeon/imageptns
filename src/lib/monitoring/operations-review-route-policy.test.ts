import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("daily operations review route policy", () => {
  const route = readFileSync("src/app/api/cron/operations-review/route.ts", "utf8");
  const schedule = readFileSync("vercel.json", "utf8");

  it("requires cron authorization and runs the operator, AI, and indexing checks", () => {
    expect(route).toContain("authorizeCronRequest(request.headers)");
    expect(route).toContain('runAiSyntheticCheck("operations-cron")');
    expect(route).toContain("runScheduledAiIndexing()");
    expect(route).toContain("runOperationsReview()");
  });

  it("uses the existing daily cron slot", () => {
    expect(schedule).toContain('"path": "/api/cron/operations-review"');
    expect(schedule).not.toContain('"path": "/api/cron/ai-synthetic"');
  });
});
