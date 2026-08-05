"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { AdminButton, AdminChip, AdminInlineMetrics, adminStatusTone } from "@/components/admin/AdminPrimitives";
import { cn } from "@/lib/utils/cn";
import { imageCategoryLabel } from "@/lib/images/categories";
import { isImageLifecycleActive } from "@/lib/images/state-visibility";
import { IMAGE_REVIEW_STATUS_LABELS } from "@/lib/ux/terminology";

type Status = "pending" | "approved" | "rejected" | "all";

const TABS: { key: Status; label: string; icon: string }[] = [
  { key: "pending",  label: IMAGE_REVIEW_STATUS_LABELS.pending,  icon: "pending_actions" },
  { key: "approved", label: IMAGE_REVIEW_STATUS_LABELS.approved, icon: "check_circle"    },
  { key: "rejected", label: IMAGE_REVIEW_STATUS_LABELS.rejected, icon: "cancel"          },
  { key: "all",      label: IMAGE_REVIEW_STATUS_LABELS.all,      icon: "grid_view"       },
];

const STATUS_LABELS: Record<string, string> = {
  ...IMAGE_REVIEW_STATUS_LABELS,
};

const PROOF_LABELS: Record<string, string> = {
  available: "원본 증명 등록 가능",
  requested: "원본 증명 요청됨",
  pending: "Arweave 등록 중",
  registered: "원본 증명 완료",
  failed: "원본 증명 실패",
};

function proofTone(status: string | null | undefined) {
  if (status === "registered" || status === "available") return "success" as const;
  if (status === "requested" || status === "pending") return "warning" as const;
  if (status === "failed") return "danger" as const;
  return "neutral" as const;
}

interface ImageRow {
  id: string;
  asset_id: string | null;
  title: string;
  title_ko: string | null;
  title_en: string | null;
  description: string | null;
  description_ko: string | null;
  description_en: string | null;
  category: string;
  tags: string[] | null;
  tags_ko: string[] | null;
  tags_en: string[] | null;
  status: string;
  lifecycle_status: string | null;
  is_published: boolean;
  unpublished_reason: string | null;
  rejection_reason: string | null;
  storage_path_preview: string | null;
  file_format: string | null;
  file_size_mb: number | null;
  resolution_mp: number | null;
  width: number | null;
  height: number | null;
  created_at: string;
  chain_id: number | null;
  onchain_asset_id: string | null;
  content_hash: string | null;
  proof_tx_hash: string | null;
  proof_status: string | null;
  proof_registered_at: string | null;
  photographer: { id: string; full_name: string; avatar_url: string | null; wallet_address?: string | null } | null;
}

function displayKo(value: string | null | undefined, fallback: string | null | undefined = "") {
  return value?.trim() || fallback?.trim() || "-";
}

