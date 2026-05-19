"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils/cn";

type TargetType = "all" | "image" | "payout" | "commission_policy" | "contact_submission" | "order" | "user";

interface AuditLog {
  id: string;
  actor_id: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  target_label: string | null;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  actor?: { id: string; full_name: string | null } | null;
}

const FILTERS: { key: TargetType; label: string; icon: string }[] = [
  { key: "all", label: "전체", icon: "grid_view" },
  { key: "image", label: "이미지", icon: "image" },
  { key: "payout", label: "정산", icon: "payments" },
  { key: "commission_policy", label: "수수료", icon: "percent" },
  { key: "contact_submission", label: "문의", icon: "support_agent" },
  { key: "order", label: "주문", icon: "receipt_long" },
  { key: "user", label: "사용자", icon: "person" },
];

const ACTION_STYLES: Record<string, string> = {
  create: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-200",
  update: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-200",
  approve: "bg-primary/10 text-primary",
  reject: "bg-error/10 text-error",
  delete: "bg-error/10 text-error",
  resolve: "bg-primary/10 text-primary",
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shortId(value: string | null | undefined) {
  if (!value) return null;
  return value.length > 12 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value;
}

function jsonPreview(value: unknown) {
  if (!value || (typeof value === "object" && Object.keys(value as object).length === 0)) return "{}";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function targetLabel(type: string) {
  return FILTERS.find((filter) => filter.key === type)?.label ?? type;
}

export default function AdminAuditPage() {
  const [targetType, setTargetType] = useState<TargetType>("all");
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async (filter: TargetType) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/audit?targetType=${filter}`);
      if (res.status === 403) {
        setForbidden(true);
        return;
      }
      const { logs: rows } = await res.json();
      setLogs(rows ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(targetType); }, [targetType, load]);

  const currentFilter = useMemo(
    () => FILTERS.find((filter) => filter.key === targetType) ?? FILTERS[0],
    [targetType],
  );

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
        <h1 className="font-headline text-2xl font-extrabold text-on-surface tracking-tight">감사 로그</h1>
        <p className="text-sm text-outline mt-1">
          {!loading && `최근 ${logs.length.toLocaleString("ko-KR")}건의 ${currentFilter.label} 변경 기록`}
        </p>
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-6">
        <div className="hidden md:flex gap-1 bg-surface-container-lowest p-1 rounded-xl w-fit shadow-ghost">
          {FILTERS.map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setTargetType(key)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200",
                targetType === key ? "bg-primary text-white shadow-sm" : "text-on-surface-variant hover:text-on-surface",
              )}
            >
              <span className="material-symbols-outlined text-base">{icon}</span>
              {label}
            </button>
          ))}
        </div>
        <label className="md:hidden flex items-center gap-2 bg-surface-container-lowest shadow-ghost rounded-xl px-3 py-2">
          <span className="material-symbols-outlined text-base text-outline">filter_list</span>
          <select
            value={targetType}
            onChange={(e) => setTargetType(e.target.value as TargetType)}
            className="flex-1 bg-transparent text-sm font-bold text-on-surface outline-none"
          >
            {FILTERS.map(({ key, label }) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </label>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <span className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center py-32 gap-4 text-outline">
          <span className="material-symbols-outlined text-6xl">manage_search</span>
          <p className="text-base">감사 로그가 없습니다.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {logs.map((log) => (
            <div key={log.id} className="bg-surface-container-lowest shadow-ghost rounded-xl overflow-hidden">
              <div className="p-5 flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="material-symbols-outlined text-base text-on-surface-variant">{currentFilter.icon}</span>
                      <h2 className="font-headline font-bold text-base text-on-surface">{log.action}</h2>
                      <span className="text-xs text-outline">{targetLabel(log.target_type)}</span>
                    </div>
                    <p className="text-xs text-outline mt-1">{formatDateTime(log.created_at)}</p>
                  </div>
                  <span className={cn("text-[10px] font-bold px-3 py-1 rounded-full shrink-0", ACTION_STYLES[log.action] ?? "bg-surface-container text-outline")}>
                    {log.action}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wide">
                  <span className="bg-surface-container-low text-on-surface-variant px-2.5 py-1 rounded-full flex items-center gap-1">
                    <span className="material-symbols-outlined text-[12px]">admin_panel_settings</span>
                    {log.actor?.full_name ?? shortId(log.actor_id) ?? "System"}
                  </span>
                  <span className="bg-surface-container-low text-on-surface-variant px-2.5 py-1 rounded-full">
                    {log.target_label ?? shortId(log.target_id) ?? log.target_type}
                  </span>
                  {log.target_id && (
                    <span className="bg-surface-container-low text-on-surface-variant px-2.5 py-1 rounded-full">
                      ID {shortId(log.target_id)}
                    </span>
                  )}
                </div>

                {log.reason && (
                  <div className="flex items-start gap-2 bg-surface-container-low border border-outline-variant/30 rounded-lg px-3 py-2">
                    <span className="material-symbols-outlined text-outline text-sm mt-0.5">notes</span>
                    <p className="text-xs text-on-surface-variant">{log.reason}</p>
                  </div>
                )}

                <div className="grid gap-3 lg:grid-cols-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-outline mb-1">Before</p>
                    <pre className="max-h-28 overflow-auto rounded-lg bg-surface-container-low border border-outline-variant/30 px-3 py-2 text-[11px] leading-relaxed text-on-surface-variant">
                      {jsonPreview(log.before_data)}
                    </pre>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-outline mb-1">After</p>
                    <pre className="max-h-28 overflow-auto rounded-lg bg-surface-container-low border border-outline-variant/30 px-3 py-2 text-[11px] leading-relaxed text-on-surface-variant">
                      {jsonPreview(log.after_data)}
                    </pre>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-outline mb-1">Metadata</p>
                    <pre className="max-h-28 overflow-auto rounded-lg bg-surface-container-low border border-outline-variant/30 px-3 py-2 text-[11px] leading-relaxed text-on-surface-variant">
                      {jsonPreview(log.metadata)}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
