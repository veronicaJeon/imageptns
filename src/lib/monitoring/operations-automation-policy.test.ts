import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("operations automation policy", () => {
  const health = readFileSync("src/app/api/health/route.ts", "utf8");
  const monitor = readFileSync(".github/workflows/production-monitor.yml", "utf8");
  const weekly = readFileSync(".github/workflows/maintenance-routine.yml", "utf8");
  const candidates = readFileSync("scripts/derive-maintenance-candidates.mjs", "utf8");
  const runbook = readFileSync("docs/codex-maintenance-runbook.md", "utf8");
  const prompt = readFileSync(".github/codex/prompts/maintenance-implementation.md", "utf8");

  it("publishes provider-neutral release identity and an explicit daily-review pause", () => {
    expect(health).toContain("operations_daily_review");
    expect(health).toContain("APP_RELEASE_SHA");
    expect(health).toContain("APP_RELEASE_REF");
    expect(health).toContain("VERCEL_GIT_COMMIT_SHA");
    expect(health).toContain("VERCEL_GIT_COMMIT_REF");
    expect(health).toContain('status: "paused" as const');
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
    expect(candidates).toContain('key === "operations_review" && value === "paused"');
  });

  it("does not turn an intentionally paused deep review into an incident candidate", () => {
    const tempDirectory = mkdtempSync(join(tmpdir(), "maintenance-candidates-"));
    const outputPath = join(tempDirectory, "candidates.json");

    try {
      execFileSync(process.execPath, ["scripts/derive-maintenance-candidates.mjs", outputPath], {
        env: {
          ...process.env,
          MAINTENANCE_RESULTS: JSON.stringify({
            operations_review: "paused",
            audit: "success",
          }),
        },
      });

      const derived = JSON.parse(readFileSync(outputPath, "utf8")) as Array<{ source: string }>;
      expect(derived.some((candidate) => candidate.source === "check:operations_review")).toBe(false);
    } finally {
      rmSync(tempDirectory, { recursive: true, force: true });
    }
  });

  it("requires a weekly human-like product discovery review", () => {
    expect(runbook).toContain("주간 심층 제품 리뷰");
    expect(runbook).toContain("구매자의 탐색·검색·문의·주문·다운로드");
    expect(runbook).toContain("사실과 추론을 구분");
    expect(prompt).toContain("weekly deep product review");
    expect(prompt).toContain("product improvement opportunities");
  });
});
