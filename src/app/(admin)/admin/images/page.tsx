"use client";

import Image from "next/image";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

type ImageStatus = "all" | "pending" | "approved" | "rejected" | "draft";

interface AdminImage {
  id: string;
  asset_id: string | null;
  title: string;
  category: string;
  tags: string[] | null;
  status: string;
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

const PAGE_SIZE = 50;

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
        <button
          onClick={downloadSelected}
          disabled={selectedIds.length === 0 || downloading}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-on-surface px-4 text-xs font-bold uppercase tracking-widest text-surface-container-lowest transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span className="material-symbols-outlined text-base">download</span>
          {downloading ? "준비 중..." : `선택 원본 다운로드 (${selectedIds.length})`}
        </button>
      </div>

      <div className="overflow-x-auto bg-surface-container-lowest shadow-ghost">
        <table className="w-full min-w-[1080px] text-sm">
          <thead>
            <tr className="border-b border-outline-variant/20">
              <th className="w-12 px-4 py-4 text-left">
                <input type="checkbox" checked={allPageSelected} onChange={toggleAllPage} aria-label="현재 페이지 전체 선택" />
              </th>
              {["이미지", "에셋ID", "상태", "키워드", "크기", "성과", "등록일", "사진가"].map((head) => (
                <th key={head} className="px-4 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-outline">{head}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/20">
            {loading ? (
              <tr><td colSpan={9} className="px-5 py-20 text-center text-outline">이미지 목록을 불러오는 중...</td></tr>
            ) : images.length === 0 ? (
              <tr><td colSpan={9} className="px-5 py-20 text-center text-outline">조건에 맞는 이미지가 없습니다.</td></tr>
            ) : images.map((image) => (
              <tr key={image.id} className="hover:bg-surface-container-low">
                <td className="px-4 py-4">
                  <input
                    type="checkbox"
                    checked={selectedSet.has(image.id)}
                    onChange={() => toggleOne(image.id)}
                    aria-label={`${image.title} 선택`}
                  />
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded bg-surface-container-low">
                      {image.storage_path_preview ? (
                        <Image src={image.storage_path_preview} alt="" fill sizes="80px" className="object-cover" />
                      ) : (
                        <span className="material-symbols-outlined absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-outline">image</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="max-w-72 truncate font-semibold text-on-surface">{image.title}</p>
                      <p className="mt-1 text-xs text-outline">{image.category}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 font-mono text-xs font-semibold text-on-surface">{image.asset_id ?? "-"}</td>
                <td className="px-4 py-4">
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${STATUS_CLASSES[image.status] ?? "bg-surface-container-high text-outline"}`}>
                    {STATUS_LABELS[image.status] ?? image.status}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <div className="flex max-w-64 flex-wrap gap-1">
                    {(image.tags ?? []).slice(0, 4).map((tag) => (
                      <span key={tag} className="rounded-full bg-primary/8 px-2 py-0.5 text-[10px] font-semibold text-primary">#{tag}</span>
                    ))}
                    {(image.tags?.length ?? 0) > 4 && <span className="text-[10px] text-outline">+{(image.tags?.length ?? 0) - 4}</span>}
                  </div>
                </td>
                <td className="px-4 py-4 text-xs text-on-surface-variant">
                  <p>{image.width && image.height ? `${image.width} x ${image.height}` : "-"}</p>
                  <p className="mt-1 text-outline">{image.file_format ?? "-"} · {formatSize(image.file_size_mb)}</p>
                </td>
                <td className="px-4 py-4 text-xs text-on-surface-variant">
                  <p>조회 {image.views_count ?? 0}</p>
                  <p className="mt-1">판매 {image.sales_count ?? 0}</p>
                </td>
                <td className="px-4 py-4 text-xs text-on-surface-variant">{formatDate(image.created_at)}</td>
                <td className="px-4 py-4 text-xs text-on-surface-variant">{image.photographer?.full_name ?? "-"}</td>
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
    </div>
  );
}
