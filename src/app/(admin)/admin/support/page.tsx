"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";

type SupportStatus = "pending" | "in_progress" | "resolved";
type SupportTab = SupportStatus | "all";
type SupportPriority = "low" | "normal" | "high" | "urgent";

const TABS: { key: SupportTab; label: string; icon: string }[] = [
  { key: "pending", label: "대기 중", icon: "pending_actions" },
  { key: "in_progress", label: "처리 중", icon: "support_agent" },
  { key: "resolved", label: "해결됨", icon: "check_circle" },
  { key: "all", label: "전체", icon: "grid_view" },
];

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-300",
  in_progress: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-300",
  resolved: "bg-primary/10 text-primary",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "대기 중",
  in_progress: "처리 중",
  resolved: "해결됨",
};

const PRIORITY_STYLES: Record<string, string> = {
  low: "bg-surface-container text-outline",
  normal: "bg-surface-container-low text-on-surface-variant",
  high: "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-300",
  urgent: "bg-error/10 text-error",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "낮음",
  normal: "보통",
  high: "높음",
  urgent: "긴급",
};

interface SupportSubmission {
  id: string;
  name: string | null;
  email: string | null;
  subject: string | null;
  message: string | null;
  status: SupportStatus;
  priority: SupportPriority | string | null;
  admin_note: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string | null;
  resolved_at: string | null;
  assignee?: { id: string; full_name: string | null } | null;
}

