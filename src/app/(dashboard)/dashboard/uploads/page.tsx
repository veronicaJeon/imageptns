"use client";

import { Fragment, useState, useEffect } from "react";
import Image from "next/image";
import { useLang } from "@/lib/i18n/store";
import { buildUploadProofSteps, type TimelineState } from "@/lib/ux/status";
import { getCopyrightLicense, getFreeUsagePolicy, getLocalizedCopyrightLicense, getLocalizedFreeUsagePolicy, localizedCopyrightLicenses, localizedFreeUsagePolicies, type CopyrightLicenseCode, type FreeUsagePolicyCode } from "@/lib/licenses/creative-commons";
import { DEFAULT_IMAGE_CATEGORIES, type ImageCategory } from "@/lib/images/categories";
import { PhotographerApprovalGate } from "@/components/dashboard/PhotographerStatusNotice";
import type { AuthorshipDeclaration } from "@/lib/onchain/registration";
import { useCart } from "@/lib/store/cart";

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
    deleteReasonDefault: "포트폴리오 정리",
    deleteRequestFailed: "삭제 요청을 생성하지 못했습니다.",
    deleteRequestAccepted: (fee: string) => `삭제 요청이 접수되었습니다. 예상 삭제 수수료: ₩${fee}`,
    deleteImmediateAccepted: "검색과 신규 판매에서 즉시 제외했습니다.",
    deleteDialogTitle: "사진을 삭제하시겠습니까?",
    arweaveDeletionNotice: "이 사진은 Arweave 자격증명이 발급되어 원본 증명 기록이 영구 저장되어 있습니다. 해당 기록 자체는 삭제할 수 없으며, 웹사이트 비노출·구매자 기록 보존·자격증명 연결 검토를 관리자가 처리해야 하므로 삭제 수수료가 발생할 수 있습니다. 비용은 Arweave 자격증명 사진에만 적용됩니다.",
    immediateDeletionNotice: "이 사진에는 Arweave 자격증명이 없습니다. 확인하면 검색과 신규 판매에서 즉시 제외되고, 장바구니에서는 사라지며, 기존 구매이력에서는 비활성 상태로 표시됩니다. 원본 파일과 데이터베이스 기록의 완전삭제는 관리자가 별도로 처리합니다.",
    deletionReasonLabel: "삭제 사유",
    deletionReasonPlaceholder: "예: 포트폴리오 정리",
    confirmDeleteRequest: "삭제 요청",
    confirmImmediateDelete: "즉시 비노출",
    rejectedRetention: (days: number) => `${days}일 이후 해당 기록은 사라집니다.`,
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
    editHelp: "제목이나 설명을 바꾸려면 해당 사진 오른쪽의 ‘편집’을 누르세요. 수정 후 아래의 ‘저장’을 누르면 반영됩니다.",
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
    deleteReasonDefault: "Portfolio cleanup",
    deleteRequestFailed: "Could not create the deletion request.",
    deleteRequestAccepted: (fee: string) => `Deletion request submitted. Estimated deletion fee: ₩${fee}`,
    deleteImmediateAccepted: "The image was immediately removed from search and new sales.",
    deleteDialogTitle: "Delete this image?",
    arweaveDeletionNotice: "This image has an Arweave credential, so its proof record is permanent and cannot itself be deleted. An administrator must handle site removal, buyer-history preservation, and credential-link review, which may incur a deletion fee. Fees apply only to Arweave-credentialed images.",
    immediateDeletionNotice: "This image has no Arweave credential. It will immediately disappear from search and carts, and any purchase history will be marked unavailable. Permanent removal of the source file and database record is handled separately by an administrator.",
    deletionReasonLabel: "Reason for deletion",
    deletionReasonPlaceholder: "Example: Portfolio cleanup",
    confirmDeleteRequest: "Request deletion",
    confirmImmediateDelete: "Remove now",
    rejectedRetention: (days: number) => `This record disappears after ${days} days.`,
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
    editHelp: "To change a title or description, select Edit beside the photo, then choose Save below.",
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
  approved: "border-primary/20 bg-primary/10 text-primary",
  pending:  "border-amber-200/70 bg-amber-50 text-amber-600 dark:border-amber-400/20 dark:bg-amber-900/20 dark:text-amber-300",
  rejected: "border-error/20 bg-error/10 text-error",
  draft:    "border-outline-variant/60 bg-surface-container-low text-outline",
};

