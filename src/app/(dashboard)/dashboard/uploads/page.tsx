"use client";

import { Fragment, useState, useEffect } from "react";
import Image from "next/image";
import { useLang } from "@/lib/i18n/store";
import { buildUploadProofSteps, type TimelineState } from "@/lib/ux/status";
import { COPYRIGHT_LICENSES, FREE_USAGE_POLICIES, getCopyrightLicense, getFreeUsagePolicy, type CopyrightLicenseCode, type FreeUsagePolicyCode } from "@/lib/licenses/creative-commons";

const CATEGORIES = ["nature", "people", "editorial", "urban", "abstract", "architecture"] as const;
type Category = typeof CATEGORIES[number];

type StatusFilter = "all" | "pending" | "approved" | "rejected";

const FILTER_TABS: { key: StatusFilter; label: string }[] = [
  { key: "all",      label: "전체" },
  { key: "pending",  label: "검토 중" },
  { key: "approved", label: "승인됨" },
  { key: "rejected", label: "반려됨" },
];

const EMPTY_MESSAGES: Record<StatusFilter, string> = {
  all:      "업로드한 이미지가 없습니다. 작품을 공유해보세요.",
  pending:  "검토 대기 중인 이미지가 없습니다.",
  approved: "승인된 이미지가 없습니다. 더 업로드해보세요.",
  rejected: "거절된 이미지가 없습니다 🎉",
};

const STATUS_STYLES: Record<string, string> = {
  approved: "bg-primary/10 text-primary",
  pending:  "bg-amber-50 text-amber-500 dark:bg-amber-900/20 dark:text-amber-300",
  rejected: "bg-error/10 text-error",
  draft:    "bg-surface-container-high text-outline",
};

interface EditState {
  id: string;
  title: string;
  description: string;
  category: Category;
  tags: string;
  exif_location: string;
  exif_taken_at: string;
  copyright_license: CopyrightLicenseCode;
  free_usage_policy: FreeUsagePolicyCode;
  attribution_name: string;
  attribution_url: string;
}

interface UploadRow {
  id: string;
  asset_id: string | null;
  title: string;
  description: string | null;
  category: Category;
  tags: string[] | null;
  status: string;
  rejection_reason: string | null;
  views_count: number | null;
  sales_count: number | null;
  created_at: string;
  storage_path_preview: string | null;
  exif_location: string | null;
  exif_taken_at: string | null;
  chain_id: number | null;
  onchain_asset_id: string | null;
  content_hash: string | null;
  proof_tx_hash: string | null;
  proof_status: string | null;
  proof_registered_at: string | null;
  copyright_license: string | null;
  free_usage_policy: string | null;
  attribution_name: string | null;
  attribution_url: string | null;
}

const PROOF_STATUS_LABELS: Record<string, string> = {
  not_registered: "증명 전",
  pending: "등록 중",
  registered: "증명 완료",
  failed: "증명 실패",
};

const TIMELINE_STYLES: Record<TimelineState, string> = {
  done: "bg-primary text-on-primary",
  current: "bg-amber-400 text-black",
  pending: "bg-surface-container-high text-outline",
  failed: "bg-error text-on-error",
};

function explorerTxUrl(chainId: number | null, txHash: string | null) {
  if (!chainId || !txHash) return null;
  const baseUrl = chainId === 8453 ? "https://basescan.org" : "https://sepolia.basescan.org";
  return `${baseUrl}/tx/${txHash}`;
}

