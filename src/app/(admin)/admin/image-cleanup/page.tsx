"use client";

import Image from "next/image";
import { useMemo, useState, type FormEvent } from "react";

type CleanupStatus = "all" | "draft" | "pending" | "approved" | "rejected";

interface ReferenceCounts {
  orderItems: number;
  downloads: number;
  earningsLedger: number;
  deletionRequests: number;
  sourcingResults: number;
  subscriptionDownloads: number;
  arweaveFeeOrderItems: number;
  favorites: number;
  collectionItems: number;
  priceOverrides: number;
}

interface CleanupCandidate {
  id: string;
  assetId: string | null;
  title: string;
  status: string | null;
  photographerName: string | null;
  previewUrl: string;
  fileSizeMb: number | null;
  width: number | null;
  height: number | null;
  createdAt: string;
  storageFileCount: number;
  referenceCounts: ReferenceCounts;
}

interface CandidateResponse {
  candidates: CleanupCandidate[];
  summary: {
    scanned: number;
    eligible: number;
    limit: number;
    totalFileSizeMb: number;
    totalStorageFiles: number;
  };
}

const STATUS_OPTIONS: Array<{ value: CleanupStatus; label: string }> = [
  { value: "all", label: "전체" },
  { value: "draft", label: "임시저장" },
  { value: "pending", label: "검토 대기" },
  { value: "approved", label: "승인됨" },
  { value: "rejected", label: "거절됨" },
];

