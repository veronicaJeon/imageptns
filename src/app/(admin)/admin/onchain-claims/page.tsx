"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils/cn";

type ReviewStatus = "pending" | "approved" | "rejected" | "reviewed" | "all";

const TABS: { key: ReviewStatus; label: string; icon: string }[] = [
  { key: "pending", label: "검토 대기", icon: "pending_actions" },
  { key: "approved", label: "승인됨", icon: "check_circle" },
  { key: "rejected", label: "반려됨", icon: "cancel" },
  { key: "reviewed", label: "확인됨", icon: "task_alt" },
  { key: "all", label: "전체", icon: "grid_view" },
];

const REVIEW_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-300",
  approved: "bg-primary/10 text-primary",
  rejected: "bg-error/10 text-error",
  reviewed: "bg-surface-container-high text-on-surface-variant",
  not_required: "bg-surface-container-high text-outline",
};

const REVIEW_LABELS: Record<string, string> = {
  pending: "검토 대기",
  approved: "승인됨",
  rejected: "반려됨",
  reviewed: "확인됨",
  not_required: "검토 불필요",
};

const CLAIM_LABELS: Record<string, string> = {
  claimable: "청구 가능",
  claimed: "청구 완료",
};

interface OnchainClaimRow {
  id: string;
  gross_krw: number;
  commission_krw: number;
  net_krw: number;
  period: string;
  created_at: string;
  claim_status: string;
  claim_tx_hash: string | null;
  claimable_amount: number | string | null;
  claim_review_status: string;
  claim_review_note: string | null;
  claim_reviewed_at: string | null;
  photographer: { id: string; full_name: string | null } | null;
  reviewer: { id: string; full_name: string | null } | null;
  order_item: {
    id: string;
    license_code: string;
    price_krw: number;
    order: { id: string; order_number: string | null; status: string; total_krw: number; completed_at: string | null; created_at: string } | null;
    image: { id: string; asset_id: string | null; title: string; storage_path_preview: string | null } | null;
  } | null;
}

function formatKrw(amount: number) {
  return `₩${amount.toLocaleString("ko-KR")}`;
}

