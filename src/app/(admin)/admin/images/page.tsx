"use client";

import Image from "next/image";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

type ImageStatus = "all" | "pending" | "approved" | "rejected" | "draft";

interface AdminImage {
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
  is_published: boolean;
  unpublished_at: string | null;
  unpublished_reason: string | null;
  lifecycle_status: string | null;
  deletion_fee_krw: number | null;
  deletion_fee_status: string | null;
  storage_path_preview: string | null;
  storage_path_original: string | null;
  file_format: string | null;
  file_size_mb: number | null;
  width: number | null;
  height: number | null;
  sales_count: number | null;
  views_count: number | null;
  created_at: string;
  photographer: { id: string; full_name: string | null; avatar_url: string | null } | null;
}

interface ImageEditState {
  id: string;
  title: string;
  titleKo: string;
  titleEn: string;
  description: string;
  descriptionKo: string;
  descriptionEn: string;
  category: string;
  tags: string;
  tagsKo: string;
  tagsEn: string;
  is_published: boolean;
  priceOverrides: Record<string, string>;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface DownloadFile {
  id: string;
  fileName?: string;
  url?: string;
  error?: string;
}

interface ImageTransactionResponse {
  image: {
    title?: string;
    assetId: string | null;
    ledgerKey: string | null;
    arweave: { originalTxId: string | null; metadataTxId: string | null; manifestTxId: string | null };
  };
  transactions: Array<{
    orderNumber: string;
    completedAt: string | null;
    buyer: { name: string | null; email: string | null; walletAddress: string | null };
    licenseCode: string;
    priceKrw: number;
    netKrw: number;
    subscriptionCovered: boolean;
    paymentProvider: string | null;
    paymentTxHash: string | null;
    contractOrderId: string | null;
  }>;
}

const PAGE_SIZE = 50;
const LICENSE_CODES = ["editorial", "commercial", "extended"] as const;

const STATUS_LABELS: Record<string, string> = {
  all: "전체",
  pending: "검토 대기",
  approved: "승인됨",
  rejected: "거절됨",
  draft: "임시저장",
};

const STATUS_CLASSES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-200",
  approved: "bg-primary/10 text-primary",
  rejected: "bg-error/10 text-error",
  draft: "bg-surface-container-high text-outline",
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("ko-KR", { year: "2-digit", month: "2-digit", day: "2-digit" });
}

function formatSize(value: number | null) {
  if (!value) return "-";
  return `${Number(value).toLocaleString("ko-KR")} MB`;
}

function displayKo(value: string | null | undefined, fallback: string | null | undefined = "") {
  return value?.trim() || fallback?.trim() || "-";
}