function defaultDate() {
  const date = new Date();
  return date.toISOString().slice(0, 10);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function formatSize(value: number | null | undefined) {
  if (!value) return "-";
  return `${Number(value).toLocaleString("ko-KR", { maximumFractionDigits: 2 })} MB`;
}

function referenceSummary(counts: ReferenceCounts) {
  const entries = [
    ["즐겨찾기", counts.favorites],
    ["컬렉션", counts.collectionItems],
    ["가격정책", counts.priceOverrides],
  ].filter(([, count]) => Number(count) > 0);
  return entries.length === 0 ? "주요 참조 없음" : entries.map(([label, count]) => `${label} ${count}`).join(" · ");
}

export default function AdminImageCleanupPage() {
  const [createdBefore, setCreatedBefore] = useState(defaultDate());
  const [status, setStatus] = useState<CleanupStatus>("all");
  const [query, setQuery] = useState("");
  const [reason, setReason] = useState("베타 테스트 이미지 정리");
  const [confirmation, setConfirmation] = useState("");
  const [candidates, setCandidates] = useState<CleanupCandidate[]>([]);
  const [summary, setSummary] = useState<CandidateResponse["summary"] | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [purging, setPurging] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedCandidates = useMemo(
    () => candidates.filter((candidate) => selectedSet.has(candidate.id)),
    [candidates, selectedSet],
  );
  const selectedFileSize = selectedCandidates.reduce((sum, item) => sum + Number(item.fileSizeMb ?? 0), 0);
  const selectedStorageFiles = selectedCandidates.reduce((sum, item) => sum + item.storageFileCount, 0);
  const allSelected = candidates.length > 0 && candidates.every((candidate) => selectedSet.has(candidate.id));

  async function loadCandidates(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setLoading(true);
    setLastResult(null);
    try {
      const params = new URLSearchParams({
        createdBefore,
        status,
      });
      if (query.trim()) params.set("query", query.trim());
      const res = await fetch(`/api/admin/image-cleanup/candidates?${params.toString()}`);
      const data = await res.json().catch(() => null) as CandidateResponse & { error?: string } | null;
      if (!res.ok) throw new Error(data?.error ?? "정리 후보를 불러오지 못했습니다.");
      setCandidates(data?.candidates ?? []);
      setSummary(data?.summary ?? null);
      setSelectedIds([]);
    } catch (error) {
      alert(error instanceof Error ? error.message : "정리 후보를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function toggleAll() {
    setSelectedIds(allSelected ? [] : candidates.map((candidate) => candidate.id));
  }

  function toggleOne(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  async function purgeSelected() {
    if (selectedIds.length === 0 || confirmation !== "영구삭제") return;
    if (!confirm(`${selectedIds.length}개 이미지를 되돌릴 수 없게 영구 삭제합니다. 계속할까요?`)) return;
    setPurging(true);
    setLastResult(null);
    try {
      const res = await fetch("/api/admin/image-cleanup/purge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageIds: selectedIds,
          reason,
          deleteKind: "beta_cleanup",
          confirmation,
        }),
      });
      const data = await res.json().catch(() => null) as {
        summary?: { purged: number; failed: number };
        error?: string;
      } | null;
      if (!res.ok) throw new Error(data?.error ?? "영구 삭제를 실행하지 못했습니다.");
      setLastResult(`영구삭제 ${data?.summary?.purged ?? 0}개, 실패 ${data?.summary?.failed ?? 0}개`);
      setConfirmation("");
      await loadCandidates();
    } catch (error) {
      alert(error instanceof Error ? error.message : "영구 삭제 중 오류가 발생했습니다.");
    } finally {
      setPurging(false);
    }
  }

  return (
    <div className="p-6 md:p-10">
      <div className="mb-8">
        <h1 className="font-headline text-2xl font-extrabold tracking-tight text-on-surface">이미지 정리</h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-outline">
          베타 테스트 또는 실수 업로드 중 운영 참조가 없는 이미지만 자동 후보로 추출합니다.
          판매, 다운로드, 정산, 온체인/Arweave, 소싱 결과, 삭제 요청 이력이 있으면 영구삭제 후보에서 제외됩니다.
        </p>
      </div>

      <form onSubmit={loadCandidates} className="mb-6 grid gap-3 rounded-xl bg-surface-container-lowest p-4 shadow-ghost lg:grid-cols-[180px_160px_1fr_auto] lg:items-end">
        <label className="text-xs font-bold uppercase tracking-widest text-outline">
          기준일 이전
          <input
            type="date"
            value={createdBefore}
            onChange={(event) => setCreatedBefore(event.target.value)}
            className="mt-2 h-11 w-full rounded-lg bg-surface-container-low px-3 text-sm text-on-surface outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
          />
        </label>
        <label className="text-xs font-bold uppercase tracking-widest text-outline">
          상태
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as CleanupStatus)}
            className="mt-2 h-11 w-full rounded-lg bg-surface-container-low px-3 text-sm text-on-surface outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
          >
            {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="text-xs font-bold uppercase tracking-widest text-outline">
          검색
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="제목 또는 에셋ID"
            className="mt-2 h-11 w-full rounded-lg bg-surface-container-low px-3 text-sm text-on-surface outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
          />
        </label>
        <button
          disabled={loading}
          className="h-11 rounded-lg bg-primary px-5 text-xs font-bold uppercase tracking-widest text-white disabled:opacity-50"
        >
          {loading ? "조회 중..." : "후보 조회"}
        </button>
      </form>

      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <div className="rounded-lg bg-surface-container-lowest p-4 shadow-ghost">
          <p className="text-xs font-bold uppercase tracking-widest text-outline">스캔</p>
          <p className="mt-2 text-xl font-extrabold text-on-surface">{summary?.scanned ?? 0}</p>
        </div>
        <div className="rounded-lg bg-surface-container-lowest p-4 shadow-ghost">
          <p className="text-xs font-bold uppercase tracking-widest text-outline">삭제 후보</p>
          <p className="mt-2 text-xl font-extrabold text-on-surface">{summary?.eligible ?? candidates.length}</p>
        </div>
        <div className="rounded-lg bg-surface-container-lowest p-4 shadow-ghost">
          <p className="text-xs font-bold uppercase tracking-widest text-outline">파일 수</p>
          <p className="mt-2 text-xl font-extrabold text-on-surface">{summary?.totalStorageFiles ?? 0}</p>
        </div>
        <div className="rounded-lg bg-surface-container-lowest p-4 shadow-ghost">
          <p className="text-xs font-bold uppercase tracking-widest text-outline">용량</p>
          <p className="mt-2 text-xl font-extrabold text-on-surface">{formatSize(summary?.totalFileSizeMb)}</p>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 rounded-xl bg-surface-container-lowest p-4 shadow-ghost lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-on-surface">
            선택 {selectedIds.length.toLocaleString("ko-KR")}개 · 파일 {selectedStorageFiles.toLocaleString("ko-KR")}개 · {formatSize(selectedFileSize)}
          </p>
          <p className="mt-1 text-xs text-outline">삭제 전 확인 문구에 <span className="font-bold text-on-surface">영구삭제</span>를 입력해야 실행됩니다.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="h-10 min-w-0 rounded-lg bg-surface-container-low px-3 text-sm outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary sm:w-64"
            placeholder="삭제 사유"
          />
          <input
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            className="h-10 min-w-0 rounded-lg bg-surface-container-low px-3 text-sm outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-error sm:w-36"
            placeholder="영구삭제"
          />
          <button
            type="button"
            onClick={purgeSelected}
            disabled={selectedIds.length === 0 || confirmation !== "영구삭제" || purging}
            className="h-10 rounded-lg bg-error px-4 text-xs font-bold uppercase tracking-widest text-on-error disabled:cursor-not-allowed disabled:opacity-40"
          >
            {purging ? "삭제 중..." : "선택 영구삭제"}
          </button>
        </div>
      </div>

      {lastResult && (
        <div className="mb-4 rounded-lg bg-primary/10 px-4 py-3 text-sm font-semibold text-primary">{lastResult}</div>
      )}

      <div className="overflow-x-auto rounded-xl bg-surface-container-lowest shadow-ghost">
        <table className="w-full min-w-[980px] text-sm">
          <thead>
            <tr className="border-b border-outline-variant/20">
              <th className="w-12 px-5 py-4 text-left">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="전체 선택" />
              </th>
              {["이미지", "작가", "상태", "파일", "참조"].map((head) => (
                <th key={head} className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-outline">{head}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/20">
            {loading ? (
              <tr><td colSpan={6} className="px-5 py-16 text-center text-outline">후보를 조회하는 중...</td></tr>
            ) : candidates.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-16 text-center text-outline">조건에 맞는 영구삭제 후보가 없습니다.</td></tr>
            ) : candidates.map((candidate) => (
              <tr key={candidate.id} className="hover:bg-surface-container-low">
                <td className="px-5 py-5 align-top">
                  <input
                    type="checkbox"
                    checked={selectedSet.has(candidate.id)}
                    onChange={() => toggleOne(candidate.id)}
                    aria-label={`${candidate.title} 선택`}
                  />
                </td>
                <td className="px-5 py-5 align-top">
                  <div className="flex items-start gap-4">
                    <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg bg-surface-container-low">
                      {candidate.previewUrl ? (
                        <Image src={candidate.previewUrl} alt="" fill sizes="112px" className="object-cover" />
                      ) : (
                        <span className="material-symbols-outlined absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-outline">image</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="max-w-[360px] truncate font-semibold text-on-surface">{candidate.title}</p>
                      <p className="mt-1 font-mono text-xs text-outline">{candidate.assetId ?? candidate.id}</p>
                      <p className="mt-2 text-xs text-on-surface-variant">
                        {candidate.width && candidate.height ? `${candidate.width} x ${candidate.height}` : "크기 미기록"}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-5 align-top text-xs text-on-surface-variant">
                  {candidate.photographerName ?? "-"}
                </td>
                <td className="px-5 py-5 align-top">
                  <div className="flex flex-col gap-1 text-xs">
                    <span className="font-semibold text-on-surface">{candidate.status ?? "-"}</span>
                    <span className="text-outline">{formatDate(candidate.createdAt)}</span>
                  </div>
                </td>
                <td className="px-5 py-5 align-top text-xs text-on-surface-variant">
                  <p>{candidate.storageFileCount}개 파일</p>
                  <p>{formatSize(candidate.fileSizeMb)}</p>
                </td>
                <td className="px-5 py-5 align-top text-xs text-on-surface-variant">
                  {referenceSummary(candidate.referenceCounts)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