const CHIP_CLASS = "inline-flex h-6 max-w-full items-center rounded-full border px-2.5 text-[10px] font-bold leading-none";

interface EditState {
  id: string;
  title: string;
  description: string;
  categoryCodes: string[];
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
  title_ko: string | null;
  title_en: string | null;
  description: string | null;
  description_ko: string | null;
  description_en: string | null;
  category: string;
  category_codes?: string[];
  tags: string[] | null;
  tags_ko: string[] | null;
  tags_en: string[] | null;
  status: string;
  lifecycle_status: string | null;
  deletion_requested_at: string | null;
  deletion_fee_krw: number | null;
  deletion_fee_status: string | null;
  rejection_reason: string | null;
  rejected_at: string | null;
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

function localizedText(
  lang: "ko" | "en",
  fallback: string | null | undefined,
  ko?: string | null,
  en?: string | null,
) {
  return (lang === "ko" ? ko : en)?.trim() || fallback?.trim() || "";
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
    <div className="mt-3 grid grid-cols-3 gap-2">
      {steps.map((step, index) => (
        <div key={step.key} className="flex min-w-0 flex-col items-center gap-1 text-center sm:flex-row sm:items-start sm:gap-2 sm:text-left">
          <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${TIMELINE_STYLES[step.state]}`}>
            {step.state === "done" ? "✓" : step.state === "failed" ? "!" : index + 1}
          </span>
          <div className="min-w-0">
            <p className="line-clamp-2 text-[10px] font-semibold leading-tight text-on-surface sm:text-[11px] sm:font-bold">{step.label}</p>
            <p className="hidden text-[10px] leading-relaxed text-outline sm:block">{step.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function UploadsPageContent() {
  const { t, lang } = useLang();
  const copy = UPLOADS_PAGE_COPY[lang];
  const copyrightLicenses = localizedCopyrightLicenses(lang);
  const freeUsagePolicies = localizedFreeUsagePolicies(lang);
  const up = t.dashboard.uploads;
  const c  = up.cols;

  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deletionTarget, setDeletionTarget] = useState<UploadRow | null>(null);
  const [deletionReason, setDeletionReason] = useState<string>(copy.deleteReasonDefault);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeFilter, setActiveFilter] = useState<StatusFilter>("all");
  const [categories, setCategories] = useState<ImageCategory[]>(() => [...DEFAULT_IMAGE_CATEGORIES]);
  const [rejectedImageRetentionDays, setRejectedImageRetentionDays] = useState(7);
  const removeUnavailableItems = useCart((state) => state.removeUnavailableItems);

  useEffect(() => {
    fetch("/api/uploads")
      .then((r) => r.json())
      .then((data: { uploads?: UploadRow[]; rejectedImageRetentionDays?: number }) => {
        setUploads(data.uploads ?? []);
        setRejectedImageRetentionDays(data.rejectedImageRetentionDays ?? 7);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((data: { categories?: ImageCategory[] }) => {
        if (data.categories?.length) setCategories(data.categories);
      })
      .catch(() => {});
  }, []);

  function toggleEditingCategory(code: string) {
    setEditing((current) => {
      if (!current) return current;
      if (current.categoryCodes.includes(code)) {
        return current.categoryCodes.length > 1
          ? { ...current, categoryCodes: current.categoryCodes.filter((item) => item !== code) }
          : current;
      }
      return { ...current, categoryCodes: [...current.categoryCodes, code] };
    });
  }

  function hasArweaveCredential(img: UploadRow) {
    return (
      Boolean(img.proof_arweave_confirmed_at) ||
      Boolean(img.proof_arweave_original_tx_id) ||
      Boolean(img.proof_arweave_metadata_tx_id) ||
      Boolean(img.proof_arweave_manifest_tx_id)
    );
  }

  function openDeletionDialog(img: UploadRow) {
    if (img.lifecycle_status && img.lifecycle_status !== "active") {
      alert(copy.alreadyDeleting);
      return;
    }
    setDeletionReason(copy.deleteReasonDefault);
    setDeletionTarget(img);
  }

  async function handleDelete() {
    if (!deletionTarget) return;
    const img = deletionTarget;
    setDeleting(img.id);
    try {
      const res = await fetch(`/api/images/${img.id}/deletion-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: deletionReason.trim() || copy.deleteReasonDefault, reasonCategory: "portfolio_cleanup" }),
      });
      const data = await res.json().catch(() => null) as {
        immediate?: boolean;
        request?: { estimated_fee_krw?: number };
        impact?: { estimatedFeeKrw?: number };
        error?: string;
      } | null;
      if (!res.ok) {
        alert(data?.error ?? copy.deleteRequestFailed);
        return;
      }

