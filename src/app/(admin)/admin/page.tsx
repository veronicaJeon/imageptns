"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils/cn";

type Status = "pending" | "approved" | "rejected" | "all";

const TABS: { key: Status; label: string; icon: string }[] = [
  { key: "pending",  label: "검토 대기",  icon: "pending_actions" },
  { key: "approved", label: "승인됨",    icon: "check_circle"    },
  { key: "rejected", label: "거절됨",    icon: "cancel"          },
  { key: "all",      label: "전체",      icon: "grid_view"       },
];

const STATUS_STYLES: Record<string, string> = {
  approved: "bg-primary/10 text-primary",
  pending:  "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-300",
  rejected: "bg-error/10 text-error",
  draft:    "bg-surface-container-high text-outline",
};

const STATUS_LABELS: Record<string, string> = {
  approved: "승인됨",
  pending:  "검토 대기",
  rejected: "거절됨",
  draft:    "임시저장",
};

const PROOF_STYLES: Record<string, string> = {
  pending: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-200",
  registered: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-200",
  failed: "bg-error/10 text-error",
};

const PROOF_LABELS: Record<string, string> = {
  pending: "Base proof: pending",
  registered: "Base proof: registered",
  failed: "Base proof: failed",
};

interface ImageRow {
  id: string;
  asset_id: string | null;
  title: string;
  description: string | null;
  category: string;
  tags: string[] | null;
  status: string;
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

export default function AdminPage() {
  const [tab, setTab] = useState<Status>("pending");
  const [images, setImages] = useState<ImageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  // Per-image reject UI state
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actioning, setActioning] = useState<string | null>(null);

