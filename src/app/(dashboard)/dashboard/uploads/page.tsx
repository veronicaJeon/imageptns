"use client";

import { Fragment, useState, useEffect } from "react";
import Image from "next/image";
import { useLang } from "@/lib/i18n/store";
import { buildUploadProofSteps, type TimelineState } from "@/lib/ux/status";
import { getCopyrightLicense, getFreeUsagePolicy, getLocalizedCopyrightLicense, getLocalizedFreeUsagePolicy, localizedCopyrightLicenses, localizedFreeUsagePolicies, type CopyrightLicenseCode, type FreeUsagePolicyCode } from "@/lib/licenses/creative-commons";
import type { AuthorshipDeclaration } from "@/lib/onchain/registration";

const CATEGORIES = ["nature", "people", "editorial", "urban", "abstract", "architecture"] as const;
type Category = typeof CATEGORIES[number];

type StatusFilter = "all" | "pending" | "approved" | "rejected";

const UPLOADS_PAGE_COPY = {
  ko: {
    locale: "ko-KR",
    filterTabs: { all: "전체", pending: "검토 중", approved: "승인됨", rejected: "반려됨" },
    empty: {
      all: "업로드한 이미지가 없습니다. 작품을 공유해보세요.",
      pending: "검토 대기 중인 이미지가 없습니다.",
      approved: "승인된 이미지가 없습니다. 더 업로드해보세요.",
      rejected: "거절된 이미지가 없습니다.",
    },
    proof: { not_registered: "증명 전", available: "등록가능", requested: "요청됨", pending: "Arweave 등록 중", registered: "증명 완료", failed: "증명 실패" },
    alreadyDeleting: "이미 삭제 절차가 진행 중이거나 완료된 이미지입니다.",
    deleteReasonPrompt: "관리자에게 전달할 삭제 요청 사유를 입력하세요.",
    deleteReasonDefault: "포트폴리오 정리",
    deleteRequestFailed: "삭제 요청을 생성하지 못했습니다.",
    deleteRequestAccepted: (fee: string) => `삭제 요청이 접수되었습니다. 예상 삭제 수수료: ₩${fee}`,
    deleteConfirm: "미공개 이미지를 완전삭제하시겠습니까?",
    latestSort: "최신순 정렬",
    deletionRequested: (fee: string) => `삭제 요청됨 · 수수료 ₩${fee}`,
    aiImage: "AI 이미지",
    original: "오리지널 보증",
    arweaveOriginal: "Arweave 원본",
    metadata: "메타데이터",
    editTitle: "편집",
    deleteRequestTitle: "삭제 요청",
    deleteTitle: "삭제",
    editMeta: "메타데이터 편집",
    title: "제목 *",
    description: "설명",
    authorship: "AI / 오리지널리티 선언",
    humanOriginal: "AI 이미지가 아니며, 본인의 오리지널리티 보증",
    aiGenerated: "AI 생성 이미지",
    copyright: "저작권 등급",
    freeUse: "무료 사용",
    attributionName: "출처 표기명",
    attributionPlaceholder: "작가명 또는 스튜디오명",
    attributionUrl: "출처 URL",
    category: "카테고리",
    tags: "태그",
    tagsPlaceholder: "쉼표로 구분",
    shotAt: "촬영일시",
    shotLocation: "촬영장소",
    unknown: "미상",
    save: "저장",
    saveAndResubmit: "저장 및 재검토 요청",
    cancel: "취소",
  },
  en: {
    locale: "en-US",
    filterTabs: { all: "All", pending: "Pending", approved: "Approved", rejected: "Rejected" },
    empty: {
      all: "No uploaded images yet. Start sharing your work.",
      pending: "No images are pending review.",
      approved: "No approved images yet. Upload more work.",
      rejected: "No rejected images.",
    },
    proof: { not_registered: "Not proven", available: "Eligible", requested: "Requested", pending: "Arweave registering", registered: "Proof complete", failed: "Proof failed" },
    alreadyDeleting: "This image is already in or past the deletion process.",
    deleteReasonPrompt: "Enter the deletion request reason for the admin team.",
    deleteReasonDefault: "Portfolio cleanup",
    deleteRequestFailed: "Could not create the deletion request.",
    deleteRequestAccepted: (fee: string) => `Deletion request submitted. Estimated deletion fee: ₩${fee}`,
    deleteConfirm: "Permanently delete this unpublished image?",
    latestSort: "Newest first",
    deletionRequested: (fee: string) => `Deletion requested · fee ₩${fee}`,
    aiImage: "AI image",
    original: "Originality attested",
    arweaveOriginal: "Arweave original",
    metadata: "Metadata",
    editTitle: "Edit",
    deleteRequestTitle: "Request deletion",
    deleteTitle: "Delete",
    editMeta: "Edit metadata",
    title: "Title *",
    description: "Description",
    authorship: "AI / originality declaration",
    humanOriginal: "Not AI-generated; I attest to my originality",
    aiGenerated: "AI-generated image",
    copyright: "Copyright license",
    freeUse: "Free use",
    attributionName: "Credit name",
    attributionPlaceholder: "Photographer or studio name",
    attributionUrl: "Credit URL",
    category: "Category",
    tags: "Tags",
    tagsPlaceholder: "Separated by commas",
    shotAt: "Date taken",
    shotLocation: "Location taken",
    unknown: "Unknown",
    save: "Save",
    saveAndResubmit: "Save and request re-review",
    cancel: "Cancel",
  },
} as const;

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
  authorship_declaration: AuthorshipDeclaration;
}

