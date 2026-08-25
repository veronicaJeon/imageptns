import { NextResponse } from "next/server";
import { forbidden, requireAdminUser } from "@/lib/admin/auth";
import { latestReportByAgent, parseAgentReportComment } from "@/lib/agents/github-activity";

const REPOSITORY = "veronicaJeon/imageptns";
const API_ROOT = `https://api.github.com/repos/${REPOSITORY}`;
const REPOSITORY_URL = `https://github.com/${REPOSITORY}`;

interface GitHubLabel { name: string }
interface GitHubIssue {
  number: number;
  title: string;
  state: "open" | "closed";
  body: string | null;
  html_url: string;
  created_at: string;
  updated_at: string;
  labels: GitHubLabel[];
  pull_request?: unknown;
}
interface GitHubComment { id: number; body: string | null; created_at: string; html_url: string }
interface GitHubRun {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  event: string;
  created_at: string;
  updated_at: string;
  html_url: string;
  head_sha: string;
}
interface GitHubPull {
  number: number;
  title: string;
  state: string;
  draft: boolean;
  html_url: string;
  created_at: string;
  updated_at: string;
  head: { ref: string };
}

function githubHeaders() {
  const token = process.env.GITHUB_READ_TOKEN?.trim();
  return {
    Accept: "application/vnd.github+json",
    "User-Agent": "imagepartners-admin-agent-activity",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function githubJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_ROOT}${path}`, {
    headers: githubHeaders(),
    next: { revalidate: 60 },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`GitHub API ${response.status}`);
  return response.json() as Promise<T>;
}

function labelNames(issue: GitHubIssue) {
  return issue.labels.map((label) => label.name);
}

export async function GET() {
  if (!await requireAdminUser()) return forbidden();

  try {
    const [issuesResponse, runsResponse, pulls] = await Promise.all([
      githubJson<GitHubIssue[]>("/issues?state=all&labels=maintenance&per_page=100"),
      githubJson<{ workflow_runs: GitHubRun[] }>("/actions/workflows/maintenance-routine.yml/runs?per_page=20"),
      githubJson<GitHubPull[]>("/pulls?state=all&per_page=100"),
    ]);
    const issues = issuesResponse.filter((issue) => !issue.pull_request);
    const trackingIssue = issues.find((issue) => issue.title === "[maintenance] Image Partners 72-hour review");
    const comments = trackingIssue
      ? await githubJson<GitHubComment[]>(`/issues/${trackingIssue.number}/comments?per_page=100`)
      : [];
    const reports = comments
      .map(parseAgentReportComment)
      .filter((report) => report !== null)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const latestReports = latestReportByAgent(reports);
    const candidates = issues
      .filter((issue) => labelNames(issue).includes("maintenance-candidate"))
      .map((issue) => ({
        number: issue.number,
        title: issue.title,
        state: issue.state,
        labels: labelNames(issue),
        url: issue.html_url,
        createdAt: issue.created_at,
        updatedAt: issue.updated_at,
      }));
    const maintenancePulls = pulls
      .filter((pull) => pull.head.ref.startsWith("codex/maintenance-"))
      .map((pull) => ({
        number: pull.number,
        title: pull.title,
        state: pull.state,
        draft: pull.draft,
        branch: pull.head.ref,
        url: pull.html_url,
        createdAt: pull.created_at,
        updatedAt: pull.updated_at,
      }));
    const latestRun = runsResponse.workflow_runs[0] ?? null;
    const readyCount = candidates.filter((candidate) => candidate.state === "open" && candidate.labels.includes("codex-ready")).length;
    const approvalCount = candidates.filter((candidate) => candidate.state === "open" && candidate.labels.includes("approval-required")).length;
    const inProgressCount = candidates.filter((candidate) => candidate.state === "open" && candidate.labels.includes("maintenance-in-progress")).length;

    return NextResponse.json({
      source: "github",
      repositoryUrl: REPOSITORY_URL,
      refreshedAt: new Date().toISOString(),
      summary: { readyCount, approvalCount, inProgressCount, openDraftPulls: maintenancePulls.filter((pull) => pull.state === "open").length },
      agents: [
        {
          id: "github",
          name: "GitHub 검사기",
          role: "검사·이슈·개선 후보 도출",
          status: !latestRun ? "idle" : latestRun.status !== "completed" ? "running" : latestRun.conclusion === "success" ? "healthy" : "error",
          detail: !latestRun ? "실행 기록 없음" : latestRun.status !== "completed" ? "주간 제품·코드 점검 실행 중" : latestRun.conclusion === "success" ? "최근 점검 통과" : `최근 점검 ${latestRun.conclusion ?? "실패"}`,
          lastActivityAt: latestRun?.updated_at ?? null,
          url: latestRun?.html_url ?? `${REPOSITORY_URL}/actions/workflows/maintenance-routine.yml`,
        },
        ...(["grok", "gemini"] as const).map((agent) => {
          const report = latestReports[agent];
          return {
            id: agent,
            name: agent === "grok" ? "Grok 검수 에이전트" : "Gemini 검수 에이전트",
            role: "독립 검수·위험 반론·개선 아이디어",
            status: !report ? "idle" : report.status === "success" ? "healthy" : report.status === "unconfigured" ? "warning" : "error",
            detail: !report ? "아직 보고 없음" : report.status === "success" ? `${report.model} 보고 완료` : report.status === "unconfigured" ? "API 키 미설정" : report.errorCode ?? "검수 실패",
            lastActivityAt: report?.createdAt ?? null,
            url: report?.url ?? trackingIssue?.html_url ?? REPOSITORY_URL,
          };
        }),
        {
          id: "codex",
          name: "Codex 운영·제품 에이전트",
          role: "일일 운영 진단·주간 제품 발견·승인 후보 구현",
          status: inProgressCount > 0 ? "running" : readyCount > 0 ? "warning" : "idle",
          detail: inProgressCount > 0 ? `${inProgressCount}건 구현 진행 중` : readyCount > 0 ? `${readyCount}건 개발 대기` : "승인된 대기 작업 없음",
          lastActivityAt: maintenancePulls[0]?.updatedAt ?? candidates.find((candidate) => candidate.labels.includes("codex-ready"))?.updatedAt ?? null,
          url: maintenancePulls[0]?.url ?? `${REPOSITORY_URL}/issues?q=is%3Aopen+label%3Acodex-ready`,
        },
      ],
      reports,
      candidates,
      pullRequests: maintenancePulls,
      runs: runsResponse.workflow_runs.map((run) => ({
        id: run.id,
        name: run.name,
        status: run.status,
        conclusion: run.conclusion,
        event: run.event,
        createdAt: run.created_at,
        updatedAt: run.updated_at,
        url: run.html_url,
        commit: run.head_sha.slice(0, 7),
      })),
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "에이전트 활동을 불러오지 못했습니다.",
    }, { status: 502 });
  }
}
