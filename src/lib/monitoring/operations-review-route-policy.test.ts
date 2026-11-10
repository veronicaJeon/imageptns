import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("daily operations review route policy", () => {
  const route = readFileSync("src/app/api/cron/operations-review/route.ts", "utf8");
  const schedule = readFileSync("vercel.json", "utf8");
  const cloudflare = readFileSync("wrangler.jsonc", "utf8");

  it("requires cron authorization and runs the operator, AI, and indexing checks", () => {
    expect(route).toContain("authorizeCronRequest(request.headers)");
    expect(route).toContain('runAiSyntheticCheck("operations-cron")');
    expect(route).toContain("runScheduledAiIndexing()");
    expect(route).toContain("runOperationsReview()");
  });

  it("keeps the expensive daily review paused while retention cleanup remains scheduled", () => {
    expect(route).toContain('OPERATIONS_DAILY_REVIEW_ENABLED !== "true"');
    expect(route).toContain('{ status: "paused" }');
    expect(schedule).not.toContain('"path": "/api/cron/operations-review"');
    expect(schedule).not.toContain('"path": "/api/cron/ai-synthetic"');
    expect(schedule).toContain('"path": "/api/cron/auto-reject-stale"');
    expect(cloudflare).toContain('"crons": ["7,22,37,52 * * * *", "0 2 * * *"]');
    expect(cloudflare).toContain('"OPERATIONS_DAILY_REVIEW_ENABLED": "false"');
  });
});
