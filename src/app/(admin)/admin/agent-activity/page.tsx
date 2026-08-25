"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminButton, AdminChip, AdminInlineMetrics, AdminListSurface } from "@/components/admin/AdminPrimitives";

type AgentStatus = "healthy" | "warning" | "error" | "running" | "idle";

interface AgentState {
  id: "github" | "grok" | "gemini" | "codex";
  name: string;
  role: string;
  status: AgentStatus;
  detail: string;
  lastActivityAt: string | null;
  url: string;
}

interface AdvisorReport {
  id: number;
  agent: "grok" | "gemini";
  provider: string;
  model: string;
  status: "success" | "error" | "unconfigured";
  runId: string;
  durationMs?: number;
  errorCode?: string;
  body: string;
  createdAt: string;
  url: string;
}

interface Candidate {
  number: number;
  title: string;
  state: "open" | "closed";
  labels: string[];
  url: string;
  updatedAt: string;
}

interface MaintenancePull {
  number: number;
  title: string;
  state: string;
  draft: boolean;
  branch: string;
  url: string;
  updatedAt: string;
}

interface AgentActivityPayload {
  repositoryUrl: string;
  refreshedAt: string;
  summary: { readyCount: number; approvalCount: number; inProgressCount: number; openDraftPulls: number };
  agents: AgentState[];
  reports: AdvisorReport[];
  candidates: Candidate[];
  pullRequests: MaintenancePull[];
  runs: Array<{ id: number; status: string; conclusion: string | null; createdAt: string; url: string; commit: string }>;
}

const STATUS_COPY: Record<AgentStatus, { label: string; tone: "success" | "warning" | "danger" | "primary" | "neutral"; icon: string }> = {
  healthy: { label: "정상", tone: "success", icon: "check_circle" },
  warning: { label: "대기·주의", tone: "warning", icon: "schedule" },
  error: { label: "조치 필요", tone: "danger", icon: "error" },
  running: { label: "실행 중", tone: "primary", icon: "progress_activity" },
  idle: { label: "기록 없음", tone: "neutral", icon: "radio_button_unchecked" },
};

const AGENT_ICON: Record<AgentState["id"], string> = {
  github: "rule",
  grok: "psychology",
  gemini: "auto_awesome",
  codex: "code_blocks",
};

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString("ko-KR") : "아직 없음";
}

function candidateState(candidate: Candidate) {
  if (candidate.labels.includes("maintenance-in-progress")) return { label: "구현 중", tone: "primary" as const };
  if (candidate.labels.includes("codex-ready")) return { label: "Codex 대기", tone: "warning" as const };
  if (candidate.labels.includes("maintenance-approved")) return { label: "승인됨", tone: "success" as const };
  if (candidate.labels.includes("maintenance-rejected")) return { label: "거절·보류", tone: "danger" as const };
  return { label: "승인 필요", tone: "neutral" as const };
}