function formatDate(iso?: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminSupportPage() {
  const [tab, setTab] = useState<SupportTab>("pending");
  const [submissions, setSubmissions] = useState<SupportSubmission[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [actioning, setActioning] = useState<string | null>(null);

  const fetchSubmissions = useCallback(async (status: SupportTab) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/support?status=${status}`);
      if (res.status === 403) {
        setForbidden(true);
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error ?? "문의 내역을 불러오지 못했습니다.");
      }

      const { submissions: rows } = await res.json() as { submissions?: SupportSubmission[] };
      const nextRows = rows ?? [];
      setSubmissions(nextRows);
      setNotes(Object.fromEntries(nextRows.map((row) => [row.id, row.admin_note ?? ""])));
    } catch (error) {
      alert(error instanceof Error ? error.message : "문의 내역을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSubmissions(tab); }, [tab, fetchSubmissions]);

  async function updateSubmission(
    submission: SupportSubmission,
    patch: Partial<Pick<SupportSubmission, "status" | "priority" | "admin_note" | "assigned_to">>
  ) {
    setActioning(submission.id);
    try {
      const res = await fetch("/api/admin/support", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: submission.id,
          status: patch.status ?? submission.status,
          priority: patch.priority ?? submission.priority ?? "normal",
          admin_note: patch.admin_note ?? notes[submission.id] ?? "",
          assigned_to: patch.assigned_to ?? submission.assigned_to ?? null,
        }),
      });

      if (res.status === 403) {
        setForbidden(true);
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error ?? "문의 상태를 저장하지 못했습니다.");
      }

      const { submission: updated } = await res.json() as { submission: SupportSubmission };
      setNotes((prev) => ({ ...prev, [updated.id]: updated.admin_note ?? "" }));

      if (tab !== "all" && updated.status !== tab) {
        setSubmissions((prev) => prev.filter((row) => row.id !== updated.id));
        return;
      }

      setSubmissions((prev) =>
        prev.map((row) => (row.id === updated.id ? { ...row, ...updated } : row))
      );
    } catch (error) {
      alert(error instanceof Error ? error.message : "문의 상태를 저장하지 못했습니다.");
    } finally {
      setActioning(null);
    }
  }

  if (forbidden) {
    return (
      <div className="p-10 flex flex-col items-center justify-center min-h-[60vh] gap-4 text-outline">
        <span className="material-symbols-outlined text-6xl text-error">lock</span>
        <h1 className="font-headline text-xl font-extrabold text-on-surface">접근 권한이 없습니다</h1>
        <p className="text-sm">관리자 계정이 아닙니다.</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10">
      <div className="mb-8">
        <h1 className="font-headline text-2xl font-extrabold text-on-surface tracking-tight">고객 문의</h1>
        <p className="text-sm text-outline mt-1">
          {!loading && `${submissions.length}건의 문의가 표시됩니다`}
        </p>
      </div>

      <div className="flex gap-1 mb-6 bg-surface-container-lowest p-1 rounded-xl w-fit shadow-ghost overflow-x-auto max-w-full">
        {TABS.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 whitespace-nowrap",
              tab === key
                ? "bg-primary text-white shadow-sm"
                : "text-on-surface-variant hover:text-on-surface"
            )}
          >
            <span className="material-symbols-outlined text-base">{icon}</span>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <span className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : submissions.length === 0 ? (
        <div className="flex flex-col items-center py-32 gap-4 text-outline">
          <span className="material-symbols-outlined text-6xl">support_agent</span>
          <p className="text-base">
            {tab === "pending" ? "대기 중인 문의가 없습니다." : "문의 내역이 없습니다."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {submissions.map((submission) => {
            const isBusy = actioning === submission.id;
            const noteValue = notes[submission.id] ?? "";

            return (
              <div key={submission.id} className="bg-surface-container-lowest shadow-ghost rounded-xl overflow-hidden">
                <div className="p-5 flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="material-symbols-outlined text-base text-on-surface-variant">person</span>
                        <h2 className="font-headline font-bold text-base text-on-surface truncate">
                          {submission.name || "Unknown"}
                        </h2>
                        <a
                          href={submission.email ? `mailto:${submission.email}` : undefined}
                          className="text-xs text-outline hover:text-primary transition-colors truncate"
                        >
                          {submission.email || "No email"}
                        </a>
                      </div>
                      <p className="text-xs text-outline mt-1">접수일 {formatDate(submission.created_at)}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                      <span className={cn("text-[10px] font-bold px-3 py-1 rounded-full", PRIORITY_STYLES[submission.priority ?? "normal"] ?? PRIORITY_STYLES.normal)}>
                        {PRIORITY_LABELS[submission.priority ?? "normal"] ?? submission.priority}
                      </span>
                      <span className={cn("text-[10px] font-bold px-3 py-1 rounded-full", STATUS_STYLES[submission.status] ?? "bg-surface-container text-outline")}>
                        {STATUS_LABELS[submission.status] ?? submission.status}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <p className="font-semibold text-on-surface">{submission.subject || "제목 없음"}</p>
                    <p className="text-sm text-on-surface-variant leading-relaxed whitespace-pre-wrap">
                      {submission.message || "내용 없음"}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wide">
                    <span className="bg-surface-container-low text-on-surface-variant px-2.5 py-1 rounded-full flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px]">schedule</span>
                      수정일 {formatDate(submission.updated_at)}
                    </span>
                    {submission.resolved_at && (
                      <span className="bg-surface-container-low text-on-surface-variant px-2.5 py-1 rounded-full flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">task_alt</span>
                        해결일 {formatDate(submission.resolved_at)}
                      </span>
                    )}
                    {submission.assignee?.full_name && (
                      <span className="bg-surface-container-low text-on-surface-variant px-2.5 py-1 rounded-full flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">assignment_ind</span>
                        {submission.assignee.full_name}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 p-3 bg-surface-container-low border border-outline-variant/30 rounded-lg">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-outline">관리자 메모</label>
                    <textarea
                      value={noteValue}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [submission.id]: e.target.value }))}
                      rows={3}
                      placeholder="처리 내용, 후속 조치, 내부 공유 메모를 입력하세요"
                      className="bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded-lg px-3 py-2 text-sm text-on-surface placeholder:text-outline outline-none resize-y min-h-24"
                    />
                    <div className="flex justify-end">
                      <button
                        onClick={() => updateSubmission(submission, { admin_note: noteValue })}
                        disabled={isBusy}
                        className="flex items-center gap-1.5 px-4 py-2 bg-surface-container-lowest border border-outline-variant text-xs font-bold text-on-surface-variant rounded hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
                      >
                        {isBusy ? (
                          <span className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <span className="material-symbols-outlined text-sm">save</span>
                        )}
                        메모 저장
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    {submission.status !== "in_progress" && (
                      <button
                        onClick={() => updateSubmission(submission, { status: "in_progress" })}
                        disabled={isBusy}
                        className="flex items-center gap-1.5 px-5 py-2.5 border border-blue-500/40 text-blue-600 text-xs font-bold uppercase tracking-widest rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-50"
                      >
                        {isBusy ? (
                          <span className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <span className="material-symbols-outlined text-sm">support_agent</span>
                        )}
                        처리 중
                      </button>
                    )}
                    {submission.status !== "resolved" && (
                      <button
                        onClick={() => updateSubmission(submission, { status: "resolved" })}
                        disabled={isBusy}
                        className="flex items-center gap-1.5 px-5 py-2.5 bg-primary text-white text-xs font-bold uppercase tracking-widest rounded hover:opacity-90 transition-opacity disabled:opacity-50"
                      >
                        {isBusy ? (
                          <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <span className="material-symbols-outlined text-sm">check_circle</span>
                        )}
                        해결
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