export default function AdminPage() {
  const [tab, setTab] = useState<Status>("pending");
  const [images, setImages] = useState<ImageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [forbidden, setForbidden] = useState(false);

  // Per-image reject UI state
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actioning, setActioning] = useState<string | null>(null);

  const fetchImages = useCallback(async (status: Status, silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await fetch(`/api/admin/images?status=${status}`, { cache: "no-store" });
      if (res.status === 403) { setForbidden(true); return; }
      const data = await res.json().catch(() => null) as {
        images?: ImageRow[];
        pagination?: { total?: number };
        error?: string;
      } | null;
      if (!res.ok) throw new Error(data?.error || "이미지 목록을 불러오지 못했습니다.");
      setImages(data?.images ?? []);
      setTotal(data?.pagination?.total ?? data?.images?.length ?? 0);
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "이미지 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchImages(tab);
    const refreshOnFocus = () => void fetchImages(tab, true);
    window.addEventListener("focus", refreshOnFocus);
    const intervalId = window.setInterval(() => void fetchImages(tab, true), 30_000);
    return () => {
      window.removeEventListener("focus", refreshOnFocus);
      window.clearInterval(intervalId);
    };
  }, [tab, fetchImages]);

  async function handleAction(id: string, action: "approve" | "reject", reason?: string) {
    setActioning(id);
    try {
      const res = await fetch(`/api/admin/images/${id}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, rejection_reason: reason }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        alert(error);
        return;
      }
      // Optimistic remove from current tab (unless viewing 'all')
      if (tab !== "all") setImages((prev) => prev.filter((img) => img.id !== id));
      else {
        const { image: updated } = await res.json();
        setImages((prev) => prev.map((img) => img.id === id ? { ...img, ...updated } : img));
      }
      setRejectingId(null);
      setRejectReason("");
    } finally {
      setActioning(null);
    }
  }

  if (forbidden) {
    return (
      <div className="p-10 flex flex-col items-center justify-center min-h-[60vh] gap-4 text-outline">
        <span className="material-symbols-outlined text-6xl text-error">lock</span>
        <h1 className="font-headline text-xl font-extrabold text-on-surface">접근 권한이 없습니다</h1>
        <p className="text-sm">관리자 계정이 아닙니다. Supabase에서 is_admin을 true로 설정해주세요.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] p-4 md:p-8 lg:p-10">

      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-headline text-2xl font-extrabold text-on-surface tracking-tight">이미지 검토</h1>
          <p className="text-sm text-outline mt-1">
            {tab === "pending" && !loading && `${total}개 이미지가 검토 대기 중입니다`}
          </p>
        </div>
        <AdminButton
          onClick={() => void fetchImages(tab, true)}
          disabled={refreshing}
          size="md"
        >
          <span className={`material-symbols-outlined text-base ${refreshing ? "animate-spin" : ""}`}>refresh</span>
          새로고침
        </AdminButton>
      </div>

      {loadError && (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-lg border border-error/20 bg-error/5 px-4 py-3 text-xs font-semibold text-error">
          <span>{loadError}</span>
          <button type="button" onClick={() => void fetchImages(tab, true)} className="shrink-0 underline">
            다시 시도
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 grid grid-cols-2 gap-1 rounded-lg bg-surface-container-lowest p-1 shadow-ghost sm:inline-grid sm:w-fit sm:grid-cols-4">
        {TABS.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] font-semibold transition-all duration-200 sm:gap-2 sm:px-4 sm:text-xs",
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
      ) : images.length === 0 ? (
        <div className="flex flex-col items-center py-32 gap-4 text-outline">
          <span className="material-symbols-outlined text-6xl">check_circle</span>
          <p className="text-base">
            {tab === "pending" ? "검토 대기 중인 이미지가 없습니다." : "이미지가 없습니다."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {images.map((img) => {
            const lifecycleActive = isImageLifecycleActive(img);
            return (
            <div key={img.id} className="overflow-hidden rounded-lg border border-outline-variant/30 bg-surface-container-lowest shadow-ghost">
              <div className="flex gap-0 flex-col xl:flex-row">

                {/* Thumbnail */}
                <div className="w-full xl:w-[48%] min-h-[320px] xl:min-h-[380px] shrink-0 bg-surface-container-low flex items-center justify-center overflow-hidden">
                  {img.storage_path_preview ? (
                    <Image
                      src={img.storage_path_preview}
                      alt={displayKo(img.title_ko, img.title)}
                      width={900}
                      height={700}
                      className="max-h-[72vh] h-full w-full object-contain"
                    />
                  ) : (
                    <span className="material-symbols-outlined text-4xl text-outline">image</span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 p-5 flex flex-col gap-3 min-w-0 xl:max-w-[52%]">
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="font-headline font-bold text-base text-on-surface truncate">{displayKo(img.title_ko, img.title)}</h2>
                        {img.asset_id && (
                          <span className="text-[10px] font-mono text-outline bg-surface-container-low px-2 py-0.5 rounded">{img.asset_id}</span>
                        )}
                      </div>
                      {displayKo(img.description_ko, img.description) !== "-" && (
                        <p className="text-xs text-on-surface-variant mt-0.5 line-clamp-2">{displayKo(img.description_ko, img.description)}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                      {img.proof_status && img.proof_status !== "not_registered" && (
                        <AdminChip tone={proofTone(img.proof_status)}>
                          {PROOF_LABELS[img.proof_status] ?? `증명: ${img.proof_status}`}
                        </AdminChip>
                      )}
                      <AdminChip tone={adminStatusTone(img.status)}>
                        {STATUS_LABELS[img.status] ?? img.status}
                      </AdminChip>
                      {!lifecycleActive && (
                        <AdminChip tone="danger">
                          {img.lifecycle_status === "deletion_requested" ? "삭제 요청됨" : img.lifecycle_status}
                        </AdminChip>
                      )}
                      {lifecycleActive && img.status === "approved" && !img.is_published && (
                        <AdminChip tone="warning">공개 중지</AdminChip>
                      )}
                    </div>
                  </div>

                  <AdminInlineMetrics
                    items={[
                      { label: "카테고리", value: imageCategoryLabel(img.category, "ko") },
                      ...(img.file_format ? [{ label: "포맷", value: img.file_format }] : []),
                      ...(img.file_size_mb ? [{ label: "용량", value: `${img.file_size_mb} MB` }] : []),
                      ...(img.resolution_mp ? [{ label: "해상도", value: `${img.resolution_mp} MP` }] : []),
                      ...(img.width && img.height ? [{ label: "크기", value: `${img.width} × ${img.height}` }] : []),
                    ]}
                  />

                  {/* Tags */}
                  {img.tags && img.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {(img.tags_ko?.length ? img.tags_ko : img.tags).slice(0, 8).map((tag) => (
                        <span key={tag} className="text-[10px] bg-primary/8 text-primary px-2 py-0.5 rounded-full">#{tag}</span>
                      ))}
                    </div>
                  )}

                  {/* Photographer + date */}
                  <div className="flex items-center gap-3 text-xs text-outline">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-primary-container flex items-center justify-center overflow-hidden shrink-0">
                        {img.photographer?.avatar_url ? (
                          <Image src={img.photographer.avatar_url} alt="" width={20} height={20} className="w-full h-full object-cover" />
                        ) : (
                          <span className="material-symbols-outlined text-[10px] text-on-primary-container">person</span>
                        )}
                      </div>
                      <span>{img.photographer?.full_name ?? "Unknown"}</span>
                    </div>
                    <span>·</span>
                    <span>{new Date(img.created_at).toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" })}</span>
                  </div>

                  {/* Rejection reason (read-only display) */}
                  {img.status === "rejected" && img.rejection_reason && (
                    <div className="flex items-start gap-2 bg-error/8 border border-error/20 rounded-lg px-3 py-2">
                      <span className="material-symbols-outlined text-error text-sm mt-0.5">cancel</span>
                      <p className="text-xs text-error">{img.rejection_reason}</p>
                    </div>
                  )}

                  {img.status === "pending" && img.proof_status === "failed" && (
                    <div className="flex items-start gap-2 bg-error/8 border border-error/20 rounded-lg px-3 py-2">
                      <span className="material-symbols-outlined text-error text-sm mt-0.5">sync_problem</span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-error">이전 원본 증명 등록이 실패했습니다.</p>
                        <p className="text-xs text-on-surface-variant mt-1">
                          승인 후 첫 사용권 판매가 완료되면 사진작가가 블록체인 이미지 화면에서 재등록을 요청할 수 있습니다.
                        </p>
                        {img.proof_tx_hash && (
                          <p className="text-[10px] font-mono text-outline mt-1 truncate">tx {img.proof_tx_hash}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Reject inline form */}
                  {rejectingId === img.id && (
                    <div className="flex flex-col gap-2 p-3 bg-error/5 border border-error/20 rounded-lg">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-error">반려 사유 *</label>
                      <textarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        rows={2}
                        placeholder="예: 해상도 부족, 워터마크 포함, 저작권 문제 등"
                        className="bg-surface-container-lowest ring-1 ring-error/40 focus:ring-2 focus:ring-error rounded-lg px-3 py-2 text-sm text-on-surface placeholder:text-outline outline-none resize-none"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <AdminButton
                          onClick={() => handleAction(img.id, "reject", rejectReason)}
                          disabled={!rejectReason.trim() || actioning === img.id}
                          variant="danger"
                          size="md"
                        >
                          {actioning === img.id
                            ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            : <span className="material-symbols-outlined text-sm">cancel</span>
                          }
                          반려 확정
                        </AdminButton>
                        <button
                          onClick={() => { setRejectingId(null); setRejectReason(""); }}
                          className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-outline hover:text-on-surface transition-colors"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  {lifecycleActive && img.status !== "approved" && rejectingId !== img.id && (
                    <div className="flex gap-2 flex-wrap">
                      <AdminButton
                        onClick={() => handleAction(img.id, "approve")}
                        disabled={actioning === img.id || img.status !== "pending"}
                        variant="primary"
                        size="md"
                      >
                        {actioning === img.id
                          ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          : <span className="material-symbols-outlined text-sm">check_circle</span>
                        }
                        승인
                      </AdminButton>
                      {img.status !== "rejected" && (
                        <AdminButton
                          onClick={() => { setRejectingId(img.id); setRejectReason(""); }}
                          variant="danger"
                          size="md"
                        >
                          <span className="material-symbols-outlined text-sm">cancel</span>
                          반려
                        </AdminButton>
                      )}
                    </div>
                  )}
                  {lifecycleActive && img.status === "approved" && (
                    <AdminButton
                      onClick={() => { setRejectingId(img.id); setRejectReason(""); }}
                      className="w-fit"
                      size="md"
                    >
                      <span className="material-symbols-outlined text-sm">undo</span>
                      승인 취소 (반려로 변경)
                    </AdminButton>
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
