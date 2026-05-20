"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";

type RegistrationState =
  | "not_approved"
  | "waiting_first_sale"
  | "not_registered"
  | "available"
  | "requested"
  | "pending"
  | "registered"
  | "failed";

interface BlockchainImage {
  id: string;
  asset_id: string | null;
  title: string;
  category: string | null;
  sales_count: number | null;
  proof_status: string | null;
  proof_requested_at: string | null;
  proof_registered_at: string | null;
  proof_arweave_original_tx_id: string | null;
  proof_arweave_metadata_tx_id: string | null;
  proof_arweave_confirmed_at: string | null;
  proof_failure_reason: string | null;
  storage_path_preview: string | null;
  file_size_mb: number | null;
  created_at: string;
  registration_state: RegistrationState;
}

const STATE_LABELS: Record<RegistrationState, string> = {
  not_approved: "승인 전",
  waiting_first_sale: "첫 판매 대기",
  not_registered: "증명 전",
  available: "등록가능",
  requested: "요청됨",
  pending: "Arweave 등록 중",
  registered: "등록완료",
  failed: "실패",
};

const STATE_STYLES: Record<RegistrationState, string> = {
  not_approved: "bg-surface-container-high text-outline",
  waiting_first_sale: "bg-surface-container-high text-outline",
  not_registered: "bg-surface-container-high text-outline",
  available: "bg-primary/10 text-primary",
  requested: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-200",
  pending: "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-200",
  registered: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-200",
  failed: "bg-error/10 text-error",
};

function canSelect(image: BlockchainImage) {
  return image.registration_state === "available" || image.registration_state === "failed";
}

function arweaveUrl(txId: string) {
  return `https://arweave.net/${txId}`;
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function PhotographerBlockchainPage() {
  const [images, setImages] = useState<BlockchainImage[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchImages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/onchain/registration-requests");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "목록을 불러오지 못했습니다.");
      setImages(data.images ?? []);
      setSelected((prev) =>
        prev.filter((id) => (data.images ?? []).some((img: BlockchainImage) => img.id === id && canSelect(img))),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  const selectableIds = useMemo(() => images.filter(canSelect).map((image) => image.id), [images]);
  const selectedImages = images.filter((image) => selected.includes(image.id));
  const selectedTotalMb = selectedImages.reduce((sum, image) => sum + (Number(image.file_size_mb) || 0), 0);
  const allSelectableChecked = selectableIds.length > 0 && selectableIds.every((id) => selected.includes(id));

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  function toggleAll() {
    setSelected(allSelectableChecked ? [] : selectableIds);
  }

  async function submitRequest() {
    if (selected.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/onchain/registration-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageIds: selected }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "등록 요청에 실패했습니다.");
      await fetchImages();
      setSelected([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-6 md:p-10">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-headline text-2xl font-extrabold tracking-tight text-on-surface">블록체인 사진</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            첫 판매가 완료된 사진을 선택해 Arweave 원본 보관 및 자격증명 등록을 요청합니다.
          </p>
        </div>
        <Link
          href="/dashboard/uploads"
          className="inline-flex w-fit items-center gap-2 rounded border border-outline-variant px-4 py-2 text-xs font-bold uppercase tracking-widest text-on-surface-variant hover:bg-surface-container-low"
        >
          <span className="material-symbols-outlined text-base">cloud_upload</span>
          업로드 관리
        </Link>
      </div>

      <div className="mb-5 flex flex-col gap-3 bg-surface-container-lowest p-4 shadow-ghost md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-4 text-xs text-on-surface-variant">
          <span>선택 {selected.length}개</span>
          <span>예상 원본 용량 {selectedTotalMb.toLocaleString("ko-KR", { maximumFractionDigits: 2 })} MB</span>
          <span>요청 가능 {selectableIds.length}개</span>
        </div>
        <button
          onClick={submitRequest}
          disabled={selected.length === 0 || submitting}
          className="inline-flex items-center justify-center gap-2 rounded bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <span className="material-symbols-outlined text-base">verified</span>
          )}
          등록 요청
        </button>
      </div>

      {error && (
        <div className="mb-5 flex items-start gap-2 border border-error/20 bg-error/8 px-4 py-3 text-sm text-error">
          <span className="material-symbols-outlined text-base">error</span>
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : images.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-28 text-outline">
          <span className="material-symbols-outlined text-5xl">verified</span>
          <p className="text-sm">아직 블록체인 등록 대상 사진이 없습니다.</p>
        </div>
      ) : (
        <div className="overflow-x-auto bg-surface-container-lowest shadow-ghost">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant/20">
                <th className="px-5 py-4 text-left">
                  <input
                    type="checkbox"
                    checked={allSelectableChecked}
                    onChange={toggleAll}
                    disabled={selectableIds.length === 0}
                    aria-label="전체 선택"
                  />
                </th>
                <th className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-outline">사진</th>
                <th className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-outline">상태</th>
                <th className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-outline">판매</th>
                <th className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-outline">용량</th>
                <th className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-outline">TxID</th>
                <th className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-outline">일시</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {images.map((image) => {
                const selectable = canSelect(image);
                return (
                  <tr key={image.id} className="hover:bg-surface-container-low">
                    <td className="px-5 py-4">
                      <input
                        type="checkbox"
                        checked={selected.includes(image.id)}
                        onChange={() => toggle(image.id)}
                        disabled={!selectable}
                        aria-label={`${image.title} 선택`}
                      />
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded bg-surface-container-low">
                          {image.storage_path_preview ? (
                            <Image src={image.storage_path_preview} alt={image.title} width={64} height={48} className="h-full w-full object-cover" />
                          ) : (
                            <span className="material-symbols-outlined text-outline">image</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="max-w-[220px] truncate font-semibold text-on-surface">{image.title}</p>
                          <p className="mt-0.5 font-mono text-[11px] text-outline">{image.asset_id ?? "-"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-3 py-1 text-[10px] font-bold ${STATE_STYLES[image.registration_state]}`}>
                        {STATE_LABELS[image.registration_state]}
                      </span>
                      {image.proof_failure_reason && (
                        <p className="mt-1 max-w-[220px] text-[10px] text-error line-clamp-2">{image.proof_failure_reason}</p>
                      )}
                    </td>
                    <td className="px-5 py-4 text-on-surface-variant">{image.sales_count ?? 0}</td>
                    <td className="px-5 py-4 text-on-surface-variant">
                      {(image.file_size_mb ?? 0).toLocaleString("ko-KR", { maximumFractionDigits: 2 })} MB
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {image.proof_arweave_original_tx_id && (
                          <a href={arweaveUrl(image.proof_arweave_original_tx_id)} target="_blank" rel="noreferrer" className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary hover:opacity-70">
                            원본
                          </a>
                        )}
                        {image.proof_arweave_metadata_tx_id && (
                          <a href={arweaveUrl(image.proof_arweave_metadata_tx_id)} target="_blank" rel="noreferrer" className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary hover:opacity-70">
                            메타데이터
                          </a>
                        )}
                        {!image.proof_arweave_original_tx_id && !image.proof_arweave_metadata_tx_id && (
                          <span className="text-xs text-outline">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-xs text-on-surface-variant">
                      {image.proof_arweave_confirmed_at
                        ? formatDate(image.proof_arweave_confirmed_at)
                        : image.proof_requested_at
                          ? formatDate(image.proof_requested_at)
                          : formatDate(image.created_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