export default function AdminImagesPage() {
  const [images, setImages] = useState<AdminImage[]>([]);
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ImageStatus>("all");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 1 });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [transactionLoadingId, setTransactionLoadingId] = useState<string | null>(null);
  const [transactionModal, setTransactionModal] = useState<ImageTransactionResponse | null>(null);
  const [editLoadingId, setEditLoadingId] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editState, setEditState] = useState<ImageEditState | null>(null);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allPageSelected = images.length > 0 && images.every((image) => selectedSet.has(image.id));

  const loadImages = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        status,
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (query) params.set("query", query);

      const res = await fetch(`/api/admin/images?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error ?? "이미지 목록을 불러오지 못했습니다.");
      }

      const data = await res.json() as { images?: AdminImage[]; pagination?: Pagination };
      setImages(data.images ?? []);
      setPagination(data.pagination ?? { page, pageSize: PAGE_SIZE, total: 0, totalPages: 1 });
      setSelectedIds([]);
    } catch (error) {
      alert(error instanceof Error ? error.message : "이미지 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [page, query, status]);

  useEffect(() => { loadImages(); }, [loadImages]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setQuery(queryInput.trim());
  }

  function toggleAllPage() {
    setSelectedIds((current) => {
      if (allPageSelected) return current.filter((id) => !images.some((image) => image.id === id));
      return Array.from(new Set([...current, ...images.map((image) => image.id)]));
    });
  }

  function toggleOne(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  async function downloadSelected() {
    if (selectedIds.length === 0) return;
    setDownloading(true);
    try {
      const res = await fetch("/api/admin/images/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageIds: selectedIds }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error ?? "다운로드 URL을 생성하지 못했습니다.");
      }

      const data = await res.json() as { files?: DownloadFile[] };
      const files = data.files ?? [];
      const downloadable = files.filter((file) => file.url);
      const failed = files.filter((file) => file.error);

      downloadable.forEach((file, index) => {
        window.setTimeout(() => {
          const anchor = document.createElement("a");
          anchor.href = file.url!;
          anchor.download = file.fileName ?? "";
          anchor.rel = "noreferrer";
          document.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
        }, index * 250);
      });

      if (failed.length > 0) {
        alert(`${failed.length}개 이미지는 원본 다운로드 URL을 만들지 못했습니다.`);
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "다운로드 처리 중 오류가 발생했습니다.");
    } finally {
      setDownloading(false);
    }
  }

  async function deleteSelected() {
    if (selectedIds.length === 0) return;
    const reason = prompt("삭제/아카이브 사유를 입력하세요.", "관리자 이미지 정리");
    if (reason === null) return;
    if (!confirm(`${selectedIds.length}개 이미지를 삭제 정책에 따라 완전삭제 또는 아카이브 처리할까요?`)) return;

    setDeleting(true);
    try {
      const res = await fetch("/api/admin/images/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageIds: selectedIds, reason }),
      });
      const data = await res.json().catch(() => null) as { results?: { action: string; errors?: string[] }[]; error?: string } | null;
      if (!res.ok) throw new Error(data?.error ?? "삭제 처리에 실패했습니다.");
      const results = data?.results ?? [];
      const purged = results.filter((result) => result.action === "purge").length;
      const archived = results.filter((result) => result.action === "archive").length;
      const failed = results.filter((result) => (result.errors ?? []).length > 0).length;
      alert(`처리 완료: 완전삭제 ${purged}개, 아카이브 ${archived}개${failed ? `, 경고 ${failed}개` : ""}`);
      await loadImages();
    } catch (error) {
      alert(error instanceof Error ? error.message : "삭제 처리 중 오류가 발생했습니다.");
    } finally {
      setDeleting(false);
    }
  }

  async function openTransactions(image: AdminImage) {
    setTransactionLoadingId(image.id);
    try {
      const res = await fetch(`/api/images/${image.id}/transactions`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "거래내역을 불러오지 못했습니다.");
      setTransactionModal({
        ...(data as ImageTransactionResponse),
        image: { ...(data as ImageTransactionResponse).image, title: image.title },
      });
    } catch (error) {
      alert(error instanceof Error ? error.message : "거래내역을 불러오지 못했습니다.");
    } finally {
      setTransactionLoadingId(null);
    }
  }

  async function togglePublished(image: AdminImage) {
    const next = !image.is_published;
    const reason = next ? null : prompt("게시 OFF 사유를 입력하세요.", "관리자 공개 중지");
    if (!next && reason === null) return;

    try {
      const res = await fetch(`/api/admin/images/${image.id}/publish`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_published: next, reason }),
      });
      const body = await res.json().catch(() => null) as { image?: Partial<AdminImage>; error?: string } | null;
      if (!res.ok) throw new Error(body?.error ?? "게시 상태를 변경하지 못했습니다.");
      setImages((prev) => prev.map((row) => row.id === image.id ? { ...row, ...body?.image } : row));
    } catch (error) {
      alert(error instanceof Error ? error.message : "게시 상태를 변경하지 못했습니다.");
    }
  }

  async function openEdit(image: AdminImage) {
    setEditLoadingId(image.id);
    try {
      const res = await fetch(`/api/admin/images/${image.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "이미지 정보를 불러오지 못했습니다.");
      const detail = data.image as AdminImage & { price_overrides?: { license_code: string; price_krw: number }[] };
      setEditState({
        id: image.id,
        title: detail.title ?? "",
        titleKo: detail.title_ko ?? detail.title ?? "",
        titleEn: detail.title_en ?? detail.title ?? "",
        description: detail.description ?? "",
        descriptionKo: detail.description_ko ?? detail.description ?? "",
        descriptionEn: detail.description_en ?? detail.description ?? "",
        category: detail.category ?? "",
        tags: (detail.tags ?? []).join(", "),
        tagsKo: (detail.tags_ko ?? detail.tags ?? []).join(", "),
        tagsEn: (detail.tags_en ?? detail.tags ?? []).join(", "),
        is_published: Boolean(detail.is_published),
        priceOverrides: Object.fromEntries((detail.price_overrides ?? []).map((row) => [row.license_code, String(row.price_krw)])),
      });
    } catch (error) {
      alert(error instanceof Error ? error.message : "이미지 정보를 불러오지 못했습니다.");
    } finally {
      setEditLoadingId(null);
    }
  }

  function updateEdit<K extends keyof ImageEditState>(key: K, value: ImageEditState[K]) {
    setEditState((current) => current ? { ...current, [key]: value } : current);
  }

  function updateEditPrice(licenseCode: string, value: string) {
    setEditState((current) => current
      ? { ...current, priceOverrides: { ...current.priceOverrides, [licenseCode]: value } }
      : current);
  }

  async function saveEdit() {
    if (!editState) return;
    setEditSaving(true);
    try {
      const priceOverrides = Object.fromEntries(
        Object.entries(editState.priceOverrides)
          .filter(([, value]) => value.trim() !== "")
          .map(([licenseCode, value]) => [licenseCode, Number(value)]),
      );
      const res = await fetch(`/api/admin/images/${editState.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editState.title,
          title_ko: editState.titleKo,
          title_en: editState.titleEn,
          description: editState.description,
          description_ko: editState.descriptionKo,
          description_en: editState.descriptionEn,
          category: editState.category,
          tags: editState.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
          tags_ko: editState.tagsKo.split(",").map((tag) => tag.trim()).filter(Boolean),
          tags_en: editState.tagsEn.split(",").map((tag) => tag.trim()).filter(Boolean),
          is_published: editState.is_published,
          priceOverrides,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "이미지 정보를 저장하지 못했습니다.");
      setEditState(null);
      await loadImages();
    } catch (error) {
      alert(error instanceof Error ? error.message : "이미지 정보를 저장하지 못했습니다.");
    } finally {
      setEditSaving(false);
    }
  }

  return (
    <div className="p-6 md:p-10">
      <div className="mb-8 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="font-headline text-2xl font-extrabold tracking-tight text-on-surface">이미지 관리</h1>
          <p className="mt-1 text-sm text-outline">이미지 목록을 검색하고 선택한 원본 파일을 관리자 권한으로 다운로드합니다.</p>
        </div>

        <form onSubmit={submitSearch} className="flex flex-col gap-2 lg:flex-row">
          <div className="relative">
            <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-outline">search</span>
            <input
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value)}
              placeholder="제목, 키워드, 에셋ID 검색"
              className="h-11 w-full rounded-lg bg-surface-container-lowest pl-10 pr-4 text-sm outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary lg:w-80"
            />
          </div>
          <select
            value={status}
            onChange={(event) => { setStatus(event.target.value as ImageStatus); setPage(1); }}
            className="h-11 rounded-lg bg-surface-container-lowest px-4 text-sm outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
          >
            {(["all", "pending", "approved", "rejected", "draft"] as ImageStatus[]).map((value) => (
              <option key={value} value={value}>{STATUS_LABELS[value]}</option>
            ))}
          </select>
          <button className="h-11 rounded-lg bg-primary px-5 text-xs font-bold uppercase tracking-widest text-white">검색</button>
        </form>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-outline">
          총 <span className="font-semibold text-on-surface">{pagination.total.toLocaleString("ko-KR")}</span>개
          {query && <span> · 검색어 <span className="font-semibold text-on-surface">{query}</span></span>}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={deleteSelected}
            disabled={selectedIds.length === 0 || deleting}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-error px-4 text-xs font-bold uppercase tracking-widest text-on-error transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-base">delete</span>
            {deleting ? "처리 중..." : `선택 삭제/아카이브 (${selectedIds.length})`}
          </button>
          <button
            onClick={downloadSelected}
            disabled={selectedIds.length === 0 || downloading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-on-surface px-4 text-xs font-bold uppercase tracking-widest text-surface-container-lowest transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-base">download</span>
            {downloading ? "준비 중..." : `선택 원본 다운로드 (${selectedIds.length})`}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl bg-surface-container-lowest shadow-ghost">
        <table className="w-full min-w-[920px] text-sm">
          <thead>
            <tr className="border-b border-outline-variant/20">
              <th className="w-12 px-5 py-4 text-left">
                <input type="checkbox" checked={allPageSelected} onChange={toggleAllPage} aria-label="현재 페이지 전체 선택" />
              </th>
              {["이미지 정보", "상태", "성과", "등록 정보"].map((head) => (
                <th key={head} className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-outline">{head}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/20">
            {loading ? (
              <tr><td colSpan={5} className="px-5 py-20 text-center text-outline">이미지 목록을 불러오는 중...</td></tr>
            ) : images.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-20 text-center text-outline">조건에 맞는 이미지가 없습니다.</td></tr>
            ) : images.map((image) => (
              <tr key={image.id} className="hover:bg-surface-container-low">
                <td className="px-5 py-5 align-top">
                  <input
                    type="checkbox"
                    checked={selectedSet.has(image.id)}
                    onChange={() => toggleOne(image.id)}
                    aria-label={`${image.title} 선택`}
                  />
                </td>
                <td className="px-5 py-5 align-top">
                  <div className="flex items-start gap-4">
                    <div className="relative flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-container-low">
                      {image.storage_path_preview ? (
                        <Image src={image.storage_path_preview} alt="" fill sizes="112px" className="object-contain" />
                      ) : (
                        <span className="material-symbols-outlined absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-outline">image</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="max-w-[360px] truncate font-semibold text-on-surface">{displayKo(image.title_ko, image.title)}</p>
                      {displayKo(image.title_en, "") !== "-" && (
                        <p className="mt-0.5 max-w-[360px] truncate text-xs text-outline">{image.title_en}</p>
                      )}
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-outline">
                        <span>{image.category}</span>
                        <span className="font-mono">{image.asset_id ?? "-"}</span>
                      </div>
                      <div className="mt-3 flex max-w-[420px] flex-wrap gap-1">
                        {(image.tags_ko?.length ? image.tags_ko : image.tags ?? []).slice(0, 5).map((tag) => (
                          <span key={tag} className="rounded-full bg-primary/8 px-2 py-0.5 text-[10px] font-semibold text-primary">#{tag}</span>
                        ))}
                        {((image.tags_ko?.length ? image.tags_ko : image.tags)?.length ?? 0) > 5 && (
                          <span className="text-[10px] text-outline">+{((image.tags_ko?.length ? image.tags_ko : image.tags)?.length ?? 0) - 5}</span>
                        )}
                      </div>
                      <p className="mt-3 text-xs text-on-surface-variant">
                        {image.width && image.height ? `${image.width} x ${image.height}` : "크기 미기록"}
                        <span className="mx-1 text-outline">·</span>
                        {image.file_format ?? "포맷 미기록"}
                        <span className="mx-1 text-outline">·</span>
                        {formatSize(image.file_size_mb)}
                      </p>
                      <button
                        type="button"
                        onClick={() => openEdit(image)}
                        disabled={editLoadingId === image.id}
                        className="mt-3 inline-flex items-center gap-1 rounded border border-outline-variant px-2 py-1 text-[10px] font-bold text-on-surface-variant hover:border-primary hover:text-primary disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-sm">edit</span>
                        {editLoadingId === image.id ? "로딩" : "상세 편집"}
                      </button>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-5 align-top">
                  <div className="flex w-32 flex-col items-start gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${STATUS_CLASSES[image.status] ?? "bg-surface-container-high text-outline"}`}>
                      {STATUS_LABELS[image.status] ?? image.status}
                    </span>
                    {image.lifecycle_status && image.lifecycle_status !== "active" && (
                      <span className="rounded-full bg-error/10 px-2.5 py-1 text-[10px] font-bold text-error">
                        {image.lifecycle_status === "deletion_requested" ? "삭제요청" : image.lifecycle_status}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => togglePublished(image)}
                      className={`inline-flex h-8 items-center rounded-full px-3 text-[10px] font-bold ${
                        image.is_published ? "bg-primary/10 text-primary" : "bg-error/10 text-error"
                      }`}
                      title={image.unpublished_reason ?? undefined}
                    >
                      {image.is_published ? "게시 ON" : "게시 OFF"}
                    </button>
                  </div>
                </td>
                <td className="px-5 py-5 align-top text-xs text-on-surface-variant">
                  <div className="grid w-32 grid-cols-2 gap-2">
                    <div className="rounded-lg bg-surface-container-low p-2">
                      <p className="text-[10px] text-outline">조회</p>
                      <p className="font-semibold text-on-surface">{(image.views_count ?? 0).toLocaleString("ko-KR")}</p>
                    </div>
                    <div className="rounded-lg bg-surface-container-low p-2">
                      <p className="text-[10px] text-outline">판매</p>
                      <p className="font-semibold text-on-surface">{(image.sales_count ?? 0).toLocaleString("ko-KR")}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openTransactions(image)}
                    disabled={transactionLoadingId === image.id}
                    className="mt-2 inline-flex items-center gap-1 rounded border border-outline-variant px-2 py-1 text-[10px] font-bold text-on-surface-variant hover:border-primary hover:text-primary disabled:opacity-50"
                  >
                    {transactionLoadingId === image.id ? "로딩" : "거래내역"}
                  </button>
                </td>
                <td className="px-5 py-5 align-top text-xs text-on-surface-variant">
                  <p className="max-w-40 truncate font-medium text-on-surface">{image.photographer?.full_name ?? "-"}</p>
                  <p className="mt-1 text-outline">{formatDate(image.created_at)}</p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-outline">
          페이지 {pagination.page.toLocaleString("ko-KR")} / {pagination.totalPages.toLocaleString("ko-KR")} · 한 페이지 {PAGE_SIZE}개
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            disabled={page <= 1 || loading}
            className="h-10 rounded-lg border border-outline-variant px-4 text-xs font-bold text-on-surface disabled:opacity-40"
          >
            이전
          </button>
          <button
            onClick={() => setPage((value) => Math.min(pagination.totalPages, value + 1))}
            disabled={page >= pagination.totalPages || loading}
            className="h-10 rounded-lg border border-outline-variant px-4 text-xs font-bold text-on-surface disabled:opacity-40"
          >
            다음
          </button>
        </div>
      </div>

      {transactionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[86vh] w-full max-w-5xl overflow-hidden rounded-xl bg-surface-container-lowest shadow-ghost">
            <div className="flex items-start justify-between gap-4 border-b border-outline-variant/20 p-5">
              <div className="min-w-0">
                <h2 className="font-headline text-lg font-extrabold text-on-surface">이미지 거래 데이터</h2>
                <p className="mt-1 truncate text-xs text-outline">{transactionModal.image.title ?? transactionModal.image.assetId ?? "-"}</p>
                <p className="mt-2 break-all font-mono text-[10px] text-outline">장부 키 {transactionModal.image.ledgerKey ?? "-"}</p>
              </div>
              <button
                type="button"
                onClick={() => setTransactionModal(null)}
                className="rounded-lg p-2 text-outline hover:bg-surface-container-low hover:text-on-surface"
                aria-label="닫기"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="max-h-[64vh] overflow-auto p-5">
              <div className="mb-4 grid gap-2 text-[11px] text-on-surface-variant md:grid-cols-3">
                <p className="rounded-lg bg-surface-container-low p-3 break-all">Arweave 원본 {transactionModal.image.arweave.originalTxId ?? "-"}</p>
                <p className="rounded-lg bg-surface-container-low p-3 break-all">Arweave 메타 {transactionModal.image.arweave.metadataTxId ?? "-"}</p>
                <p className="rounded-lg bg-surface-container-low p-3 break-all">Manifest {transactionModal.image.arweave.manifestTxId ?? "-"}</p>
              </div>
              <table className="w-full min-w-[860px] text-xs">
                <thead>
                  <tr className="border-b border-outline-variant/20 text-outline">
                    {["일시", "주문", "구매자", "라이선스", "결제", "작가수익", "온체인"].map((head) => (
                      <th key={head} className="px-3 py-2 text-left font-bold">{head}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
                  {transactionModal.transactions.length === 0 ? (
                    <tr><td colSpan={7} className="px-3 py-10 text-center text-outline">완료된 거래가 없습니다.</td></tr>
                  ) : transactionModal.transactions.map((tx) => (
                    <tr key={tx.orderNumber}>
                      <td className="px-3 py-2 text-on-surface-variant">{tx.completedAt ? new Date(tx.completedAt).toLocaleString("ko-KR") : "-"}</td>
                      <td className="px-3 py-2 font-mono text-on-surface">{tx.orderNumber}</td>
                      <td className="px-3 py-2 text-on-surface-variant">
                        <p>{tx.buyer.name ?? "-"}</p>
                        <p className="text-[10px] text-outline">{tx.buyer.email ?? tx.buyer.walletAddress ?? "-"}</p>
                      </td>
                      <td className="px-3 py-2 text-on-surface-variant">
                        {tx.licenseCode}
                        {tx.subscriptionCovered && <span className="ml-1 text-primary">구독</span>}
                      </td>
                      <td className="px-3 py-2 font-semibold text-on-surface">₩{tx.priceKrw.toLocaleString("ko-KR")}</td>
                      <td className="px-3 py-2 font-semibold text-on-surface">₩{tx.netKrw.toLocaleString("ko-KR")}</td>
                      <td className="px-3 py-2 font-mono text-[10px] text-outline">
                        <p className="max-w-[220px] truncate">{tx.contractOrderId ?? "-"}</p>
                        <p className="max-w-[220px] truncate">{tx.paymentTxHash ?? tx.paymentProvider ?? "-"}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {editState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[88vh] w-full max-w-2xl overflow-hidden rounded-xl bg-surface-container-lowest shadow-ghost">
            <div className="flex items-center justify-between border-b border-outline-variant/20 p-5">
              <div>
                <h2 className="font-headline text-lg font-extrabold text-on-surface">이미지 상세 편집</h2>
                <p className="mt-1 text-xs text-outline">설명, 게시여부, 이미지별 가격을 조정합니다.</p>
              </div>
              <button
                type="button"
                onClick={() => setEditState(null)}
                className="rounded-lg p-2 text-outline hover:bg-surface-container-low hover:text-on-surface"
                aria-label="닫기"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="max-h-[68vh] overflow-y-auto p-5">
              <div className="grid gap-4">
                <label className="grid gap-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-outline">제목</span>
                  <input
                    value={editState.title}
                    onChange={(event) => updateEdit("title", event.target.value)}
                    className="h-11 rounded-lg bg-surface-container-lowest px-4 text-sm text-on-surface outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
                  />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-xs font-bold uppercase tracking-widest text-outline">한글 제목</span>
                    <input
                      value={editState.titleKo}
                      onChange={(event) => updateEdit("titleKo", event.target.value)}
                      className="h-11 rounded-lg bg-surface-container-lowest px-4 text-sm text-on-surface outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-xs font-bold uppercase tracking-widest text-outline">영문 제목</span>
                    <input
                      value={editState.titleEn}
                      onChange={(event) => updateEdit("titleEn", event.target.value)}
                      className="h-11 rounded-lg bg-surface-container-lowest px-4 text-sm text-on-surface outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
                    />
                  </label>
                </div>
                <label className="grid gap-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-outline">대표 설명</span>
                  <textarea
                    value={editState.description}
                    onChange={(event) => updateEdit("description", event.target.value)}
                    rows={3}
                    className="rounded-lg bg-surface-container-lowest px-4 py-3 text-sm text-on-surface outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
                  />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-xs font-bold uppercase tracking-widest text-outline">한글 설명</span>
                    <textarea
                      value={editState.descriptionKo}
                      onChange={(event) => updateEdit("descriptionKo", event.target.value)}
                      rows={4}
                      className="rounded-lg bg-surface-container-lowest px-4 py-3 text-sm text-on-surface outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-xs font-bold uppercase tracking-widest text-outline">영문 설명</span>
                    <textarea
                      value={editState.descriptionEn}
                      onChange={(event) => updateEdit("descriptionEn", event.target.value)}
                      rows={4}
                      className="rounded-lg bg-surface-container-lowest px-4 py-3 text-sm text-on-surface outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
                    />
                  </label>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-xs font-bold uppercase tracking-widest text-outline">카테고리</span>
                    <input
                      value={editState.category}
                      onChange={(event) => updateEdit("category", event.target.value)}
                      className="h-11 rounded-lg bg-surface-container-lowest px-4 text-sm text-on-surface outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-xs font-bold uppercase tracking-widest text-outline">게시여부</span>
                    <select
                      value={editState.is_published ? "true" : "false"}
                      onChange={(event) => updateEdit("is_published", event.target.value === "true")}
                      className="h-11 rounded-lg bg-surface-container-lowest px-4 text-sm text-on-surface outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
                    >
                      <option value="true">게시 ON</option>
                      <option value="false">게시 OFF</option>
                    </select>
                  </label>
                </div>
                <label className="grid gap-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-outline">태그</span>
                  <input
                    value={editState.tags}
                    onChange={(event) => updateEdit("tags", event.target.value)}
                    placeholder="쉼표로 구분"
                    className="h-11 rounded-lg bg-surface-container-lowest px-4 text-sm text-on-surface outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
                  />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-xs font-bold uppercase tracking-widest text-outline">한글 태그</span>
                    <input
                      value={editState.tagsKo}
                      onChange={(event) => updateEdit("tagsKo", event.target.value)}
                      placeholder="쉼표로 구분"
                      className="h-11 rounded-lg bg-surface-container-lowest px-4 text-sm text-on-surface outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-xs font-bold uppercase tracking-widest text-outline">영문 태그</span>
                    <input
                      value={editState.tagsEn}
                      onChange={(event) => updateEdit("tagsEn", event.target.value)}
                      placeholder="comma separated"
                      className="h-11 rounded-lg bg-surface-container-lowest px-4 text-sm text-on-surface outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
                    />
                  </label>
                </div>
                <div className="rounded-xl border border-outline-variant/40 p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-outline">이미지별 가격</p>
                  <p className="mt-1 text-xs text-on-surface-variant">비워두면 전역 상품 가격을 사용합니다. 0원 입력도 가능합니다.</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {LICENSE_CODES.map((code) => (
                      <label key={code} className="grid gap-2">
                        <span className="text-xs font-bold text-on-surface">{code}</span>
                        <input
                          type="number"
                          min={0}
                          max={10000000}
                          value={editState.priceOverrides[code] ?? ""}
                          onChange={(event) => updateEditPrice(code, event.target.value)}
                          placeholder="전역가격"
                          className="h-10 rounded-lg bg-surface-container-lowest px-3 text-sm text-on-surface outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-outline-variant/20 p-5">
              <button
                type="button"
                onClick={() => setEditState(null)}
                className="rounded-lg border border-outline-variant px-4 py-2 text-xs font-bold uppercase tracking-widest text-on-surface"
              >
                취소
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={editSaving}
                className="rounded-lg bg-primary px-4 py-2 text-xs font-bold uppercase tracking-widest text-white disabled:opacity-50"
              >
                {editSaving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
