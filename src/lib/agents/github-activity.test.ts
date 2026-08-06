import { describe, expect, it } from "vitest";
import { latestReportByAgent, parseAgentReportComment } from "./github-activity";

describe("parseAgentReportComment", () => {
  it("parses a structured advisor report and hides control markers", () => {
    const report = parseAgentReportComment({
      id: 42,
      body: [
        "<!-- imagepartners-agent-report -->",
        '<!-- imagepartners-agent-meta:{"agent":"grok","provider":"xAI","model":"grok-4.5","status":"success","runId":"123","durationMs":900} -->',
        "## Grok 검수 보고",
        "근거 기반 제안입니다.",
      ].join("\n"),
      created_at: "2026-08-06T01:00:00Z",
      html_url: "https://github.com/example/issues/1#issuecomment-42",
    });

    expect(report).toMatchObject({ agent: "grok", status: "success", runId: "123", durationMs: 900 });
    expect(report?.body).toContain("근거 기반 제안입니다.");
    expect(report?.body).not.toContain("imagepartners-agent-meta");
  });

  it("ignores malformed or unrelated comments", () => {
    expect(parseAgentReportComment({ id: 1, body: "ordinary", created_at: "", html_url: "" })).toBeNull();
    expect(parseAgentReportComment({ id: 2, body: "<!-- imagepartners-agent-report -->", created_at: "", html_url: "" })).toBeNull();
  });
});

describe("latestReportByAgent", () => {
  it("keeps the latest report for each provider", () => {
    const base = { provider: "provider", model: "model", status: "success" as const, runId: "run", body: "body", url: "url" };
    const latest = latestReportByAgent([
      { ...base, id: 1, agent: "grok", createdAt: "2026-08-01T00:00:00Z" },
      { ...base, id: 2, agent: "grok", createdAt: "2026-08-02T00:00:00Z" },
      { ...base, id: 3, agent: "gemini", createdAt: "2026-08-01T12:00:00Z" },
    ]);
    expect(latest.grok?.id).toBe(2);
    expect(latest.gemini?.id).toBe(3);
  });
});
