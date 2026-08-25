import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("operations automation policy", () => {
  const health = readFileSync("src/app/api/health/route.ts", "utf8");
  const monitor = readFileSync(".github/workflows/production-monitor.yml", "utf8");
  const weekly = readFileSync(".github/workflows/maintenance-routine.yml", "utf8");
  const candidates = readFileSync("scripts/derive-maintenance-candidates.mjs", "utf8");

  it("publishes safe release identity and daily review freshness in health", () => {
    expect(health).toContain("operations_daily_review");
    expect(health).toContain("VERCEL_GIT_COMMIT_SHA");
    expect(health).toContain("VERCEL_GIT_COMMIT_REF");
    expect(health).toContain("operations.status === \"stale\"");
  });

  it("makes the 15-minute monitor reject non-main releases", () => {
    expect(monitor).toContain('payload?.release?.commitSha === process.env.GITHUB_SHA');
    expect(monitor).toContain('payload?.release?.commitRef === "main"');
    expect(monitor).toContain('payload?.checks?.operations?.status');
  });

  it("runs the deep review weekly and derives operations and release candidates", () => {
    expect(weekly).toContain("604800");
    expect(weekly).toContain("operations_review");
    expect(weekly).toContain("release_alignment");
    expect(candidates).toContain("일일 운영관리자 경고 조사");
    expect(candidates).toContain("main·Production 릴리스 정합성 복구");
  });
});