function formatDate(iso: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatClaimAmount(amount: number | string | null) {
  if (amount === null || amount === undefined || amount === "") return "-";
  const value = Number(amount);
  if (!Number.isFinite(value)) return String(amount);
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 6 })} USDC`;
}

export default function AdminOnchainClaimsPage() {
  const [tab, setTab] = useState<ReviewStatus>("pending");
  const [claims, setClaims] = useState<OnchainClaimRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [actioning, setActioning] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const fetchClaims = useCallback(async (reviewStatus: ReviewStatus) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/onchain-claims?review_status=${reviewStatus}`);
      if (res.status === 403) {
        setForbidden(true);
        return;
      }
      const { claims: rows } = await res.json();
      setClaims(rows ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClaims(tab);
  }, [tab, fetchClaims]);

  async function handleReview(id: string, action: "approve" | "reject" | "mark_reviewed", reviewNote?: string) {
    setActioning(id);
    try {
      const res = await fetch("/api/admin/onchain-claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ledger_id: id, action, note: reviewNote }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        alert(error);
        return;
      }
      if (tab !== "all") {
        setClaims((prev) => prev.filter((claim) => claim.id !== id));
      } else {
        const { claim: updated } = await res.json();
        setClaims((prev) => prev.map((claim) => (claim.id === id ? { ...claim, ...updated } : claim)));
      }
      setEditingId(null);
      setNote("");
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
        <h1 className="font-headline text-2xl font-extrabold text-on-surface tracking-tight">온체인 클레임 검토</h1>
        <p className="text-sm text-outline mt-1">
          {tab === "pending" && !loading && `${claims.length}건의 온체인 클레임 항목이 검토 대기 중입니다`}
        </p>
      </div>

      <div className="flex gap-1 mb-6 bg-surface-container-lowest p-1 rounded-xl w-fit max-w-full overflow-x-auto shadow-ghost">
        {TABS.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 whitespace-nowrap",
              tab === key ? "bg-primary text-white shadow-sm" : "text-on-surface-variant hover:text-on-surface"
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
      ) : claims.length === 0 ? (
        <div className="flex flex-col items-center py-32 gap-4 text-outline">
          <span className="material-symbols-outlined text-6xl">verified</span>
          <p className="text-base">
            {tab === "pending" ? "검토 대기 중인 온체인 클레임이 없습니다." : "온체인 클레임 항목이 없습니다."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {claims.map((claim) => (
            <div key={claim.id} className="bg-surface-container-lowest shadow-ghost rounded-xl overflow-hidden">
              <div className="flex flex-col sm:flex-row">
                <div className="relative w-full sm:w-44 h-32 sm:h-auto shrink-0 bg-surface-container-low flex items-center justify-center overflow-hidden">
                  {claim.order_item?.image?.storage_path_preview ? (
                    <Image
                      src={claim.order_item.image.storage_path_preview}
                      alt={claim.order_item.image.title}
                      fill
                      sizes="(min-width: 640px) 176px, 100vw"
                      className="object-cover"
                    />
                  ) : (
                    <span className="material-symbols-outlined text-4xl text-outline">image</span>
                  )}
                </div>

                <div className="flex-1 p-5 flex flex-col gap-4 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="font-headline font-bold text-base text-on-surface truncate">
                          {claim.order_item?.image?.title ?? "Untitled image"}
                        </h2>
                        {claim.order_item?.image?.asset_id && (
                          <span className="text-[10px] font-mono text-outline bg-surface-container-low px-2 py-0.5 rounded">
                            {claim.order_item.image.asset_id}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-outline mt-1">
                        {claim.photographer?.full_name ?? "Unknown photographer"}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "text-[10px] font-bold px-3 py-1 rounded-full shrink-0",
                        REVIEW_STYLES[claim.claim_review_status] ?? "bg-surface-container text-outline"
                      )}
                    >
                      {REVIEW_LABELS[claim.claim_review_status] ?? claim.claim_review_status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
                    <div className="bg-surface-container-low rounded-lg px-3 py-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-outline">청구 상태</p>
                      <p className="font-semibold text-on-surface">{CLAIM_LABELS[claim.claim_status] ?? claim.claim_status}</p>
                    </div>
                    <div className="bg-surface-container-low rounded-lg px-3 py-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-outline">클레임 금액</p>
                      <p className="font-semibold text-on-surface">{formatClaimAmount(claim.claimable_amount)}</p>
                    </div>
                    <div className="bg-surface-container-low rounded-lg px-3 py-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-outline">원화 정산액</p>
                      <p className="font-semibold text-on-surface">{formatKrw(claim.net_krw)}</p>
                    </div>
                    <div className="bg-surface-container-low rounded-lg px-3 py-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-outline">기간</p>
                      <p className="font-semibold text-on-surface">{claim.period}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wide">
                    <span className="bg-surface-container-low text-on-surface-variant px-2.5 py-1 rounded-full">
                      주문 {claim.order_item?.order?.order_number ?? claim.order_item?.order?.id ?? "-"}
                    </span>
                    <span className="bg-surface-container-low text-on-surface-variant px-2.5 py-1 rounded-full">
                      라이선스 {claim.order_item?.license_code ?? "-"}
                    </span>
                    <span className="bg-surface-container-low text-on-surface-variant px-2.5 py-1 rounded-full">
                      판매가 {formatKrw(claim.order_item?.price_krw ?? claim.gross_krw)}
                    </span>
                    <span className="bg-surface-container-low text-on-surface-variant px-2.5 py-1 rounded-full">
                      수수료 {formatKrw(claim.commission_krw)}
                    </span>
                    <span className="bg-surface-container-low text-on-surface-variant px-2.5 py-1 rounded-full">
                      생성일 {formatDate(claim.created_at)}
                    </span>
                  </div>

                  {claim.claim_tx_hash && (
                    <div className="flex items-center gap-2 bg-surface-container-low border border-outline-variant/30 rounded-lg px-3 py-2 min-w-0">
                      <span className="material-symbols-outlined text-outline text-sm">receipt_long</span>
                      <p className="text-xs font-mono text-on-surface-variant truncate">{claim.claim_tx_hash}</p>
                    </div>
                  )}

                  {(claim.claim_review_note || claim.reviewer) && (
                    <div className="flex items-start gap-2 bg-surface-container-low border border-outline-variant/30 rounded-lg px-3 py-2">
                      <span className="material-symbols-outlined text-outline text-sm mt-0.5">fact_check</span>
                      <p className="text-xs text-on-surface-variant">
                        {claim.claim_review_note ?? "메모 없음"}
                        {claim.reviewer && (
                          <span className="text-outline">
                            {" "}
                            · {claim.reviewer.full_name ?? "관리자"} · {formatDate(claim.claim_reviewed_at)}
                          </span>
                        )}
                      </p>
                    </div>
                  )}

                  {editingId === claim.id && (
                    <div className="flex flex-col gap-2 p-3 bg-surface-container-low border border-outline-variant/40 rounded-lg">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-outline">검토 메모</label>
                      <textarea
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        rows={2}
                        placeholder="온체인 영수증, 금액, 주문 내역 확인 결과를 남겨주세요"
                        className="bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded-lg px-3 py-2 text-sm text-on-surface placeholder:text-outline outline-none resize-none"
                        autoFocus
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => handleReview(claim.id, "approve", note)}
                          disabled={actioning === claim.id}
                          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-bold uppercase tracking-widest rounded hover:opacity-90 transition-opacity disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-sm">check_circle</span>
                          승인
                        </button>
                        <button
                          onClick={() => handleReview(claim.id, "reject", note)}
                          disabled={actioning === claim.id}
                          className="flex items-center gap-1.5 px-4 py-2 bg-error text-white text-xs font-bold uppercase tracking-widest rounded hover:opacity-90 transition-opacity disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-sm">cancel</span>
                          반려
                        </button>
                        <button
                          onClick={() => handleReview(claim.id, "mark_reviewed", note)}
                          disabled={actioning === claim.id}
                          className="flex items-center gap-1.5 px-4 py-2 border border-outline-variant text-on-surface-variant text-xs font-bold uppercase tracking-widest rounded hover:bg-surface-container-high transition-colors disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-sm">task_alt</span>
                          확인 처리
                        </button>
                        <button
                          onClick={() => {
                            setEditingId(null);
                            setNote("");
                          }}
                          className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-outline hover:text-on-surface transition-colors"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  )}

                  {editingId !== claim.id && (
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => {
                          setEditingId(claim.id);
                          setNote(claim.claim_review_note ?? "");
                        }}
                        className="flex items-center gap-1.5 px-5 py-2.5 bg-primary text-white text-xs font-bold uppercase tracking-widest rounded hover:opacity-90 transition-opacity"
                      >
                        <span className="material-symbols-outlined text-sm">rate_review</span>
                        검토하기
                      </button>
                      <button
                        onClick={() => handleReview(claim.id, "mark_reviewed", claim.claim_review_note ?? undefined)}
                        disabled={actioning === claim.id}
                        className="flex items-center gap-1.5 px-5 py-2.5 border border-outline-variant text-on-surface-variant text-xs font-bold uppercase tracking-widest rounded hover:bg-surface-container-high transition-colors disabled:opacity-50"
                      >
                        {actioning === claim.id ? (
                          <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <span className="material-symbols-outlined text-sm">task_alt</span>
                        )}
                        확인 처리
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