      if (data?.immediate) {
        setUploads((prev) => prev.filter((upload) => upload.id !== img.id));
        removeUnavailableItems([img.id]);
        setDeletionTarget(null);
        alert(copy.deleteImmediateAccepted);
      } else {
        const fee = data?.impact?.estimatedFeeKrw ?? data?.request?.estimated_fee_krw ?? 0;
        alert(copy.deleteRequestAccepted(fee.toLocaleString(copy.locale)));
        setUploads((prev) => prev.map((u) => u.id === img.id
          ? { ...u, lifecycle_status: "deletion_requested", deletion_fee_krw: fee, deletion_fee_status: fee > 0 ? "quoted" : "waived" }
          : u));
        setDeletionTarget(null);
      }
    } finally {
      setDeleting(null);
    }
  }

  function openEdit(img: UploadRow) {
    setEditing({
      id:           img.id,
      title:        img.title ?? "",
      description:  img.description ?? "",
      categoryCodes: img.category_codes?.length ? img.category_codes : [img.category || categories[0]?.code || "nature"],
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
    const normalizedTags = editing.tags.split(",").map((tag) => tag.trim()).filter(Boolean);
    setSaving(true);
    try {
      const res = await fetch(`/api/uploads/${editing.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title:        editing.title.trim(),
          description:  editing.description.trim() || null,
          title_ko:     lang === "ko" ? editing.title.trim() : undefined,
          title_en:     lang === "en" ? editing.title.trim() : undefined,
          description_ko: lang === "ko" ? editing.description.trim() || null : undefined,
          description_en: lang === "en" ? editing.description.trim() || null : undefined,
          category:     editing.categoryCodes[0],
          category_codes: editing.categoryCodes,
          tags:         normalizedTags,
          tags_ko:      lang === "ko" ? normalizedTags : undefined,
          tags_en:      lang === "en" ? normalizedTags : undefined,
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
          className="flex shrink-0 items-center gap-1.5 rounded bg-primary px-3 py-2.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 md:gap-2 md:px-5 md:py-3 md:text-sm"
        >
          <span className="material-symbols-outlined text-base">cloud_upload</span>
          {up.uploadBtn}
        </a>
      </div>

      {uploads.length > 0 && (
        <div className="mb-5 flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-xs leading-relaxed text-on-surface-variant">
          <span className="material-symbols-outlined mt-0.5 text-base text-primary">edit_note</span>
          <p>{copy.editHelp}</p>
        </div>
      )}

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
                  className={`shrink-0 whitespace-nowrap px-2.5 py-2 text-[11px] font-semibold border-b-2 -mb-px transition-colors md:px-4 md:py-2.5 md:text-xs ${
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

          {activeFilter === "rejected" && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-error/20 bg-error/5 px-4 py-3 text-xs font-semibold text-error">
              <span className="material-symbols-outlined text-base">schedule</span>
              <p>{copy.rejectedRetention(rejectedImageRetentionDays)}</p>
            </div>
          )}

          {filteredUploads.length === 0 ? (
            <div className="flex flex-col items-center py-24 gap-3 text-outline">
              <span className="material-symbols-outlined text-5xl">
                {activeFilter === "approved" ? "check_circle" : activeFilter === "rejected" ? "celebration" : "hourglass_empty"}
              </span>
              <p className="text-sm">{copy.empty[activeFilter]}</p>
            </div>
          ) : (
            <div className="-mx-4 overflow-hidden border border-outline-variant/30 bg-surface-container-lowest shadow-ghost md:mx-0 md:overflow-x-auto md:rounded-lg">
              <table className="w-full text-sm md:min-w-[820px]">
                <thead className="hidden md:table-header-group">
                  <tr className="border-b border-outline-variant/20">
                    <th className="text-left text-[11px] font-semibold text-outline px-6 py-4">{c.image}</th>
                    <th className="text-left text-[11px] font-semibold text-outline px-6 py-4">{c.status}</th>
                    <th className="text-left text-[11px] font-semibold text-outline px-6 py-4">{c.views}</th>
                    <th className="text-left text-[11px] font-semibold text-outline px-6 py-4">{c.sales}</th>
                    <th className="text-left text-[11px] font-semibold text-outline px-6 py-4">
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
                <tbody className="grid gap-3 p-3 md:table-row-group md:divide-y md:divide-outline-variant/20 md:p-0">
                  {filteredUploads.map((img) => {
                const uploaded = new Date(img.created_at).toLocaleDateString("en-US", {
                  month: "short", day: "numeric", year: "numeric",
                });
                const displayTitle = localizedText(lang, img.title, img.title_ko, img.title_en);
                const canEdit = true; // 모든 상태에서 편집 가능
                const isEditing = editing?.id === img.id;
                const deletionPending = img.lifecycle_status === "deletion_requested";

                return (
                  <Fragment key={img.id}>
                    <tr className={`grid grid-cols-3 overflow-hidden rounded-lg border border-outline-variant/30 transition-colors md:table-row md:rounded-none md:border-0 ${isEditing ? "bg-surface-container-low" : "bg-surface-container-lowest hover:bg-surface-container-low"}`}>
                      <td className="col-span-3 px-4 py-4 md:px-6 md:py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-16 h-16 bg-surface-container-low rounded shrink-0 overflow-hidden flex items-center justify-center">
                            {img.storage_path_preview ? (
                              <Image src={img.storage_path_preview} alt={displayTitle} width={64} height={64} className="w-full h-full object-contain" />
                            ) : (
                              <span className="material-symbols-outlined text-outline text-sm">image</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <span className="text-on-surface font-medium max-w-[200px] truncate block">{displayTitle}</span>
                            {img.asset_id && <span className="text-xs text-outline">{img.asset_id}</span>}
                          </div>
                        </div>
                      </td>
                      <td className="col-span-3 border-t border-outline-variant/20 px-4 py-4 md:border-t-0 md:px-6 md:py-4">
                        <span className={`${CHIP_CLASS} ${STATUS_STYLES[img.status] ?? "border-outline-variant/60 bg-surface-container-low text-outline"}`}>
                          {up.statuses[img.status as keyof typeof up.statuses] ?? img.status}
                        </span>
                        {img.status === "rejected" && img.rejection_reason && (
                          <p className="text-[10px] text-error mt-1 max-w-[180px] line-clamp-2 leading-relaxed">{img.rejection_reason}</p>
                        )}
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <span className={`${CHIP_CLASS} border-primary/20 bg-primary/10 text-primary`}>
                            {getLocalizedCopyrightLicense(img.copyright_license, lang).label}
                          </span>
                          {getLocalizedFreeUsagePolicy(img.free_usage_policy, lang).code !== "none" && (
                            <span className={`${CHIP_CLASS} border-primary/20 bg-primary/10 text-primary`}>
                              {getLocalizedFreeUsagePolicy(img.free_usage_policy, lang).label}
                            </span>
                          )}
                          <span className={`${CHIP_CLASS} border-outline-variant/60 bg-surface-container-low text-on-surface-variant`}>
                            {copy.proof[(img.proof_status ?? "not_registered") as keyof typeof copy.proof] ?? img.proof_status}
                          </span>
                          {img.lifecycle_status && img.lifecycle_status !== "active" && (
                            <span className={`${CHIP_CLASS} border-error/20 bg-error/10 text-error`}>
                              {deletionPending
                                ? copy.deletionRequested((img.deletion_fee_krw ?? 0).toLocaleString(copy.locale))
                                : img.lifecycle_status}
                            </span>
                          )}
                          <span className={`${CHIP_CLASS} border-outline-variant/60 bg-surface-container-low text-on-surface-variant`}>
                            {img.authorship_declaration === "ai_generated" ? copy.aiImage : copy.original}
                          </span>
                          {img.proof_arweave_original_tx_id && (
                            <a
                              href={`https://arweave.net/${img.proof_arweave_original_tx_id}`}
                              target="_blank"
                              rel="noreferrer"
                              className={`${CHIP_CLASS} border-primary/20 bg-primary/10 text-primary hover:border-primary/40`}
                            >
                              {copy.arweaveOriginal}
                            </a>
                          )}
                          {img.proof_arweave_metadata_tx_id && (
                            <a
                              href={`https://arweave.net/${img.proof_arweave_metadata_tx_id}`}
                              target="_blank"
                              rel="noreferrer"
                              className={`${CHIP_CLASS} border-primary/20 bg-primary/10 text-primary hover:border-primary/40`}
                            >
                              {copy.metadata}
                            </a>
                          )}
                          {img.proof_tx_hash && (
                            <a
                              href={explorerTxUrl(img.chain_id, img.proof_tx_hash) ?? undefined}
                              target="_blank"
                              rel="noreferrer"
                              className={`${CHIP_CLASS} border-primary/20 bg-primary/10 text-primary hover:border-primary/40`}
                            >
                              proof tx
                            </a>
                          )}
                        </div>
                        <UploadTimeline img={img} />
                      </td>
                      <td data-label={c.views} className="border-t border-outline-variant/20 px-4 py-3 text-center text-sm font-semibold text-on-surface before:block before:text-[10px] before:font-semibold before:text-outline before:content-[attr(data-label)] md:table-cell md:border-t-0 md:px-6 md:py-4 md:text-left md:text-sm md:font-normal md:text-on-surface-variant md:before:hidden">{(img.views_count ?? 0).toLocaleString()}</td>
                      <td data-label={c.sales} className="border-t border-outline-variant/20 px-4 py-3 text-center text-sm font-semibold text-on-surface before:block before:text-[10px] before:font-semibold before:text-outline before:content-[attr(data-label)] md:table-cell md:border-t-0 md:px-6 md:py-4 md:text-left md:text-sm md:font-normal md:text-on-surface-variant md:before:hidden">{img.sales_count ?? 0}</td>
                      <td data-label={c.uploaded} className="border-t border-outline-variant/20 px-2 py-3 text-center text-xs font-semibold text-on-surface before:block before:text-[10px] before:font-semibold before:text-outline before:content-[attr(data-label)] md:table-cell md:border-t-0 md:px-6 md:py-4 md:text-left md:text-sm md:font-normal md:text-on-surface-variant md:before:hidden">{uploaded}</td>
                      <td className="col-span-3 border-t border-outline-variant/20 px-4 py-3 md:border-t-0 md:px-6 md:py-4">
                        <div className="flex items-center justify-end gap-3 md:justify-start md:gap-2">
                          {canEdit && (
                            <button
                              onClick={() => isEditing ? setEditing(null) : openEdit(img)}
                              className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold transition-colors ${isEditing ? "bg-primary/10 text-primary" : "text-on-surface-variant hover:bg-primary/5 hover:text-primary"}`}
                              title={copy.editTitle}
                              aria-label={copy.editTitle}
                            >
                              <span className="material-symbols-outlined text-base">
                                {isEditing ? "close" : "edit"}
                              </span>
                              <span>{isEditing ? copy.cancel : copy.editTitle}</span>
                            </button>
                          )}
                          {canEdit && (
                            <button
                              onClick={() => openDeletionDialog(img)}
                              disabled={deleting === img.id}
                              className="text-outline hover:text-error transition-colors disabled:opacity-50"
                              title={copy.deleteTitle}
                              aria-label={copy.deleteTitle}
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
                      <tr className="block md:table-row">
                        <td colSpan={6} className="block rounded-lg border border-outline-variant/30 bg-surface-container-low px-4 py-4 md:table-cell md:rounded-none md:border-0 md:border-b md:border-outline-variant/20 md:px-6 md:pb-6 md:pt-2">
                          <div className="max-w-2xl flex flex-col gap-4">
                            <p className="text-xs font-semibold text-outline">{copy.editMeta}</p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="flex flex-col gap-1.5 sm:col-span-2">
                                <label className="text-xs font-semibold text-outline">{copy.title}</label>
                                <input
                                  type="text"
                                  value={editing.title}
                                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                                  className="h-10 bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded px-3 text-sm text-on-surface outline-none transition-all"
                                />
                              </div>

                              <div className="flex flex-col gap-1.5 sm:col-span-2">
                                <label className="text-xs font-semibold text-outline">{copy.description}</label>
                                <textarea
                                  value={editing.description}
                                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                                  rows={2}
                                  className="bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded px-3 py-2 text-sm text-on-surface outline-none resize-none transition-all"
                                />
                              </div>

                              <div className="flex flex-col gap-1.5 sm:col-span-2">
                                <label className="text-xs font-semibold text-outline">{copy.authorship}</label>
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
                                <label className="text-xs font-semibold text-outline">{copy.copyright}</label>
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
                                <label className="text-xs font-semibold text-outline">{copy.freeUse}</label>
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
                                <label className="text-xs font-semibold text-outline">{copy.attributionName}</label>
                                <input
                                  type="text"
                                  value={editing.attribution_name}
                                  onChange={(e) => setEditing({ ...editing, attribution_name: e.target.value })}
                                  placeholder={copy.attributionPlaceholder}
                                  className="h-10 bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded px-3 text-sm text-on-surface placeholder:text-outline outline-none transition-all"
                                />
                              </div>

                              <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-semibold text-outline">{copy.attributionUrl}</label>
                                <input
                                  type="url"
                                  value={editing.attribution_url}
                                  onChange={(e) => setEditing({ ...editing, attribution_url: e.target.value })}
                                  placeholder="https://..."
                                  className="h-10 bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded px-3 text-sm text-on-surface placeholder:text-outline outline-none transition-all"
                                />
                              </div>

                              <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-semibold text-outline">{copy.category}</label>
                                <div className="flex flex-wrap gap-2 rounded bg-surface-container-lowest p-2 ring-1 ring-outline-variant">
                                  {categories.map((cat) => {
                                    const checked = editing.categoryCodes.includes(cat.code);
                                    return (
                                      <button
                                        key={cat.code}
                                        type="button"
                                        onClick={() => toggleEditingCategory(cat.code)}
                                        className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-bold transition-colors ${checked ? "border-primary bg-primary/10 text-primary" : "border-outline-variant text-on-surface-variant hover:border-outline"}`}
                                      >
                                        <span className="material-symbols-outlined text-sm">{checked ? "check_circle" : "radio_button_unchecked"}</span>
                                        {cat[lang]}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-semibold text-outline">{copy.tags}</label>
                                <input
                                  type="text"
                                  value={editing.tags}
                                  onChange={(e) => setEditing({ ...editing, tags: e.target.value })}
                                  placeholder={copy.tagsPlaceholder}
                                  className="h-10 bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded px-3 text-sm text-on-surface placeholder:text-outline outline-none transition-all"
                                />
                              </div>

                              <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-semibold text-outline">{copy.shotAt}</label>
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
                                <label className="text-xs font-semibold text-outline">{copy.shotLocation}</label>
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
                                className="flex items-center gap-1.5 px-5 py-2.5 bg-primary text-white text-sm font-semibold rounded hover:opacity-90 transition-opacity disabled:opacity-50"
                              >
                                {saving ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
                                {copy.save}
                              </button>

                              {img.status === "rejected" && (
                                <button
                                  onClick={() => handleSave(true)}
                                  disabled={saving || !editing.title.trim()}
                                  className="flex items-center gap-1.5 px-5 py-2.5 border border-primary text-primary text-sm font-semibold rounded hover:bg-primary/5 transition-colors disabled:opacity-50"
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

      {deletionTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target && !deleting) setDeletionTarget(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="deletion-dialog-title"
            className="w-full max-w-lg rounded-xl bg-surface-container-lowest p-5 shadow-2xl md:p-6"
          >
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined rounded-full bg-error/10 p-2 text-error">delete</span>
              <div className="min-w-0">
                <h2 id="deletion-dialog-title" className="text-lg font-bold text-on-surface">{copy.deleteDialogTitle}</h2>
                <p className="mt-1 truncate text-sm text-outline">{localizedText(lang, deletionTarget.title, deletionTarget.title_ko, deletionTarget.title_en)}</p>
              </div>
            </div>

            <div className="mt-4 rounded-lg bg-surface-container-low px-4 py-3 text-sm leading-relaxed text-on-surface-variant">
              {hasArweaveCredential(deletionTarget) ? copy.arweaveDeletionNotice : copy.immediateDeletionNotice}
            </div>

            <label className="mt-4 block text-xs font-semibold text-outline" htmlFor="deletion-reason">
              {copy.deletionReasonLabel}
            </label>
            <textarea
              id="deletion-reason"
              value={deletionReason}
              onChange={(event) => setDeletionReason(event.target.value)}
              placeholder={copy.deletionReasonPlaceholder}
              rows={3}
              className="mt-1.5 w-full resize-none rounded-lg bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
            />

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletionTarget(null)}
                disabled={Boolean(deleting)}
                className="rounded px-4 py-2 text-sm font-semibold text-on-surface-variant hover:bg-surface-container-low disabled:opacity-50"
              >
                {copy.cancel}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={Boolean(deleting)}
                className="inline-flex items-center gap-2 rounded bg-error px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {deleting && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                {hasArweaveCredential(deletionTarget) ? copy.confirmDeleteRequest : copy.confirmImmediateDelete}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function UploadsPage() {
  return (
    <PhotographerApprovalGate>
      <UploadsPageContent />
    </PhotographerApprovalGate>
  );
}
