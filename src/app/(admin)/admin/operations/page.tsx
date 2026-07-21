"use client";

import { useCallback, useEffect, useState } from "react";

interface OperationalEvent {
  id: string;
  event_type: string;
  component: string;
  status: "ok" | "warning" | "error";
  route: string | null;
  provider: string | null;
  status_code: number | null;
  duration_ms: number | null;
  error_code: string | null;
  message: string | null;
  created_at: string;
}

interface OperationsPayload {
  summary: {
    availabilityChecks: number;
    availabilityPercent: number | null;
    averageLatencyMs: number | null;
    requestErrors: number;
    aiChecks: number;
    aiFailures: number;
    latestRetentionRun: { status: string; started_at: string; completed_at: string | null } | null;
  };
  events: OperationalEvent[];
}

const STATUS_STYLE = {
  ok: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  error: "bg-red-50 text-red-700",
};

export default function OperationsPage() {
  const [payload, setPayload] = useState<OperationsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingAi, setCheckingAi] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/operations", { cache: "no-store" });
      const body = await response.json() as OperationsPayload & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "운영 상태를 불러오지 못했습니다.");
      setPayload(body);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "운영 상태를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function checkAi() {
    setCheckingAi(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/operations", { method: "POST" });
      const body = await response.json() as { ok?: boolean; durationMs?: number; error?: string };
      if (!response.ok || !body.ok) throw new Error(body.error ?? "AI 진단에 실패했습니다.");
      setMessage(`Mistral 운영 진단 성공 (${body.durationMs?.toLocaleString() ?? "-"}ms)`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "AI 진단에 실패했습니다.");
    } finally {
      setCheckingAi(false);
      await load();
    }
  }

  const summary = payload?.summary;
  const cards = [
    ["가용성", summary?.availabilityPercent == null ? "측정 전" : `${summary.availabilityPercent}%`, `${summary?.availabilityChecks ?? 0}회 검사`],
    ["평균 응답", summary?.averageLatencyMs == null ? "측정 전" : `${summary.averageLatencyMs.toLocaleString()}ms`, "최근 24시간"],
    ["서버 오류", `${summary?.requestErrors ?? 0}건`, "포착된 5xx 예외"],
    ["AI 실패", `${summary?.aiFailures ?? 0} / ${summary?.aiChecks ?? 0}`, "실사용·진단 합계"],
  ];

  return (
    <div className="p-6 md:p-10">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="font-headline text-2xl font-extrabold text-on-surface">운영 모니터링</h1>
          <p className="mt-1 text-sm text-outline">최근 24시간의 가용성, DB·스토리지 응답, 서버 오류와 AI 분석 상태입니다.</p>
        </div>
        <button type="button" onClick={checkAi} disabled={checkingAi} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-xs font-bold text-white disabled:opacity-50">
          <span className="material-symbols-outlined text-base">neurology</span>
          {checkingAi ? "Mistral 확인 중..." : "AI 운영 진단 실행"}
        </button>
      </div>

      {message && <div className="mb-5 rounded-lg bg-primary/10 px-4 py-3 text-sm font-semibold text-primary">{message}</div>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value, note]) => (
          <div key={label} className="rounded-xl bg-surface-container-lowest p-5 shadow-ghost">
            <p className="text-xs font-bold text-outline">{label}</p>
            <p className="mt-2 text-2xl font-black text-on-surface">{loading ? "-" : value}</p>
            <p className="mt-1 text-[11px] text-outline">{note}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-xl bg-surface-container-lowest shadow-ghost">
        <div className="border-b border-outline-variant/30 px-5 py-4">
          <h2 className="text-sm font-bold text-on-surface">최근 운영 이벤트</h2>
        </div>
        {loading ? (
          <div className="p-10 text-center text-sm text-outline">불러오는 중...</div>
        ) : !payload?.events.length ? (
          <div className="p-10 text-center text-sm text-outline">아직 기록된 운영 이벤트가 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-xs">
              <thead className="bg-surface-container-low text-outline">
                <tr><th className="px-4 py-3">상태</th><th className="px-4 py-3">구성요소</th><th className="px-4 py-3">이벤트</th><th className="px-4 py-3">응답</th><th className="px-4 py-3">내용</th><th className="px-4 py-3">시각</th></tr>
              </thead>
              <tbody>
                {payload.events.map((event) => (
                  <tr key={event.id} className="border-t border-outline-variant/20">
                    <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${STATUS_STYLE[event.status]}`}>{event.status}</span></td>
                    <td className="px-4 py-3 font-semibold text-on-surface">{event.component}</td>
                    <td className="px-4 py-3 text-on-surface-variant">{event.event_type}</td>
                    <td className="px-4 py-3 text-on-surface-variant">{event.duration_ms == null ? "-" : `${event.duration_ms}ms`}</td>
                    <td className="max-w-sm truncate px-4 py-3 text-outline" title={event.message ?? event.route ?? ""}>{event.message ?? event.route ?? "-"}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-outline">{new Date(event.created_at).toLocaleString("ko-KR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