export default function AgentActivityPage() {
  const [payload, setPayload] = useState<AgentActivityPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reportFilter, setReportFilter] = useState<"all" | "grok" | "gemini">("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/agent-activity", { cache: "no-store" });
      const body = await response.json() as AgentActivityPayload & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "에이전트 활동을 불러오지 못했습니다.");
      setPayload(body);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "에이전트 활동을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visibleReports = useMemo(() => (
    payload?.reports.filter((report) => reportFilter === "all" || report.agent === reportFilter) ?? []
  ), [payload?.reports, reportFilter]);
  const openCandidates = payload?.candidates.filter((candidate) => candidate.state === "open") ?? [];

  return (
    <div className="p-6 md:p-10">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="font-headline text-2xl font-extrabold text-on-surface">에이전트 활동현황</h1>
          <p className="mt-1 max-w-3xl text-sm text-outline">
            GitHub는 결정론적 검사, Grok·Gemini는 독립 반론, Codex는 일일 운영 진단·주간 제품 발견과 승인된 개발을 담당합니다. 외부 에이전트의 의견은 자동 결정이 아니라 관리자 검토 자료입니다.
          </p>
        </div>
        <AdminButton onClick={() => void load()} disabled={loading} variant="primary">
          <span className={`material-symbols-outlined text-base ${loading ? "animate-spin" : ""}`}>refresh</span>
          {loading ? "동기화 중" : "GitHub와 동기화"}
        </AdminButton>
      </div>

      {error && <div className="mb-5 rounded-lg bg-error-container px-4 py-3 text-sm font-semibold text-on-error-container">{error}</div>}

      <AdminListSurface className="mb-6 p-5">
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined mt-0.5 text-xl text-primary">verified_user</span>
          <div>
            <p className="text-sm font-bold text-on-surface">역할과 승인 경계</p>
            <p className="mt-1 text-xs leading-5 text-outline">
              Grok·Gemini 보고서는 코드·DB·운영을 변경하지 않습니다. Codex도 draft PR까지만 만들며 병합, 운영 배포, 운영 DB 적용과 데이터 삭제는 별도 승인 대상입니다. 모든 근거는 공개 GitHub 이슈·Actions·PR에서 다시 확인할 수 있습니다.
            </p>
          </div>
        </div>
      </AdminListSurface>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {(payload?.agents ?? []).map((agent) => {
          const status = STATUS_COPY[agent.status];
          return (
            <a key={agent.id} href={agent.url} target="_blank" rel="noreferrer" className="rounded-xl bg-surface-container-lowest p-5 shadow-ghost transition-transform hover:-translate-y-0.5">
              <div className="flex items-start justify-between gap-3">
                <span className="material-symbols-outlined rounded-lg bg-primary/10 p-2 text-xl text-primary">{AGENT_ICON[agent.id]}</span>
                <AdminChip tone={status.tone}>
                  <span className={`material-symbols-outlined text-xs ${agent.status === "running" ? "animate-spin" : ""}`}>{status.icon}</span>
                  {status.label}
                </AdminChip>
              </div>
              <h2 className="mt-4 text-sm font-black text-on-surface">{agent.name}</h2>
              <p className="mt-1 text-[11px] font-semibold text-primary">{agent.role}</p>
              <p className="mt-3 text-xs text-on-surface-variant">{agent.detail}</p>
              <p className="mt-2 text-[10px] text-outline">최근 활동 {formatDate(agent.lastActivityAt)}</p>
            </a>
          );
        })}
        {loading && !payload && Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-48 animate-pulse rounded-xl bg-surface-container-high" />)}
      </section>

      <AdminListSurface className="mt-6 p-5">
        <h2 className="text-sm font-black text-on-surface">개발 대기열</h2>
        <p className="mt-1 text-xs text-outline">GitHub 검사기가 만든 후보와 Codex 개발 진행 상태입니다.</p>
        <div className="mt-4">
          <AdminInlineMetrics
            items={[
              { label: "승인 필요", value: payload?.summary.approvalCount ?? 0 },
              { label: "Codex 대기", value: payload?.summary.readyCount ?? 0 },
              { label: "구현 중", value: payload?.summary.inProgressCount ?? 0 },
              { label: "열린 draft PR", value: payload?.summary.openDraftPulls ?? 0 },
            ]}
          />
        </div>
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {openCandidates.slice(0, 12).map((candidate) => {
            const state = candidateState(candidate);
            return (
              <a key={candidate.number} href={candidate.url} target="_blank" rel="noreferrer" className="flex items-start justify-between gap-3 rounded-lg bg-surface-container-low p-4 hover:bg-surface-container-high">
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-on-surface">#{candidate.number} {candidate.title}</p>
                  <p className="mt-1 text-[10px] text-outline">갱신 {formatDate(candidate.updatedAt)}</p>
                </div>
                <AdminChip tone={state.tone} className="shrink-0">{state.label}</AdminChip>
              </a>
            );
          })}
          {!loading && openCandidates.length === 0 && <p className="py-6 text-center text-xs text-outline lg:col-span-2">열린 개선 후보가 없습니다.</p>}
        </div>
      </AdminListSurface>

      <section className="mt-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-black text-on-surface">Grok·Gemini 검수 보고</h2>
            <p className="mt-1 text-xs text-outline">같은 검사 근거를 독립적으로 검토한 의견입니다. 근거 없는 제안은 채택하지 않습니다.</p>
          </div>
          <div className="flex gap-2">
            {(["all", "grok", "gemini"] as const).map((filter) => (
              <button key={filter} type="button" onClick={() => setReportFilter(filter)} className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${reportFilter === filter ? "bg-primary text-white" : "bg-surface-container-high text-on-surface-variant"}`}>
                {filter === "all" ? "전체" : filter === "grok" ? "Grok" : "Gemini"}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {visibleReports.map((report) => (
            <AdminListSurface key={report.id} className="overflow-hidden">
              <div className="flex items-start justify-between gap-3 border-b border-outline-variant/20 px-5 py-4">
                <div>
                  <p className="text-sm font-black text-on-surface">{report.agent === "grok" ? "Grok" : "Gemini"} 검수 보고</p>
                  <p className="mt-1 text-[10px] text-outline">{report.provider} · {report.model} · {formatDate(report.createdAt)}</p>
                </div>
                <AdminChip tone={report.status === "success" ? "success" : report.status === "unconfigured" ? "warning" : "danger"}>
                  {report.status === "success" ? "보고 완료" : report.status === "unconfigured" ? "미설정" : "실패"}
                </AdminChip>
              </div>
              <div className="p-5">
                <div className="max-h-[32rem] overflow-y-auto whitespace-pre-wrap text-xs leading-6 text-on-surface-variant">{report.body || report.errorCode || "보고 내용 없음"}</div>
                <div className="mt-4 flex items-center justify-between border-t border-outline-variant/20 pt-3 text-[10px] text-outline">
                  <span>실행 #{report.runId}{report.durationMs == null ? "" : ` · ${report.durationMs.toLocaleString()}ms`}</span>
                  <a href={report.url} target="_blank" rel="noreferrer" className="font-bold text-primary hover:underline">원문 보기</a>
                </div>
              </div>
            </AdminListSurface>
          ))}
          {!loading && visibleReports.length === 0 && (
            <AdminListSurface className="p-10 text-center xl:col-span-2">
              <span className="material-symbols-outlined text-4xl text-outline">smart_toy</span>
              <p className="mt-3 text-sm font-bold text-on-surface">아직 검수 보고가 없습니다.</p>
              <p className="mt-1 text-xs text-outline">다음 주간 제품·코드 점검 뒤 Grok과 Gemini의 성공 또는 실패 결과가 모두 표시됩니다.</p>
            </AdminListSurface>
          )}
        </div>
      </section>

      {(payload?.pullRequests.length ?? 0) > 0 && (
        <AdminListSurface className="mt-6 p-5">
          <h2 className="text-sm font-black text-on-surface">Codex 개발 PR</h2>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {payload?.pullRequests.slice(0, 10).map((pull) => (
              <a key={pull.number} href={pull.url} target="_blank" rel="noreferrer" className="rounded-lg bg-surface-container-low p-4 hover:bg-surface-container-high">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-xs font-bold text-on-surface">#{pull.number} {pull.title}</p>
                  <AdminChip tone={pull.state === "open" ? "primary" : "neutral"}>{pull.draft ? "Draft" : pull.state}</AdminChip>
                </div>
                <p className="mt-2 truncate font-mono text-[10px] text-outline">{pull.branch}</p>
              </a>
            ))}
          </div>
        </AdminListSurface>
      )}

      <p className="mt-5 text-right text-[10px] text-outline">{payload ? `마지막 동기화 ${formatDate(payload.refreshedAt)}` : ""}</p>
    </div>
  );
}
