"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import {
  AdminButton,
  AdminChip,
  AdminInlineMetrics,
  adminStatusTone,
} from "@/components/admin/AdminPrimitives";
import { cn } from "@/lib/utils/cn";
import type { ProfileWithdrawalAssessment } from "@/lib/profiles/withdrawal";

type WithdrawalTab = "pending" | "approved" | "completed" | "rejected" | "cancelled" | "all";

interface ProfileRef {
  id: string;
  full_name: string | null;
  role?: string | null;
  avatar_url?: string | null;
  wallet_address?: string | null;
  phone_number?: string | null;
  primary_activity_regions?: string[] | null;
  deleted_at?: string | null;
}

interface WithdrawalRequest {
  id: string;
  requester_role: "admin" | "photographer" | string;
  status: string;
  impact_snapshot: ProfileWithdrawalAssessment | null;
  admin_note: string | null;
  decided_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string | null;
  requester: ProfileRef | ProfileRef[] | null;
  target: ProfileRef | ProfileRef[] | null;
  decider: ProfileRef | ProfileRef[] | null;
}

const TABS: { key: WithdrawalTab; label: string }[] = [
  { key: "pending", label: "대기" },
  { key: "approved", label: "승인" },
  { key: "completed", label: "완료" },
  { key: "rejected", label: "반려" },
  { key: "cancelled", label: "취소" },
  { key: "all", label: "전체" },
];

const STATUS_LABELS: Record<string, string> = {
  pending: "대기",
  approved: "승인",
  rejected: "반려",
  completed: "완료",
  cancelled: "취소",
};

const ACTION_LABELS: Record<string, string> = {
  retire_active_images: "활성 이미지 정리",
  preserve_sold_image_access: "구매자 접근 보존",
  review_onchain_records: "온체인 기록 검토",
  resolve_pending_orders: "대기 주문 처리",
  settle_pending_payouts: "대기 정산 완료",
  settle_claimable_earnings: "클레임 수익 정산",
};

function first<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" });
}

function formatMetric(value: number, isAmount = false) {
  if (isAmount) return value.toLocaleString("ko-KR", { maximumFractionDigits: 6 });
  return `${value.toLocaleString("ko-KR")}건`;
}

function metrics(assessment: ProfileWithdrawalAssessment | null) {
  const snapshot = assessment?.impactSnapshot;
  if (!snapshot) return [];
  return [
    ["활성 이미지", snapshot.activeImages],
    ["판매 이미지", snapshot.soldImages],
    ["온체인/Arweave", snapshot.onchainImages],
    ["대기 주문", snapshot.pendingOrders],
    ["대기 정산", snapshot.pendingPayouts],
    ["클레임 수익", snapshot.claimableEarnings],
    ["클레임 금액", snapshot.claimableAmount, true],
  ] as const;
}