  const fetchImages = useCallback(async (status: Status) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/images?status=${status}`);
      if (res.status === 403) { setForbidden(true); return; }
      const { images } = await res.json();
      setImages(images ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchImages(tab); }, [tab, fetchImages]);

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
    <div className="p-6 md:p-10">

      {/* Header */}
      <div className="mb-8">
        <h1 className="font-headline text-2xl font-extrabold text-on-surface tracking-tight">이미지 검토</h1>
        <p className="text-sm text-outline mt-1">
          {tab === "pending" && !loading && `${images.length}개 이미지가 검토 대기 중입니다`}
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
      ) : images.length === 0 ? (
        <div className="flex flex-col items-center py-32 gap-4 text-outline">
          <span className="material-symbols-outlined text-6xl">check_circle</span>
          <p className="text-base">
            {tab === "pending" ? "검토 대기 중인 이미지가 없습니다." : "이미지가 없습니다."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {images.map((img) => (
            <div key={img.id} className="bg-surface-container-lowest shadow-ghost rounded-xl overflow-hidden">
              <div className="flex gap-0 flex-col sm:flex-row">

                {/* Thumbnail */}
                <div className="w-full sm:w-48 h-36 sm:h-auto shrink-0 bg-surface-container-low flex items-center justify-center overflow-hidden">
                  {img.storage_path_preview ? (
                    <Image
                      src={img.storage_path_preview}
                      alt={img.title}
                      width={192}
                      height={144}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="material-symbols-outlined text-4xl text-outline">image</span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 p-5 flex flex-col gap-3 min-w-0">
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="font-headline font-bold text-base text-on-surface truncate">{img.title}</h2>
                        {img.asset_id && (
                          <span className="text-[10px] font-mono text-outline bg-surface-container-low px-2 py-0.5 rounded">{img.asset_id}</span>
                        )}
                      </div>
                      {img.description && (
                        <p className="text-xs text-on-surface-variant mt-0.5 line-clamp-2">{img.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                      {img.proof_status && img.proof_status !== "not_registered" && (
                        <span className={cn(
                          "text-[10px] font-bold px-3 py-1 rounded-full",
                          PROOF_STYLES[img.proof_status] ?? "bg-surface-container text-outline"
                        )}>
                          {PROOF_LABELS[img.proof_status] ?? `Base proof: ${img.proof_status}`}
                        </span>
                      )}
                      <span className={cn(
                        "text-[10px] font-bold px-3 py-1 rounded-full",
                        STATUS_STYLES[img.status] ?? "bg-surface-container text-outline"
                      )}>
                        {STATUS_LABELS[img.status] ?? img.status}
                      </span>
                    </div>
                  </div>

                  {/* Meta chips */}
                  <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wide">
                    <span className="bg-surface-container-low text-on-surface-variant px-2.5 py-1 rounded-full flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px]">category</span>
                      {img.category}
                    </span>
                    {img.file_format && (
                      <span className="bg-surface-container-low text-on-surface-variant px-2.5 py-1 rounded-full">{img.file_format}</span>
                    )}
                    {img.file_size_mb && (
                      <span className="bg-surface-container-low text-on-surface-variant px-2.5 py-1 rounded-full">{img.file_size_mb} MB</span>
                    )}
                    {img.resolution_mp && (
                      <span className="bg-surface-container-low text-on-surface-variant px-2.5 py-1 rounded-full">{img.resolution_mp} MP</span>
                    )}
                    {img.width && img.height && (
                      <span className="bg-surface-container-low text-on-surface-variant px-2.5 py-1 rounded-full">{img.width} × {img.height}</span>
                    )}
                  </div>

                  {/* Tags */}
                  {img.tags && img.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {img.tags.slice(0, 8).map((tag) => (
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
                        <p className="text-xs font-bold text-error">Base 증명 등록이 실패했습니다.</p>
                        <p className="text-xs text-on-surface-variant mt-1">
                          operator 지갑, RPC, 사진가 지갑 주소를 확인한 뒤 재시도하세요.
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
                      <label className="text-[10px] font-bold uppercase tracking-widest text-error">거절 사유 *</label>
                      <textarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        rows={2}
                        placeholder="예: 해상도 부족, 워터마크 포함, 저작권 문제 등"
                        className="bg-surface-container-lowest ring-1 ring-error/40 focus:ring-2 focus:ring-error rounded-lg px-3 py-2 text-sm text-on-surface placeholder:text-outline outline-none resize-none"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAction(img.id, "reject", rejectReason)}
                          disabled={!rejectReason.trim() || actioning === img.id}
                          className="flex items-center gap-1.5 px-4 py-2 bg-error text-white text-xs font-bold uppercase tracking-widest rounded hover:opacity-90 transition-opacity disabled:opacity-50"
                        >
                          {actioning === img.id
                            ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            : <span className="material-symbols-outlined text-sm">cancel</span>
                          }
                          거절 확정
                        </button>
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
                  {img.status !== "approved" && rejectingId !== img.id && (
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => handleAction(img.id, "approve")}
                        disabled={actioning === img.id || img.proof_status === "pending" || img.status !== "pending"}
                        className="flex items-center gap-1.5 px-5 py-2.5 bg-primary text-white text-xs font-bold uppercase tracking-widest rounded hover:opacity-90 transition-opacity disabled:opacity-50"
                      >
                        {actioning === img.id
                          ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          : <span className="material-symbols-outlined text-sm">{img.proof_status === "failed" ? "sync" : "check_circle"}</span>
                        }
                        {img.proof_status === "pending"
                          ? "Base 증명 등록 중"
                          : img.proof_status === "failed"
                            ? "Base 증명 재시도"
                            : "승인"}
                      </button>
                      {img.status !== "rejected" && (
                        <button
                          onClick={() => { setRejectingId(img.id); setRejectReason(""); }}
                          className="flex items-center gap-1.5 px-5 py-2.5 border border-error/40 text-error text-xs font-bold uppercase tracking-widest rounded hover:bg-error/5 transition-colors"
                        >
                          <span className="material-symbols-outlined text-sm">cancel</span>
                          거절
                        </button>
                      )}
                    </div>
                  )}
                  {img.status === "approved" && (
                    <button
                      onClick={() => { setRejectingId(img.id); setRejectReason(""); }}
                      className="flex items-center gap-1.5 w-fit px-5 py-2.5 border border-outline-variant text-on-surface-variant text-xs font-bold uppercase tracking-widest rounded hover:bg-surface-container-low transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">undo</span>
                      승인 취소 (거절로 변경)
                    </button>
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