function UploadTimeline({ img }: { img: UploadRow }) {
  const steps = buildUploadProofSteps({ status: img.status, proofStatus: img.proof_status });

  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-3">
      {steps.map((step, index) => (
        <div key={step.key} className="flex gap-2 min-w-0">
          <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${TIMELINE_STYLES[step.state]}`}>
            {step.state === "done" ? "✓" : step.state === "failed" ? "!" : index + 1}
          </span>
          <div>
            <p className="text-[11px] font-bold text-on-surface">{step.label}</p>
            <p className="text-[10px] leading-relaxed text-outline">{step.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function UploadsPage() {
  const { t } = useLang();
  const up = t.dashboard.uploads;
  const c  = up.cols;

  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeFilter, setActiveFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    fetch("/api/uploads")
      .then((r) => r.json())
      .then(({ uploads }) => setUploads(uploads ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(id: string) {
    if (!confirm("이미지를 삭제하시겠습니까?")) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/uploads/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const { error } = await res.json();
        alert(error);
        return;
      }
      setUploads((prev) => prev.filter((u) => u.id !== id));
    } finally {
      setDeleting(null);
    }
  }

  function openEdit(img: UploadRow) {
    setEditing({
      id:           img.id,
      title:        img.title ?? "",
      description:  img.description ?? "",
      category:     img.category ?? "nature",
      tags:         Array.isArray(img.tags) ? img.tags.join(", ") : "",
      exif_location: img.exif_location ?? "",
      exif_taken_at: img.exif_taken_at ? img.exif_taken_at.slice(0, 10) : "",
      copyright_license: getCopyrightLicense(img.copyright_license).code,
      free_usage_policy: getFreeUsagePolicy(img.free_usage_policy).code,
      attribution_name: img.attribution_name ?? "",
      attribution_url: img.attribution_url ?? "",
    });
  }

  async function handleSave(resubmit = false) {
    if (!editing || !editing.title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/uploads/${editing.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title:        editing.title.trim(),
          description:  editing.description.trim() || null,
          category:     editing.category,
          tags:         editing.tags.split(",").map((t) => t.trim()).filter(Boolean),
          exif_location: editing.exif_location.trim() || null,
          exif_taken_at: editing.exif_taken_at || null,
          copyright_license: editing.copyright_license,
          free_usage_policy: editing.free_usage_policy,
          attribution_name: editing.attribution_name.trim() || null,
          attribution_url: editing.attribution_url.trim() || null,
          resubmit,
        }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        alert(error);
        return;
      }
      const { image: updated } = await res.json();
      setUploads((prev) =>
        prev.map((u) => (u.id === editing.id ? { ...u, ...updated } : u))
      );
      setEditing(null);
    } finally {
      setSaving(false);
    }
  }

  const filteredUploads =
    activeFilter === "all"
      ? uploads
      : uploads.filter((u) => u.status === activeFilter);

  if (loading) {
    return (
      <div className="p-6 md:p-10 flex items-center justify-center min-h-[40vh]">
        <span className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-headline text-2xl font-extrabold text-on-surface tracking-tight">{up.title}</h1>
        <a
          href="/dashboard/uploads/new"
          className="flex items-center gap-2 px-5 py-3 bg-primary text-white text-xs font-bold uppercase tracking-widest rounded hover:opacity-90 transition-opacity"
        >
          <span className="material-symbols-outlined text-base">cloud_upload</span>
          {up.uploadBtn}
        </a>
      </div>

      {uploads.length === 0 ? (
        <div className="flex flex-col items-center py-32 gap-4 text-outline">
          <span className="material-symbols-outlined text-6xl">cloud_upload</span>
          <p>{up.empty}</p>
        </div>
      ) : (
        <>
          {/* Status filter tabs */}
          <div className="flex gap-1 mb-4 border-b border-outline-variant/20">
            {FILTER_TABS.map((tab) => {
              const count =
                tab.key === "all"
                  ? uploads.length
                  : uploads.filter((u) => u.status === tab.key).length;
              const isActive = activeFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => {
                    setActiveFilter(tab.key);
                    setEditing(null);
                  }}
                  className={`px-4 py-2.5 text-xs font-bold uppercase tracking-widest border-b-2 -mb-px transition-colors ${
                    isActive
                      ? "border-primary text-primary"
                      : "border-transparent text-outline hover:text-on-surface"
                  }`}
                >
                  {tab.label}
                  {count > 0 && (
                    <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${
                      isActive ? "bg-primary/10" : "bg-surface-container-high"
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {filteredUploads.length === 0 ? (
            <div className="flex flex-col items-center py-24 gap-3 text-outline">
              <span className="material-symbols-outlined text-5xl">
                {activeFilter === "approved" ? "check_circle" : activeFilter === "rejected" ? "celebration" : "hourglass_empty"}
              </span>
              <p className="text-sm">{EMPTY_MESSAGES[activeFilter]}</p>
            </div>
          ) : (
            <div className="bg-surface-container-lowest shadow-ghost overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-outline-variant/20">
                    <th className="text-left text-[10px] font-bold uppercase tracking-widest text-outline px-6 py-4">{c.image}</th>
                    <th className="text-left text-[10px] font-bold uppercase tracking-widest text-outline px-6 py-4">{c.status}</th>
                    <th className="text-left text-[10px] font-bold uppercase tracking-widest text-outline px-6 py-4">{c.views}</th>
                    <th className="text-left text-[10px] font-bold uppercase tracking-widest text-outline px-6 py-4">{c.sales}</th>
                    <th className="text-left text-[10px] font-bold uppercase tracking-widest text-outline px-6 py-4">
                      <span className="flex items-center gap-1">
                        {c.uploaded}
                        <span className="material-symbols-outlined text-[12px] text-primary" title="최신순 정렬">
                          arrow_downward
                        </span>
                      </span>
                    </th>
                    <th className="px-6 py-4" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
                  {filteredUploads.map((img) => {
                const uploaded = new Date(img.created_at).toLocaleDateString("en-US", {
                  month: "short", day: "numeric", year: "numeric",
                });
                const canEdit = true; // 모든 상태에서 편집 가능
                const isEditing = editing?.id === img.id;

                return (
                  <Fragment key={img.id}>
                    <tr className={`transition-colors ${isEditing ? "bg-surface-container-low" : "hover:bg-surface-container-low"}`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-14 h-10 bg-surface-container-low rounded shrink-0 overflow-hidden flex items-center justify-center">
                            {img.storage_path_preview ? (
                              <Image src={img.storage_path_preview} alt={img.title} width={56} height={40} className="w-full h-full object-cover" />
                            ) : (
                              <span className="material-symbols-outlined text-outline text-sm">image</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <span className="text-on-surface font-medium max-w-[200px] truncate block">{img.title}</span>
                            {img.asset_id && <span className="text-xs text-outline">{img.asset_id}</span>}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-bold px-3 py-1 rounded-full ${STATUS_STYLES[img.status] ?? ""}`}>
                          {up.statuses[img.status as keyof typeof up.statuses] ?? img.status}
                        </span>
                        {img.status === "rejected" && img.rejection_reason && (
                          <p className="text-[10px] text-error mt-1 max-w-[180px] line-clamp-2 leading-relaxed">{img.rejection_reason}</p>
                        )}
                        <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-bold">
                          <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                            {getCopyrightLicense(img.copyright_license).label}
                          </span>
                          {getFreeUsagePolicy(img.free_usage_policy).code !== "none" && (
                            <span className="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-200 px-2 py-0.5 rounded-full">
                              {getFreeUsagePolicy(img.free_usage_policy).label}
                            </span>
                          )}
                          <span className="bg-surface-container-low text-on-surface-variant px-2 py-0.5 rounded-full">
                            {PROOF_STATUS_LABELS[img.proof_status ?? "not_registered"] ?? img.proof_status}
                          </span>
                          {img.proof_tx_hash && (
                            <a
                              href={explorerTxUrl(img.chain_id, img.proof_tx_hash) ?? undefined}
                              target="_blank"
                              rel="noreferrer"
                              className="bg-primary/10 text-primary px-2 py-0.5 rounded-full hover:opacity-70"
                            >
                              proof tx
                            </a>
                          )}
                        </div>
                        <UploadTimeline img={img} />
                      </td>
                      <td className="px-6 py-4 text-on-surface-variant">{(img.views_count ?? 0).toLocaleString()}</td>
                      <td className="px-6 py-4 text-on-surface-variant">{img.sales_count ?? 0}</td>
                      <td className="px-6 py-4 text-on-surface-variant">{uploaded}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {canEdit && (
                            <button
                              onClick={() => isEditing ? setEditing(null) : openEdit(img)}
                              className={`transition-colors ${isEditing ? "text-primary" : "text-outline hover:text-primary"}`}
                              title="편집"
                            >
                              <span className="material-symbols-outlined text-base">
                                {isEditing ? "close" : "edit"}
                              </span>
                            </button>
                          )}
                          {canEdit && (
                            <button
                              onClick={() => handleDelete(img.id)}
                              disabled={deleting === img.id}
                              className="text-outline hover:text-error transition-colors disabled:opacity-50"
                              title="삭제"
                            >
                              {deleting === img.id
                                ? <span className="w-4 h-4 border-2 border-error border-t-transparent rounded-full animate-spin inline-block" />
                                : <span className="material-symbols-outlined text-base">delete</span>
                              }
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Inline edit form */}
                    {isEditing && editing && (
                      <tr>
                        <td colSpan={6} className="px-6 pb-6 pt-2 bg-surface-container-low border-b border-outline-variant/20">
                          <div className="max-w-2xl flex flex-col gap-4">
                            <p className="text-xs font-bold text-outline uppercase tracking-widest">메타데이터 편집</p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="flex flex-col gap-1.5 sm:col-span-2">
                                <label className="text-[10px] font-bold text-outline uppercase tracking-widest">제목 *</label>
                                <input
                                  type="text"
                                  value={editing.title}
                                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                                  className="h-10 bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded px-3 text-sm text-on-surface outline-none transition-all"
                                />
                              </div>

                              <div className="flex flex-col gap-1.5 sm:col-span-2">
                                <label className="text-[10px] font-bold text-outline uppercase tracking-widest">설명</label>
                                <textarea
                                  value={editing.description}
                                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                                  rows={2}
                                  className="bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded px-3 py-2 text-sm text-on-surface outline-none resize-none transition-all"
                                />
                              </div>

                              <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold text-outline uppercase tracking-widest">저작권 등급</label>
                                <select
                                  value={editing.copyright_license}
                                  onChange={(e) => setEditing({ ...editing, copyright_license: e.target.value as CopyrightLicenseCode })}
                                  className="h-10 bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded px-3 text-sm text-on-surface outline-none transition-all"
                                >
                                  {COPYRIGHT_LICENSES.map((license) => (
                                    <option key={license.code} value={license.code}>{license.label}</option>
                                  ))}
                                </select>
                              </div>

                              <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold text-outline uppercase tracking-widest">무료 사용</label>
                                <select
                                  value={editing.free_usage_policy}
                                  onChange={(e) => setEditing({ ...editing, free_usage_policy: e.target.value as FreeUsagePolicyCode })}
                                  className="h-10 bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded px-3 text-sm text-on-surface outline-none transition-all"
                                >
                                  {FREE_USAGE_POLICIES.map((policy) => (
                                    <option key={policy.code} value={policy.code}>{policy.label}</option>
                                  ))}
                                </select>
                              </div>

                              <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold text-outline uppercase tracking-widest">출처 표기명</label>
                                <input
                                  type="text"
                                  value={editing.attribution_name}
                                  onChange={(e) => setEditing({ ...editing, attribution_name: e.target.value })}
                                  placeholder="작가명 또는 스튜디오명"
                                  className="h-10 bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded px-3 text-sm text-on-surface placeholder:text-outline outline-none transition-all"
                                />
                              </div>

                              <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold text-outline uppercase tracking-widest">출처 URL</label>
                                <input
                                  type="url"
                                  value={editing.attribution_url}
                                  onChange={(e) => setEditing({ ...editing, attribution_url: e.target.value })}
                                  placeholder="https://..."
                                  className="h-10 bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded px-3 text-sm text-on-surface placeholder:text-outline outline-none transition-all"
                                />
                              </div>

                              <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold text-outline uppercase tracking-widest">카테고리</label>
                                <select
                                  value={editing.category}
                                  onChange={(e) => setEditing({ ...editing, category: e.target.value as Category })}
                                  className="h-10 bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded px-3 text-sm text-on-surface outline-none transition-all"
                                >
                                  {CATEGORIES.map((cat) => (
                                    <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                                  ))}
                                </select>
                              </div>

                              <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold text-outline uppercase tracking-widest">태그</label>
                                <input
                                  type="text"
                                  value={editing.tags}
                                  onChange={(e) => setEditing({ ...editing, tags: e.target.value })}
                                  placeholder="쉼표로 구분"
                                  className="h-10 bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded px-3 text-sm text-on-surface placeholder:text-outline outline-none transition-all"
                                />
                              </div>

                              <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold text-outline uppercase tracking-widest">촬영일시</label>
                                <div className="flex gap-2">
                                  <input
                                    type="date"
                                    value={editing.exif_taken_at === "unknown" ? "" : editing.exif_taken_at}
                                    disabled={editing.exif_taken_at === "unknown"}
                                    onChange={(e) => setEditing({ ...editing, exif_taken_at: e.target.value })}
                                    className="flex-1 h-10 bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded px-3 text-sm text-on-surface outline-none transition-all disabled:opacity-50"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setEditing({ ...editing, exif_taken_at: editing.exif_taken_at === "unknown" ? "" : "unknown" })}
                                    className={`h-10 px-3 text-xs rounded border transition-colors ${editing.exif_taken_at === "unknown" ? "border-primary text-primary bg-primary/5" : "border-outline-variant text-outline hover:text-on-surface"}`}
                                  >
                                    미상
                                  </button>
                                </div>
                              </div>

                              <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold text-outline uppercase tracking-widest">촬영장소</label>
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={editing.exif_location === "unknown" ? "" : editing.exif_location}
                                    disabled={editing.exif_location === "unknown"}
                                    onChange={(e) => setEditing({ ...editing, exif_location: e.target.value })}
                                    placeholder="예: Seoul, Korea"
                                    className="flex-1 h-10 bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded px-3 text-sm text-on-surface placeholder:text-outline outline-none transition-all disabled:opacity-50"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setEditing({ ...editing, exif_location: editing.exif_location === "unknown" ? "" : "unknown" })}
                                    className={`h-10 px-3 text-xs rounded border transition-colors ${editing.exif_location === "unknown" ? "border-primary text-primary bg-primary/5" : "border-outline-variant text-outline hover:text-on-surface"}`}
                                  >
                                    미상
                                  </button>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 flex-wrap">
                              <button
                                onClick={() => handleSave(false)}
                                disabled={saving || !editing.title.trim()}
                                className="flex items-center gap-1.5 px-5 py-2.5 bg-primary text-white text-xs font-bold uppercase tracking-widest rounded hover:opacity-90 transition-opacity disabled:opacity-50"
                              >
                                {saving ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
                                저장
                              </button>

                              {img.status === "rejected" && (
                                <button
                                  onClick={() => handleSave(true)}
                                  disabled={saving || !editing.title.trim()}
                                  className="flex items-center gap-1.5 px-5 py-2.5 border border-primary text-primary text-xs font-bold uppercase tracking-widest rounded hover:bg-primary/5 transition-colors disabled:opacity-50"
                                >
                                  <span className="material-symbols-outlined text-sm">send</span>
                                  저장 및 재검토 요청
                                </button>
                              )}

                              <button
                                onClick={() => setEditing(null)}
                                className="px-4 py-2.5 text-xs text-outline hover:text-on-surface transition-colors"
                              >
                                취소
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