interface UploadRow {
  id: string;
  asset_id: string | null;
  title: string;
  description: string | null;
  category: Category;
  tags: string[] | null;
  status: string;
  lifecycle_status: string | null;
  deletion_requested_at: string | null;
  deletion_fee_krw: number | null;
  deletion_fee_status: string | null;
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
  proof_arweave_original_tx_id: string | null;
  proof_arweave_metadata_tx_id: string | null;
  proof_arweave_manifest_tx_id: string | null;
  proof_arweave_confirmed_at: string | null;
  proof_failure_reason: string | null;
  copyright_license: string | null;
  free_usage_policy: string | null;
  attribution_name: string | null;
  attribution_url: string | null;
  authorship_declaration: AuthorshipDeclaration | null;
}

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
  const { t, lang } = useLang();
  const copy = UPLOADS_PAGE_COPY[lang];
  const copyrightLicenses = localizedCopyrightLicenses(lang);
  const freeUsagePolicies = localizedFreeUsagePolicies(lang);
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

  function requiresAdminDeletionRequest(img: UploadRow) {
    return (
      img.status === "approved" ||
      (img.sales_count ?? 0) > 0 ||
      ["requested", "pending", "registered"].includes(img.proof_status ?? "") ||
      Boolean(img.proof_tx_hash || img.proof_arweave_original_tx_id || img.proof_arweave_manifest_tx_id)
    );
  }

  async function handleDelete(img: UploadRow) {
    if (img.lifecycle_status && img.lifecycle_status !== "active") {
      alert(copy.alreadyDeleting);
      return;
    }

    setDeleting(img.id);
    try {
      if (requiresAdminDeletionRequest(img)) {
        const reason = prompt(copy.deleteReasonPrompt, copy.deleteReasonDefault);
        if (reason === null) return;
        const res = await fetch(`/api/images/${img.id}/deletion-request`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason, reasonCategory: "portfolio_cleanup" }),
        });
        const data = await res.json().catch(() => null) as {
          request?: { estimated_fee_krw?: number };
          impact?: { estimatedFeeKrw?: number };
          error?: string;
        } | null;
        if (!res.ok) {
          alert(data?.error ?? copy.deleteRequestFailed);
          return;
        }
        const fee = data?.impact?.estimatedFeeKrw ?? data?.request?.estimated_fee_krw ?? 0;
        alert(copy.deleteRequestAccepted(fee.toLocaleString(copy.locale)));
        setUploads((prev) => prev.map((u) => u.id === img.id
          ? { ...u, lifecycle_status: "deletion_requested", deletion_fee_krw: fee, deletion_fee_status: fee > 0 ? "quoted" : "waived" }
          : u));
        return;
      }

      if (!confirm(copy.deleteConfirm)) return;
      const res = await fetch(`/api/uploads/${img.id}`, { method: "DELETE" });
      if (!res.ok) {
        const { error } = await res.json();
        alert(error);
        return;
      }
      setUploads((prev) => prev.filter((u) => u.id !== img.id));
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
      authorship_declaration: img.authorship_declaration ?? "human_original",
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
          authorship_declaration: editing.authorship_declaration,
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
    <div className="p-4 md:p-10">
      <div className="flex items-center justify-between gap-3 mb-6 md:mb-8">
        <h1 className="font-headline text-xl font-extrabold text-on-surface tracking-tight md:text-2xl">{up.title}</h1>
        <a
          href="/dashboard/uploads/new"
          className="flex shrink-0 items-center gap-1.5 rounded bg-primary px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white transition-opacity hover:opacity-90 md:gap-2 md:px-5 md:py-3 md:text-xs"
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
          <div className="-mx-1 mb-4 flex gap-1 overflow-x-auto border-b border-outline-variant/20 px-1">
            {(Object.keys(copy.filterTabs) as StatusFilter[]).map((key) => {
              const tab = { key, label: copy.filterTabs[key] };
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
                  className={`shrink-0 whitespace-nowrap px-2.5 py-2 text-[11px] font-bold uppercase tracking-wide border-b-2 -mb-px transition-colors md:px-4 md:py-2.5 md:text-xs md:tracking-widest ${
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
              <p className="text-sm">{copy.empty[activeFilter]}</p>
            </div>
          ) : (
            <div className="-mx-4 overflow-x-auto bg-surface-container-lowest shadow-ghost md:mx-0">
              <table className="min-w-[820px] w-full text-sm">
                <thead>
                  <tr className="border-b border-outline-variant/20">
                    <th className="text-left text-[10px] font-bold uppercase tracking-widest text-outline px-6 py-4">{c.image}</th>
                    <th className="text-left text-[10px] font-bold uppercase tracking-widest text-outline px-6 py-4">{c.status}</th>
                    <th className="text-left text-[10px] font-bold uppercase tracking-widest text-outline px-6 py-4">{c.views}</th>
                    <th className="text-left text-[10px] font-bold uppercase tracking-widest text-outline px-6 py-4">{c.sales}</th>
                    <th className="text-left text-[10px] font-bold uppercase tracking-widest text-outline px-6 py-4">
                      <span className="flex items-center gap-1">
                        {c.uploaded}
                        <span className="material-symbols-outlined text-[12px] text-primary" title={copy.latestSort}>
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
                const deletionPending = img.lifecycle_status === "deletion_requested";

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
                            {getLocalizedCopyrightLicense(img.copyright_license, lang).label}
                          </span>
                          {getLocalizedFreeUsagePolicy(img.free_usage_policy, lang).code !== "none" && (
                            <span className="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-200 px-2 py-0.5 rounded-full">
                              {getLocalizedFreeUsagePolicy(img.free_usage_policy, lang).label}
                            </span>
                          )}
                          <span className="bg-surface-container-low text-on-surface-variant px-2 py-0.5 rounded-full">
                            {copy.proof[(img.proof_status ?? "not_registered") as keyof typeof copy.proof] ?? img.proof_status}
                          </span>
                          {img.lifecycle_status && img.lifecycle_status !== "active" && (
                            <span className="bg-error/10 text-error px-2 py-0.5 rounded-full">
                              {deletionPending
                                ? copy.deletionRequested((img.deletion_fee_krw ?? 0).toLocaleString(copy.locale))
                                : img.lifecycle_status}
                            </span>
                          )}
                          <span className="bg-surface-container-low text-on-surface-variant px-2 py-0.5 rounded-full">
                            {img.authorship_declaration === "ai_generated" ? copy.aiImage : copy.original}
                          </span>
                          {img.proof_arweave_original_tx_id && (
                            <a
                              href={`https://arweave.net/${img.proof_arweave_original_tx_id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="bg-primary/10 text-primary px-2 py-0.5 rounded-full hover:opacity-70"
                            >
                              {copy.arweaveOriginal}
                            </a>
                          )}
                          {img.proof_arweave_metadata_tx_id && (
                            <a
                              href={`https://arweave.net/${img.proof_arweave_metadata_tx_id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="bg-primary/10 text-primary px-2 py-0.5 rounded-full hover:opacity-70"
                            >
                              {copy.metadata}
                            </a>
                          )}
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
                              title={copy.editTitle}
                            >
                              <span className="material-symbols-outlined text-base">
                                {isEditing ? "close" : "edit"}
                              </span>
                            </button>
                          )}
                          {canEdit && (
                            <button
                              onClick={() => handleDelete(img)}
                              disabled={deleting === img.id}
                              className="text-outline hover:text-error transition-colors disabled:opacity-50"
                              title={requiresAdminDeletionRequest(img) ? copy.deleteRequestTitle : copy.deleteTitle}
                            >
                              {deleting === img.id
                                ? <span className="w-4 h-4 border-2 border-error border-t-transparent rounded-full animate-spin inline-block" />
                                : <span className="material-symbols-outlined text-base">{requiresAdminDeletionRequest(img) ? "assignment_late" : "delete"}</span>
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
                            <p className="text-xs font-bold text-outline uppercase tracking-widest">{copy.editMeta}</p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="flex flex-col gap-1.5 sm:col-span-2">
                                <label className="text-[10px] font-bold text-outline uppercase tracking-widest">{copy.title}</label>
                                <input
                                  type="text"
                                  value={editing.title}
                                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                                  className="h-10 bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded px-3 text-sm text-on-surface outline-none transition-all"
                                />
                              </div>

                              <div className="flex flex-col gap-1.5 sm:col-span-2">
                                <label className="text-[10px] font-bold text-outline uppercase tracking-widest">{copy.description}</label>
                                <textarea
                                  value={editing.description}
                                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                                  rows={2}
                                  className="bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded px-3 py-2 text-sm text-on-surface outline-none resize-none transition-all"
                                />
                              </div>

                              <div className="flex flex-col gap-1.5 sm:col-span-2">
                                <label className="text-[10px] font-bold text-outline uppercase tracking-widest">{copy.authorship}</label>
                                <select
                                  value={editing.authorship_declaration}
                                  onChange={(e) => setEditing({ ...editing, authorship_declaration: e.target.value as AuthorshipDeclaration })}
                                  className="h-10 bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded px-3 text-sm text-on-surface outline-none transition-all"
                                >
                                  <option value="human_original">{copy.humanOriginal}</option>
                                  <option value="ai_generated">{copy.aiGenerated}</option>
                                </select>
                              </div>

                              <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold text-outline uppercase tracking-widest">{copy.copyright}</label>
                                <select
                                  value={editing.copyright_license}
                                  onChange={(e) => setEditing({ ...editing, copyright_license: e.target.value as CopyrightLicenseCode })}
                                  className="h-10 bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded px-3 text-sm text-on-surface outline-none transition-all"
                                >
                                  {copyrightLicenses.map((license) => (
                                    <option key={license.code} value={license.code}>{license.label}</option>
                                  ))}
                                </select>
                              </div>

                              <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold text-outline uppercase tracking-widest">{copy.freeUse}</label>
                                <select
                                  value={editing.free_usage_policy}
                                  onChange={(e) => setEditing({ ...editing, free_usage_policy: e.target.value as FreeUsagePolicyCode })}
                                  className="h-10 bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded px-3 text-sm text-on-surface outline-none transition-all"
                                >
                                  {freeUsagePolicies.map((policy) => (
                                    <option key={policy.code} value={policy.code}>{policy.label}</option>
                                  ))}
                                </select>
                              </div>

                              <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold text-outline uppercase tracking-widest">{copy.attributionName}</label>
                                <input
                                  type="text"
                                  value={editing.attribution_name}
                                  onChange={(e) => setEditing({ ...editing, attribution_name: e.target.value })}
                                  placeholder={copy.attributionPlaceholder}
                                  className="h-10 bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded px-3 text-sm text-on-surface placeholder:text-outline outline-none transition-all"
                                />
                              </div>

                              <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold text-outline uppercase tracking-widest">{copy.attributionUrl}</label>
                                <input
                                  type="url"
                                  value={editing.attribution_url}
                                  onChange={(e) => setEditing({ ...editing, attribution_url: e.target.value })}
                                  placeholder="https://..."
                                  className="h-10 bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded px-3 text-sm text-on-surface placeholder:text-outline outline-none transition-all"
                                />
                              </div>

                              <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold text-outline uppercase tracking-widest">{copy.category}</label>
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
                                <label className="text-[10px] font-bold text-outline uppercase tracking-widest">{copy.tags}</label>
                                <input
                                  type="text"
                                  value={editing.tags}
                                  onChange={(e) => setEditing({ ...editing, tags: e.target.value })}
                                  placeholder={copy.tagsPlaceholder}
                                  className="h-10 bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded px-3 text-sm text-on-surface placeholder:text-outline outline-none transition-all"
                                />
                              </div>

                              <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold text-outline uppercase tracking-widest">{copy.shotAt}</label>
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
                                    {copy.unknown}
                                  </button>
                                </div>
                              </div>

                              <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold text-outline uppercase tracking-widest">{copy.shotLocation}</label>
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={editing.exif_location === "unknown" ? "" : editing.exif_location}
                                    disabled={editing.exif_location === "unknown"}
                                    onChange={(e) => setEditing({ ...editing, exif_location: e.target.value })}
                                    placeholder="Example: Seoul, Korea"
                                    className="flex-1 h-10 bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded px-3 text-sm text-on-surface placeholder:text-outline outline-none transition-all disabled:opacity-50"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setEditing({ ...editing, exif_location: editing.exif_location === "unknown" ? "" : "unknown" })}
                                    className={`h-10 px-3 text-xs rounded border transition-colors ${editing.exif_location === "unknown" ? "border-primary text-primary bg-primary/5" : "border-outline-variant text-outline hover:text-on-surface"}`}
                                  >
                                    {copy.unknown}
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
                                {copy.save}
                              </button>

                              {img.status === "rejected" && (
                                <button
                                  onClick={() => handleSave(true)}
                                  disabled={saving || !editing.title.trim()}
                                  className="flex items-center gap-1.5 px-5 py-2.5 border border-primary text-primary text-xs font-bold uppercase tracking-widest rounded hover:bg-primary/5 transition-colors disabled:opacity-50"
                                >
                                  <span className="material-symbols-outlined text-sm">send</span>
                                  {copy.saveAndResubmit}
                                </button>
                              )}

                              <button
                                onClick={() => setEditing(null)}
                                className="px-4 py-2.5 text-xs text-outline hover:text-on-surface transition-colors"
                              >
                                {copy.cancel}
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