export default function AdminProfileWithdrawalRequestsPage() {
  const [tab, setTab] = useState<WithdrawalTab>("pending");
  const [requests, setRequests] = useState<WithdrawalRequest[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/profile-withdrawal-requests?status=${tab}`);
      const body = await res.json().catch(() => null) as { requests?: WithdrawalRequest[]; error?: string } | null;
      if (!res.ok) throw new Error(body?.error ?? "탈퇴 검토 요청을 불러오지 못했습니다.");
      const rows = body?.requests ?? [];
      setRequests(rows);
      setNotes(Object.fromEntries(rows.map((request) => [request.id, request.admin_note ?? ""])));
    } catch (error) {
      alert(error instanceof Error ? error.message : "탈퇴 검토 요청을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  async function updateStatus(request: WithdrawalRequest, status: "approved" | "rejected" | "completed" | "cancelled") {
    setActioning(request.id);
    try {
      const res = await fetch("/api/admin/profile-withdrawal-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: request.id, status, admin_note: notes[request.id] ?? "" }),
      });
      const body = await res.json().catch(() => null) as { request?: WithdrawalRequest; error?: string } | null;
      if (!res.ok) throw new Error(body?.error ?? "상태를 저장하지 못했습니다.");
      await loadRequests();
    } catch (error) {
      alert(error instanceof Error ? error.message : "상태를 저장하지 못했습니다.");
    } finally {
      setActioning(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] p-4 md:p-8 lg:p-10">
      <div className="mb-8">
        <h1 className="font-headline text-2xl font-extrabold tracking-tight text-on-surface">탈퇴 검토</h1>
        <p className="mt-1 text-sm text-outline">사진가 탈퇴/회원삭제 요청의 권리, 구매자 접근, 온체인 기록, 정산 리스크를 확인합니다.</p>
      </div>

      <div className="mb-6 flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl bg-surface-container-lowest p-1 shadow-ghost">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "rounded-lg px-4 py-2 text-xs font-bold transition-all whitespace-nowrap",
              tab === key ? "bg-primary text-white shadow-sm" : "text-on-surface-variant hover:text-on-surface",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <span className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-28 text-outline">
          <span className="material-symbols-outlined text-6xl">task_alt</span>
          <p className="text-sm">표시할 탈퇴 검토 요청이 없습니다.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {requests.map((request) => {
            const target = first(request.target);
            const requester = first(request.requester);
            const decider = first(request.decider);
            const isBusy = actioning === request.id;

            return (
              <article key={request.id} className="rounded-lg border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-ghost">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-container-low">
                      {target?.avatar_url ? (
                        <Image src={target.avatar_url} alt="" width={44} height={44} className="h-full w-full object-cover" />
                      ) : (
                        <span className="material-symbols-outlined text-outline">person</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h2 className="truncate font-headline text-lg font-bold text-on-surface">
                        {target?.full_name ?? "대상 회원"}
                      </h2>
                      <p className="mt-0.5 truncate text-xs text-outline">
                        요청자 {requester?.full_name ?? request.requester_role} · 접수 {formatDate(request.created_at)}
                      </p>
                    </div>
                  </div>
                  <AdminChip tone={adminStatusTone(request.status)} className="shrink-0">
                    {STATUS_LABELS[request.status] ?? request.status}
                  </AdminChip>
                </div>

                <AdminInlineMetrics
                  className="mt-4"
                  items={metrics(request.impact_snapshot).map(([label, value, isAmount]) => ({
                    label,
                    value: formatMetric(value, Boolean(isAmount)),
                  }))}
                />

                {(request.impact_snapshot?.requiredActions?.length ?? 0) > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {request.impact_snapshot?.requiredActions.map((action) => (
                      <AdminChip key={action.code} tone="neutral">
                        {ACTION_LABELS[action.code] ?? action.label}
                      </AdminChip>
                    ))}
                  </div>
                )}

                <div className="mt-4 rounded-lg border border-outline-variant/30 p-3">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-outline">관리자 메모</label>
                  <textarea
                    value={notes[request.id] ?? ""}
                    onChange={(event) => setNotes((prev) => ({ ...prev, [request.id]: event.target.value }))}
                    rows={3}
                    placeholder="권리 보존, 구매자 고지, 정산 처리 내역을 남겨주세요."
                    className="mt-2 min-h-24 w-full resize-y rounded-lg bg-surface-container-lowest px-3 py-2 text-sm text-on-surface outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {request.status === "pending" && (
                    <>
                      <AdminButton
                        onClick={() => updateStatus(request, "approved")}
                        disabled={isBusy}
                        variant="primary"
                      >
                        승인
                      </AdminButton>
                      <AdminButton
                        onClick={() => updateStatus(request, "rejected")}
                        disabled={isBusy}
                        variant="danger"
                      >
                        반려
                      </AdminButton>
                    </>
                  )}
                  {request.status === "approved" && (
                    <AdminButton
                      onClick={() => updateStatus(request, "completed")}
                      disabled={isBusy}
                      variant="primary"
                    >
                      완료 처리
                    </AdminButton>
                  )}
                  {(request.status === "pending" || request.status === "approved") && (
                    <AdminButton
                      onClick={() => updateStatus(request, "cancelled")}
                      disabled={isBusy}
                      variant="secondary"
                    >
                      취소
                    </AdminButton>
                  )}
                  {decider?.full_name && (
                    <span className="ml-auto text-xs text-outline">결정자 {decider.full_name} · {formatDate(request.decided_at)}</span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
