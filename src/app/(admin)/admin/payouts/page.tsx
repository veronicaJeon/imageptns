"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils/cn";

type PayoutStatus = "pending" | "paid" | "rejected" | "all";

const TABS: { key: PayoutStatus; label: string; icon: string }[] = [
  { key: "pending",  label: "대기 중",  icon: "pending_actions" },
  { key: "paid",     label: "지급 완료", icon: "check_circle"    },
  { key: "rejected", label: "거절됨",   icon: "cancel"          },
  { key: "all",      label: "전체",     icon: "grid_view"       },
];

const STATUS_STYLES: Record<string, string> = {
  pending:  "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-300",
  paid:     "bg-primary/10 text-primary",
  rejected: "bg-error/10 text-error",
};

const STATUS_LABELS: Record<string, string> = {
  pending:  "대기 중",
  paid:     "지급 완료",
  rejected: "거절됨",
};

interface PayoutRow {
  id: string;
  period: string;
  total_gross_krw: number;
  total_commission: number;
  total_net_krw: number;
  status: string;
  payout_method: string | null;
  note: string | null;
  created_at: string;
  paid_at: string | null;
  photographer: { id: string; full_name: string; email: string } | null;
}

function formatKrw(amount: number) {
  return `₩${amount.toLocaleString("ko-KR")}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function AdminPayoutsPage() {
  const [tab, setTab] = useState<PayoutStatus>("pending");
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  const [actioning, setActioning] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const fetchPayouts = useCallback(async (status: PayoutStatus) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/payouts?status=${status}`);
      if (res.status === 403) { setForbidden(true); return; }
      const { payouts: rows } = await res.json();
      setPayouts(rows ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPayouts(tab); }, [tab, fetchPayouts]);

  async function handleAction(id: string, action: "approve" | "reject", note?: string) {
    setActioning(id);
    try {
      const res = await fetch("/api/admin/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payout_id: id, action, note }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        alert(error);
        return;
      }
      // Remove from current filtered tab (unless viewing all)
      if (tab !== "all") {
        setPayouts((prev) => prev.filter((p) => p.id !== id));
      } else {
        const { payout: updated } = await res.json();
        setPayouts((prev) =>
          prev.map((p) => (p.id === id ? { ...p, ...updated } : p))
        );
      }
      setRejectingId(null);
      setRejectNote("");
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

      {/* Header */}
      <div className="mb-8">
        <h1 className="font-headline text-2xl font-extrabold text-on-surface tracking-tight">정산 관리</h1>
        <p className="text-sm text-outline mt-1">
          {tab === "pending" && !loading && `${payouts.length}건의 정산 요청이 대기 중입니다`}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-surface-container-lowest p-1 rounded-xl w-fit shadow-ghost">
        {TABS.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200",
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

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <span className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : payouts.length === 0 ? (
        <div className="flex flex-col items-center py-32 gap-4 text-outline">
          <span className="material-symbols-outlined text-6xl">payments</span>
          <p className="text-base">
            {tab === "pending" ? "대기 중인 정산 요청이 없습니다." : "정산 내역이 없습니다."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {payouts.map((payout) => (
            <div
              key={payout.id}
              className="bg-surface-container-lowest shadow-ghost rounded-xl overflow-hidden"
            >
              <div className="p-5 flex flex-col gap-4">
                {/* Top row: name + status badge */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="material-symbols-outlined text-base text-on-surface-variant">person</span>
                      <h2 className="font-headline font-bold text-base text-on-surface truncate">
                        {payout.photographer?.full_name ?? "Unknown"}
                      </h2>
                      <span className="text-xs text-outline truncate">
                        {payout.photographer?.email ?? ""}
                      </span>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-bold px-3 py-1 rounded-full shrink-0",
                      STATUS_STYLES[payout.status] ?? "bg-surface-container text-outline"
                    )}
                  >
                    {STATUS_LABELS[payout.status] ?? payout.status}
                  </span>
                </div>

                {/* Detail chips */}
                <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wide">
                  <span className="bg-surface-container-low text-on-surface-variant px-2.5 py-1 rounded-full flex items-center gap-1">
                    <span className="material-symbols-outlined text-[12px]">calendar_month</span>
                    {payout.period}
                  </span>
                  <span className="bg-surface-container-low text-on-surface-variant px-2.5 py-1 rounded-full flex items-center gap-1">
                    <span className="material-symbols-outlined text-[12px]">payments</span>
                    신청금액 {formatKrw(payout.total_net_krw)}
                  </span>
                  <span className="bg-surface-container-low text-on-surface-variant px-2.5 py-1 rounded-full">
                    수익 {formatKrw(payout.total_gross_krw)} / 수수료 {formatKrw(payout.total_commission)}
                  </span>
                  {payout.payout_method && (
                    <span className="bg-surface-container-low text-on-surface-variant px-2.5 py-1 rounded-full">
                      {payout.payout_method === "bank_transfer" ? "계좌이체" : payout.payout_method}
                    </span>
                  )}
                </div>

                {/* Dates */}
                <div className="flex items-center gap-3 text-xs text-outline">
                  <span>신청일 {formatDate(payout.created_at)}</span>
                  {payout.paid_at && (
                    <>
                      <span>·</span>
                      <span>지급일 {formatDate(payout.paid_at)}</span>
                    </>
                  )}
                </div>

                {/* Note (if any) */}
                {payout.note && (
                  <div className="flex items-start gap-2 bg-surface-container-low border border-outline-variant/30 rounded-lg px-3 py-2">
                    <span className="material-symbols-outlined text-outline text-sm mt-0.5">notes</span>
                    <p className="text-xs text-on-surface-variant">{payout.note}</p>
                  </div>
                )}

                {/* Reject inline form */}
                {rejectingId === payout.id && (
                  <div className="flex flex-col gap-2 p-3 bg-error/5 border border-error/20 rounded-lg">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-error">거절 사유 (선택)</label>
                    <textarea
                      value={rejectNote}
                      onChange={(e) => setRejectNote(e.target.value)}
                      rows={2}
                      placeholder="예: 계좌 정보 미제출, 최소 금액 미달 등"
                      className="bg-surface-container-lowest ring-1 ring-error/40 focus:ring-2 focus:ring-error rounded-lg px-3 py-2 text-sm text-on-surface placeholder:text-outline outline-none resize-none"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAction(payout.id, "reject", rejectNote || undefined)}
                        disabled={actioning === payout.id}
                        className="flex items-center gap-1.5 px-4 py-2 bg-error text-white text-xs font-bold uppercase tracking-widest rounded hover:opacity-90 transition-opacity disabled:opacity-50"
                      >
                        {actioning === payout.id ? (
                          <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <span className="material-symbols-outlined text-sm">cancel</span>
                        )}
                        거절 확정
                      </button>
                      <button
                        onClick={() => { setRejectingId(null); setRejectNote(""); }}
                        className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-outline hover:text-on-surface transition-colors"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                )}

                {/* Action buttons — only for pending */}
                {payout.status === "pending" && rejectingId !== payout.id && (
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => handleAction(payout.id, "approve")}
                      disabled={actioning === payout.id}
                      className="flex items-center gap-1.5 px-5 py-2.5 bg-primary text-white text-xs font-bold uppercase tracking-widest rounded hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {actioning === payout.id ? (
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <span className="material-symbols-outlined text-sm">check_circle</span>
                      )}
                      승인 (지급 완료 처리)
                    </button>
                    <button
                      onClick={() => { setRejectingId(payout.id); setRejectNote(""); }}
                      className="flex items-center gap-1.5 px-5 py-2.5 border border-error/40 text-error text-xs font-bold uppercase tracking-widest rounded hover:bg-error/5 transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">cancel</span>
                      거절
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
