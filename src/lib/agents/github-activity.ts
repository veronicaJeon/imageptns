export const AGENT_REPORT_MARKER = "<!-- imagepartners-agent-report -->";
export const AGENT_META_PREFIX = "<!-- imagepartners-agent-meta:";

export type AgentReportStatus = "success" | "error" | "unconfigured";

export interface AgentReportMeta {
  agent: "grok" | "gemini";
  provider: string;
  model: string;
  status: AgentReportStatus;
  runId: string;
  durationMs?: number;
  errorCode?: string;
}

export interface ParsedAgentReport extends AgentReportMeta {
  id: number;
  body: string;
  createdAt: string;
  url: string;
}

interface GitHubCommentLike {
  id: number;
  body: string | null;
  created_at: string;
  html_url: string;
}

export function parseAgentReportComment(comment: GitHubCommentLike): ParsedAgentReport | null {
  const body = comment.body ?? "";
  if (!body.includes(AGENT_REPORT_MARKER)) return null;

  const metaLine = body
    .split("\n")
    .find((line) => line.startsWith(AGENT_META_PREFIX) && line.endsWith(" -->"));
  if (!metaLine) return null;

  try {
    const raw = metaLine.slice(AGENT_META_PREFIX.length, -4);
    const meta = JSON.parse(raw) as Partial<AgentReportMeta>;
    if (
      (meta.agent !== "grok" && meta.agent !== "gemini")
      || !meta.provider
      || !meta.model
      || !meta.runId
      || !["success", "error", "unconfigured"].includes(String(meta.status))
    ) return null;

    const visibleBody = body
      .split("\n")
      .filter((line) => line !== AGENT_REPORT_MARKER && line !== metaLine)
      .join("\n")
      .trim();

    return {
      id: comment.id,
      agent: meta.agent,
      provider: meta.provider,
      model: meta.model,
      status: meta.status as AgentReportStatus,
      runId: meta.runId,
      durationMs: typeof meta.durationMs === "number" ? meta.durationMs : undefined,
      errorCode: typeof meta.errorCode === "string" ? meta.errorCode : undefined,
      body: visibleBody.slice(0, 12_000),
      createdAt: comment.created_at,
      url: comment.html_url,
    };
  } catch {
    return null;
  }
}

export function latestReportByAgent(reports: ParsedAgentReport[]) {
  const sorted = [...reports].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return {
    grok: sorted.find((report) => report.agent === "grok") ?? null,
    gemini: sorted.find((report) => report.agent === "gemini") ?? null,
  };
}
