"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useLang } from "@/lib/i18n/store";
import { extractExif, type ExifData } from "@/lib/utils/exif";
import { normalizeRotationDegrees, rotatedDimensions } from "@/lib/images/orientation";
import { type CopyrightLicenseCode, type FreeUsagePolicyCode } from "@/lib/licenses/creative-commons";
import { DEFAULT_IMAGE_CATEGORIES, type ImageCategory } from "@/lib/images/categories";
import { PhotographerApprovalGate } from "@/components/dashboard/PhotographerStatusNotice";
import { CopyrightLicenseStepper } from "@/components/uploads/CopyrightLicenseStepper";
import { LocationAutocomplete } from "@/components/uploads/LocationAutocomplete";
import type { AuthorshipDeclaration } from "@/lib/onchain/registration";
import {
  ACCEPTED_UPLOAD_TYPES,
  MAX_UPLOAD_BATCH_FILES,
  MAX_UPLOAD_SIZE_MB,
  canSubmitUploadBatch,
  filterAcceptedUploadFiles,
  takeAvailableUploadSlots,
  uploadFileClientId,
  type UploadDraftReadiness,
} from "@/lib/uploads/batch-client";
import { localTodayDateValue, takenAtIsFuture } from "@/lib/uploads/taken-at";

const UNKNOWN = "unknown";

const NEW_UPLOAD_COPY = {
  ko: {
    locale: "ko-KR",
    exifLabels: {
      takenAt: "촬영일시", location: "위치", altitude: "고도", camera: "카메라", lens: "렌즈", focalLength: "초점거리",
      equivalent: "환산", aperture: "조리개", shutterSpeed: "셔터속도", flash: "플래시", whiteBalance: "화이트밸런스",
      exposureMode: "노출모드", meteringMode: "측광모드", colorSpace: "색공간", orientation: "방향", software: "소프트웨어",
    },
    errors: {
      unsupportedType: "지원하지 않는 파일 형식입니다. JPEG만 허용됩니다.",
      tooLarge: (max: number) => `파일 크기는 ${max}MB를 초과할 수 없습니다.`,
      uploadFailed: "업로드 중 오류가 발생했습니다.",
      duplicate: "이미 대기열에 추가된 파일입니다.",
      batchLimit: (max: number) => `한 번에 최대 ${max}장까지만 업로드할 수 있습니다. 초과한 사진은 추가되지 않았습니다.`,
    },
    pageTitle: "이미지 업로드",
    doneTitle: "업로드 완료!",
    doneBody: "선택한 이미지가 검토 대기 중입니다. 승인 후 라이브러리에 노출됩니다.",
    dropTitle: "파일을 드래그하거나 클릭하여 선택",
    dropHelp: "여러장을 동시에 업로드 할 수 있습니다. 안정적인 업로드를 위해 1회 20장 이하까지 가능합니다. 한 이미지당 최대 500MB, JPEG로 업로드 해 주십시오.",
    addMore: "사진 추가",
    queueTitle: "업로드 대기창",
    queueHelp: "1. 유사한 이미지들을 업로드 할 때는 대표 이미지에 정보를 모두 입력한 뒤, '현재 입력값 전체 적용'을 클릭합니다. 그러면 동일한 정보가 유사한 이미지들 전체에 적용됩니다.\n2. 그 이미지들 가운데 디테일한 정보의 차이가 있을 경우, 그 이미지를 클릭한 후 다른 정보를 입력하면 수정됩니다.\n3. 위와 같이 수정한 후 '선택 이미지 업로드'를 클릭하면 정확하게 업로드됩니다.",
    fileCount: (count: number) => `${count}장 선택됨`,
    activeFile: "편집 중",
    remove: "삭제",
    copyToAll: "현재 입력값 전체 적용",
    copiedToAll: "현재 사진의 제목, 설명, 태그, 카테고리, 촬영정보를 다른 대기 파일에 복사했습니다.",
    noFiles: "먼저 업로드할 이미지를 선택하세요.",
    pending: "대기",
    uploadingFile: "업로드 중",
    savingFile: "저장 중",
    uploadedFile: "완료",
    failedFile: "실패",
    partialFailed: (count: number) => `${count}개 파일 업로드에 실패했습니다. 실패 항목을 확인한 뒤 다시 제출해 주세요.`,
    rotated: "회전 보정",
    rotateLeft: "왼쪽 회전",
    rotateRight: "오른쪽 회전",
    reset: "초기화",
    rotationHelp: "세로/가로가 다르게 보이면 회전 보정 후 제출하세요. 워터마크와 썸네일에도 반영됩니다.",
    aiAnalyzing: "AI가 이미지를 분석하고 있어요...",
    aiDone: "AI가 내용을 자동으로 채웠어요. 수정하셔도 됩니다.",
    aiFailed: "AI 분석을 완료하지 못했어요. 직접 입력해 주세요.",
    uploading: "업로드 중...",
    saving: "메타데이터 저장 중...",
    title: "작품 제목 *",
    aiGenerated: "AI 자동생성",
    titlePlaceholderAnalyzing: "AI가 제목을 생성 중...",
    titlePlaceholder: "작품 제목을 입력하세요 (AI가 자동으로 채워줍니다)",
    description: "설명 *",
    descriptionPlaceholder: "이미지에 대한 설명을 입력하세요",
    category: "카테고리 *",
    tags: "태그 *",
    tagsPlaceholder: "쉼표로 구분 (예: landscape, sunset, korea)",
    tagsError: "태그를 최소 1개 입력해 주세요.",
    shotAt: "촬영일시 *",
    shotLocation: "촬영장소 *",
    exifAuto: "EXIF 자동입력",
    unknownFull: "미상 (Unknown)",
    unknown: "미상",
    manualInput: "직접입력",
    shotAtError: "촬영일시를 입력하거나 '미상'을 선택하세요.",
    shotAtFutureError: "날짜를 다시 확인해 주세요. 미래의 날짜는 설정할 수 없습니다.",
    locationPlaceholder: "예: 서교동",
    locationError: "촬영장소를 입력하거나 '미상'을 선택하세요.",
    copyrightTitle: "공통 저작권 및 공개 범위 *",
    copyrightHelp: "이번 대기열에 있는 모든 사진에 같은 저작권 등급과 무료 사용 조건을 적용합니다.",
    attributionName: "공통 출처 표기명",
    attributionPlaceholder: "예: 작가명 또는 스튜디오명",
    attributionUrl: "공통 출처 URL",
    authorshipTitle: "공통 AI 및 오리지널리티 보증 *",
    authorshipHelp: "대기열에 있는 모든 이미지의 생성 방식을 선언해주세요.",
    humanTitle: "AI 생성 이미지가 아니며, 본인의 오리지널리티가 있음을 보증합니다.",
    humanBody: "직접 촬영했거나 권리자로서 라이선스 판매 및 증명을 요청할 수 있는 이미지입니다.",
    aiTitle: "이 이미지는 AI 생성 이미지입니다.",
    aiBody: "AI 생성 또는 AI 보정 사실을 명시하며, 판매/배포 권한을 보유하고 있음을 확인합니다.",
    authorshipError: "AI 여부 또는 오리지널리티 보증을 선택해주세요.",
    factualityTitle: "공통 업로드 내용 사실성 보증 *",
    factualityBody: "이번에 제출하는 사진, 제목, 설명, 캡션, 태그 및 관련 메타데이터가 사실과 부합하며, 제3자의 권리나 신원을 오인하게 만들지 않음을 확인합니다.",
    factualityError: "사실성 보증 동의가 필요합니다.",
    promotionalTitle: "이미지파트너스 홍보 활용 허용 (선택)",
    promotionalBody: "선택하면 이미지파트너스가 서비스 소개 페이지와 공식 홍보물에 이 사진의 워터마크 없는 저해상도 파생본을 사용할 수 있습니다. 원본 파일은 공개되지 않으며, 허용은 이후 철회할 수 있습니다.",
    submit: "선택 이미지 업로드",
    reviewHelp: "제출한 이미지는 운영팀 검토 후 라이브러리에 노출됩니다. 검토에는 1-3 영업일이 소요됩니다.",
  },
  en: {
    locale: "en-US",
    exifLabels: {
      takenAt: "Date taken", location: "Location", altitude: "Altitude", camera: "Camera", lens: "Lens", focalLength: "Focal length",
      equivalent: "equiv.", aperture: "Aperture", shutterSpeed: "Shutter speed", flash: "Flash", whiteBalance: "White balance",
      exposureMode: "Exposure mode", meteringMode: "Metering mode", colorSpace: "Color space", orientation: "Orientation", software: "Software",
    },
    errors: {
      unsupportedType: "Unsupported file type. Only JPEG is allowed.",
      tooLarge: (max: number) => `File size must not exceed ${max}MB.`,
      uploadFailed: "An error occurred while uploading.",
      duplicate: "This file is already in the upload queue.",
      batchLimit: (max: number) => `You can upload a maximum of ${max} photos per batch. Extra photos were not added.`,
    },
    pageTitle: "Upload images",
    doneTitle: "Upload complete",
    doneBody: "Your selected images are pending review. They will appear in the library after approval.",
    dropTitle: "Drag files here or click to select",
    dropHelp: "Upload multiple images at once. A maximum of 20 images is allowed per batch for reliability. Each JPEG may be up to 500MB.",
    addMore: "Add photos",
    queueTitle: "Upload window",
    queueHelp: "1. For similar images, complete the representative image first, then select 'Apply current fields to all'.\n2. If an image has different details, select it and edit those fields individually.\n3. When the details are correct, select 'Upload selected images'.",
    fileCount: (count: number) => `${count} selected`,
    activeFile: "Editing",
    remove: "Remove",
    copyToAll: "Apply current fields to all",
    copiedToAll: "Copied this photo's title, description, tags, categories, and shooting info to the other queued files.",
    noFiles: "Select images to upload first.",
    pending: "Pending",
    uploadingFile: "Uploading",
    savingFile: "Saving",
    uploadedFile: "Done",
    failedFile: "Failed",
    partialFailed: (count: number) => `${count} file(s) failed to upload. Check failed items and submit again.`,
    rotated: "rotation correction",
    rotateLeft: "Rotate left",
    rotateRight: "Rotate right",
    reset: "Reset",
    rotationHelp: "If portrait/landscape orientation looks wrong, correct the rotation before submitting. Watermarks and thumbnails will use this correction.",
    aiAnalyzing: "AI is analyzing the image...",
    aiDone: "AI filled in the draft. You can edit it.",
    aiFailed: "AI analysis could not be completed. Please enter the fields manually.",
    uploading: "Uploading...",
    saving: "Saving metadata...",
    title: "Title *",
    aiGenerated: "AI draft",
    titlePlaceholderAnalyzing: "AI is generating a title...",
    titlePlaceholder: "Enter the image title. AI can fill this automatically.",
    description: "Description *",
    descriptionPlaceholder: "Enter a description of the image",
    category: "Category *",
    tags: "Tags *",
    tagsPlaceholder: "Separated by commas (example: landscape, sunset, korea)",
    tagsError: "Enter at least one tag.",
    shotAt: "Date taken *",
    shotLocation: "Location taken *",
    exifAuto: "Filled from EXIF",
    unknownFull: "Unknown",
    unknown: "Unknown",
    manualInput: "Manual input",
    shotAtError: "Enter the date taken or choose Unknown.",
    shotAtFutureError: "Check the date again. A future date cannot be selected.",
    locationPlaceholder: "Example: Seoul, Korea",
    locationError: "Enter the location taken or choose Unknown.",
    copyrightTitle: "Shared copyright and release scope *",
    copyrightHelp: "Apply the same Creative Commons level and free-use policy to every photo in this queue.",
    attributionName: "Shared credit name",
    attributionPlaceholder: "Example: photographer or studio name",
    attributionUrl: "Shared credit URL",
    authorshipTitle: "Shared AI and originality declaration *",
    authorshipHelp: "Declare how every image in this queue was created.",
    humanTitle: "This is not an AI image, and I attest to my originality.",
    humanBody: "This image was photographed by me, or I hold the rights needed to sell licenses and request proof.",
    aiTitle: "This is an AI-generated image.",
    aiBody: "I disclose AI generation or AI alteration and confirm that I hold the rights to sell or distribute it.",
    authorshipError: "Select whether this is AI-generated or originality-attested.",
    factualityTitle: "Shared factuality attestation *",
    factualityBody: "I confirm that the submitted image, title, description, caption, tags, and metadata are factual and do not mislead about third-party rights or identity.",
    factualityError: "Factuality attestation is required.",
    promotionalTitle: "Allow Image Partners promotional use (optional)",
    promotionalBody: "If selected, Image Partners may use a resized, unwatermarked derivative on service pages and official promotions. The original file remains private, and you may withdraw permission later.",
    submit: "Upload selected images",
    reviewHelp: "Submitted images appear in the library after operations review. Review usually takes 1-3 business days.",
  },
} as const;

type NewUploadLang = keyof typeof NEW_UPLOAD_COPY;
type ExifLabelCopy = Record<keyof typeof NEW_UPLOAD_COPY.ko.exifLabels, string>;
type LocalizedDraft = {
  title_ko: string;
  title_en: string;
  description_ko: string;
  description_en: string;
  tags_ko: string[];
  tags_en: string[];
};
type DraftStatus = "idle" | "uploading" | "saving" | "done" | "error";
type AiStatus = "idle" | "analyzing" | "done" | "failed";
type DraftSource = "exif" | "manual";

interface UploadDraft extends UploadDraftReadiness {
  file: File;
  preview: string;
  localizedDraft: LocalizedDraft;
  takenAtSource: DraftSource;
  locationSource: DraftSource;
  rotationDegrees: number;
  imgWidth: number | null;
  imgHeight: number | null;
  aiStatus: AiStatus;
  exifData: ExifData | null;
  uploadStatus: DraftStatus;
  progress: number;
  errorMsg: string;
}

const EMPTY_LOCALIZED_DRAFT: LocalizedDraft = {
  title_ko: "",
  title_en: "",
  description_ko: "",
  description_en: "",
  tags_ko: [],
  tags_en: [],
};

function cloneLocalizedDraft(draft: LocalizedDraft) {
  return {
    ...draft,
    tags_ko: [...draft.tags_ko],
    tags_en: [...draft.tags_en],
  };
}

function previewContainerClass(w: number | null, h: number | null): string {
  if (!w || !h) return "w-full max-h-[70vh] overflow-hidden rounded-lg";
  const r = w / h;
  if (r >= 1.35) return "w-full overflow-hidden rounded-lg";
  if (r <= 0.74) return "w-full max-w-[720px] mx-auto overflow-hidden rounded-lg";
  return "w-full max-w-[820px] mx-auto overflow-hidden rounded-lg";
}

function ExifPanel({ data, lang, labels }: { data: ExifData; lang: NewUploadLang; labels: ExifLabelCopy }) {
  const [expanded, setExpanded] = useState(false);
  const rows: { label: string; value: string }[] = [];

  if (data.takenAt) rows.push({ label: labels.takenAt, value: data.takenAt.toLocaleString(lang === "ko" ? "ko-KR" : "en-US") });
  if (data.locationLabel) rows.push({ label: labels.location, value: data.locationLabel });
  if (data.lat != null && data.lng != null) rows.push({ label: "GPS", value: `${data.lat.toFixed(6)}, ${data.lng.toFixed(6)}` });
  if (data.altitude != null) rows.push({ label: labels.altitude, value: `${data.altitude.toFixed(0)}m` });
  if (data.camera) rows.push({ label: labels.camera, value: data.camera });
  if (data.lensModel) rows.push({ label: labels.lens, value: data.lensModel });
  if (data.focalLength != null) {
    rows.push({
      label: labels.focalLength,
      value: `${data.focalLength}mm${data.focalLength35mm ? ` (${data.focalLength35mm}mm ${labels.equivalent})` : ""}`,
    });
  }
  if (data.iso != null) rows.push({ label: "ISO", value: String(data.iso) });
  if (data.aperture != null) rows.push({ label: labels.aperture, value: `f/${data.aperture}` });
  if (data.shutterSpeed) rows.push({ label: labels.shutterSpeed, value: data.shutterSpeed });
  if (data.flash) rows.push({ label: labels.flash, value: data.flash });
  if (data.whiteBalance) rows.push({ label: labels.whiteBalance, value: data.whiteBalance });
  if (data.exposureMode) rows.push({ label: labels.exposureMode, value: data.exposureMode });
  if (data.meteringMode) rows.push({ label: labels.meteringMode, value: data.meteringMode });
  if (data.colorSpace) rows.push({ label: labels.colorSpace, value: data.colorSpace });
  if (data.orientation != null) rows.push({ label: labels.orientation, value: String(data.orientation) });
  if (data.software) rows.push({ label: labels.software, value: data.software });

  for (const [key, raw] of Object.entries(data.rawFields)) {
    if (rows.length >= 40) break;
    const value = raw instanceof Date ? raw.toLocaleString(lang === "ko" ? "ko-KR" : "en-US") : String(raw);
    if (value.length > 120) continue;
    rows.push({ label: key, value });
  }

  if (rows.length === 0) return null;

  const summaryParts: string[] = [];
  if (data.camera) summaryParts.push(data.camera);
  if (data.iso != null) summaryParts.push(`ISO ${data.iso}`);
  if (data.aperture != null) summaryParts.push(`f/${data.aperture}`);
  if (data.shutterSpeed) summaryParts.push(data.shutterSpeed);
  if (data.focalLength != null) summaryParts.push(`${data.focalLength}mm`);
  const summary = summaryParts.join(" · ") || rows[0].value;

  return (
    <div className="overflow-hidden rounded-lg border border-outline-variant/40 bg-surface-container-low text-xs">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-on-surface-variant transition-colors hover:bg-surface-container"
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="material-symbols-outlined shrink-0 text-sm">photo_camera</span>
          <span className="truncate">{summary}</span>
        </div>
        <span className="material-symbols-outlined shrink-0 text-sm transition-transform duration-200" style={{ transform: expanded ? "rotate(180deg)" : "none" }}>
          expand_more
        </span>
      </button>
      {expanded && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-outline-variant/30 px-4 py-3">
          {rows.map(({ label, value }) => (
            <div key={label} className="contents">
              <span className="truncate font-semibold text-outline">{label}</span>
              <span className="truncate text-on-surface-variant" title={value}>{value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function fileFormat(file: File) {
  if (file.type === "image/tiff") return "TIFF";
  if (file.type === "image/jpeg") return "JPEG";
  return file.type.split("/")[1]?.toUpperCase() ?? "IMAGE";
}

function NewUploadContent() {
  const { lang } = useLang();
  const copy = NEW_UPLOAD_COPY[lang];
  const todayDate = localTodayDateValue();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlsRef = useRef(new Set<string>());

  const [categories, setCategories] = useState<ImageCategory[]>(() => [...DEFAULT_IMAGE_CATEGORIES]);
  const [drafts, setDrafts] = useState<UploadDraft[]>([]);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [copyrightLicense, setCopyrightLicense] = useState<CopyrightLicenseCode>("standard");
  const [freeUsagePolicy, setFreeUsagePolicy] = useState<FreeUsagePolicyCode>("none");
  const [attributionName, setAttributionName] = useState("");
  const [attributionUrl, setAttributionUrl] = useState("");
  const [authorshipDeclaration, setAuthorshipDeclaration] = useState<AuthorshipDeclaration | "">("");
  const [factualityAgreed, setFactualityAgreed] = useState(false);
  const [promotionalUseAllowed, setPromotionalUseAllowed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pageDone, setPageDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [noticeMsg, setNoticeMsg] = useState("");

  const activeDraft = useMemo(
    () => drafts.find((draft) => draft.id === activeDraftId) ?? drafts[0] ?? null,
    [activeDraftId, drafts],
  );
  const activeDimensions = activeDraft
    ? rotatedDimensions(activeDraft.imgWidth, activeDraft.imgHeight, activeDraft.rotationDegrees)
    : { width: null, height: null };
  const batchBusy = submitting || drafts.some((draft) => draft.uploadStatus === "uploading" || draft.uploadStatus === "saving");
  const canSubmit = canSubmitUploadBatch({
    drafts,
    authorshipDeclaration,
    factualityAgreed,
    busy: batchBusy,
  });
  const activeTakenAtIsFuture = Boolean(activeDraft && takenAtIsFuture(activeDraft.takenAt, todayDate));

  useEffect(() => {
    const previewUrls = previewUrlsRef.current;
    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
      previewUrls.clear();
    };
  }, []);

  useEffect(() => {
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data: { categories?: ImageCategory[] }) => {
        const next = data.categories?.length ? data.categories : [...DEFAULT_IMAGE_CATEGORIES];
        setCategories(next);
        setDrafts((current) => {
          const allowed = new Set(next.map((category) => category.code));
          const fallback = next[0]?.code ?? "nature";
          return current.map((draft) => {
            const filtered = draft.categoryCodes.filter((code) => allowed.has(code));
            return { ...draft, categoryCodes: filtered.length > 0 ? filtered : [fallback] };
          });
        });
      })
      .catch(() => {});
  }, []);

  function updateDraft(id: string, updater: (draft: UploadDraft) => UploadDraft) {
    setDrafts((current) => current.map((draft) => draft.id === id ? updater(draft) : draft));
  }

  function patchActiveDraft(patch: Partial<UploadDraft>) {
    if (!activeDraft) return;
    updateDraft(activeDraft.id, (draft) => ({ ...draft, ...patch }));
  }

  function createDraft(file: File, defaultCategoryCodes: string[]): UploadDraft {
    const preview = URL.createObjectURL(file);
    previewUrlsRef.current.add(preview);
    return {
      id: uploadFileClientId(file),
      file,
      preview,
      title: "",
      description: "",
      localizedDraft: cloneLocalizedDraft(EMPTY_LOCALIZED_DRAFT),
      categoryCodes: defaultCategoryCodes.length > 0 ? [...defaultCategoryCodes] : [categories[0]?.code ?? "nature"],
      tags: "",
      takenAt: "",
      takenAtSource: "manual",
      location: "",
      locationSource: "manual",
      rotationDegrees: 0,
      imgWidth: null,
      imgHeight: null,
      aiStatus: "idle",
      exifData: null,
      uploadStatus: "idle",
      progress: 0,
      errorMsg: "",
    };
  }

  function loadImageDimensions(id: string, file: File) {
    if (file.type === "image/tiff") return;
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      updateDraft(id, (draft) => ({ ...draft, imgWidth: img.naturalWidth, imgHeight: img.naturalHeight }));
      URL.revokeObjectURL(url);
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  }

  async function resizeForAI(file: File): Promise<string> {
    if (file.type === "image/tiff") {
      // Browsers cannot reliably resize TIFF files. Sending the original TIFF as
      // base64 can exceed the route body limit, so use filename/EXIF fallback.
      return "";
    }

    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new window.Image();
      img.onload = () => {
        const max = 800;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
      };
      img.src = url;
    });
  }

  async function runAiAnalysis(draftId: string, file: File) {
    updateDraft(draftId, (draft) => ({ ...draft, aiStatus: "analyzing" }));
    try {
      const [exif, imageBase64] = await Promise.all([
        extractExif(file),
        resizeForAI(file),
      ]);

      updateDraft(draftId, (draft) => ({
        ...draft,
        exifData: exif,
        takenAt: exif?.takenAt ? exif.takenAt.toISOString().slice(0, 10) : draft.takenAt,
        takenAtSource: exif?.takenAt ? "exif" : draft.takenAtSource,
        location: exif?.locationLabel ?? draft.location,
        locationSource: exif?.locationLabel ? "exif" : draft.locationSource,
      }));

      const aiRes = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64,
          filename: file.name,
          language: lang,
          exifData: exif
            ? {
                locationLabel: exif.locationLabel ?? undefined,
                camera: exif.camera ?? undefined,
                takenAt: exif.takenAt?.toISOString() ?? undefined,
                lat: exif.lat ?? undefined,
                lng: exif.lng ?? undefined,
              }
            : undefined,
        }),
      });

      if (!aiRes.ok) {
        updateDraft(draftId, (draft) => ({ ...draft, aiStatus: "failed" }));
        return;
      }

      const {
        title: aiTitle,
        caption,
        tags: aiTags,
        category: aiCategory,
        title_ko,
        title_en,
        caption_ko,
        caption_en,
        tags_ko,
        tags_en,
      } = await aiRes.json();
      const aiTagList = Array.isArray(aiTags) ? aiTags : [];
      const categoryExists = typeof aiCategory === "string" && categories.some((item) => item.code === aiCategory);
      const filled = !!(aiTitle || caption || aiTagList.length > 0);

      updateDraft(draftId, (draft) => ({
        ...draft,
        title: aiTitle || draft.title,
        description: caption || draft.description,
        tags: aiTagList.length > 0 ? aiTagList.join(", ") : draft.tags,
        localizedDraft: {
          title_ko: title_ko || (lang === "ko" ? aiTitle : "") || draft.localizedDraft.title_ko,
          title_en: title_en || (lang === "en" ? aiTitle : "") || draft.localizedDraft.title_en,
          description_ko: caption_ko || (lang === "ko" ? caption : "") || draft.localizedDraft.description_ko,
          description_en: caption_en || (lang === "en" ? caption : "") || draft.localizedDraft.description_en,
          tags_ko: Array.isArray(tags_ko) ? tags_ko : lang === "ko" && aiTagList.length > 0 ? aiTagList : draft.localizedDraft.tags_ko,
          tags_en: Array.isArray(tags_en) ? tags_en : lang === "en" && aiTagList.length > 0 ? aiTagList : draft.localizedDraft.tags_en,
        },
        categoryCodes: categoryExists
          ? [aiCategory, ...draft.categoryCodes.filter((code) => code !== aiCategory)]
          : draft.categoryCodes,
        aiStatus: filled ? "done" : "failed",
      }));
    } catch {
      updateDraft(draftId, (draft) => ({ ...draft, aiStatus: "failed" }));
    }
  }

  function handleFiles(files: FileList | File[]) {
    const incoming = Array.from(files);
    if (incoming.length === 0) return;

    const result = filterAcceptedUploadFiles(incoming);
    const existingIds = new Set(drafts.map((draft) => draft.id));
    const uniqueNewFiles = result.accepted.filter((file) => !existingIds.has(uploadFileClientId(file)));
    const limited = takeAvailableUploadSlots(uniqueNewFiles, drafts.length);
    const newFiles = limited.accepted;
    const messages = result.rejected.map(({ file, reason }) => (
      reason === "too-large"
        ? `${file.name}: ${copy.errors.tooLarge(MAX_UPLOAD_SIZE_MB)}`
        : `${file.name}: ${copy.errors.unsupportedType}`
    ));

    if (result.accepted.length > 0 && newFiles.length === 0) {
      messages.push(uniqueNewFiles.length === 0 ? copy.errors.duplicate : copy.errors.batchLimit(MAX_UPLOAD_BATCH_FILES));
    } else if (limited.overflow.length > 0) {
      messages.push(copy.errors.batchLimit(MAX_UPLOAD_BATCH_FILES));
    }

    const defaultCategoryCodes = activeDraft?.categoryCodes ?? [categories[0]?.code ?? "nature"];
    const newDrafts = newFiles.map((file) => createDraft(file, defaultCategoryCodes));

    if (newDrafts.length > 0) {
      setDrafts((current) => [...current, ...newDrafts]);
      setActiveDraftId((current) => current ?? newDrafts[0].id);
      setPageDone(false);
      setNoticeMsg("");
      newDrafts.forEach((draft) => {
        loadImageDimensions(draft.id, draft.file);
        runAiAnalysis(draft.id, draft.file);
      });
    }

    setErrorMsg(messages.join(" / "));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  }

  function removeDraft(id: string) {
    setDrafts((current) => {
      const removed = current.find((draft) => draft.id === id);
      if (removed) {
        URL.revokeObjectURL(removed.preview);
        previewUrlsRef.current.delete(removed.preview);
      }
      const next = current.filter((draft) => draft.id !== id);
      if (activeDraftId === id) setActiveDraftId(next[0]?.id ?? null);
      return next;
    });
  }

  function toggleActiveCategory(code: string) {
    if (!activeDraft) return;
    updateDraft(activeDraft.id, (draft) => {
      if (draft.categoryCodes.includes(code)) {
        return {
          ...draft,
          categoryCodes: draft.categoryCodes.length > 1
            ? draft.categoryCodes.filter((item) => item !== code)
            : draft.categoryCodes,
        };
      }
      return { ...draft, categoryCodes: [...draft.categoryCodes, code] };
    });
  }

  function copyActiveFieldsToAll() {
    if (!activeDraft || drafts.length <= 1) return;
    setDrafts((current) => current.map((draft) => (
      draft.id === activeDraft.id
        ? draft
        : {
            ...draft,
            title: activeDraft.title,
            description: activeDraft.description,
            localizedDraft: cloneLocalizedDraft(activeDraft.localizedDraft),
            categoryCodes: [...activeDraft.categoryCodes],
            tags: activeDraft.tags,
            takenAt: activeDraft.takenAt,
            takenAtSource: activeDraft.takenAtSource,
            location: activeDraft.location,
            locationSource: activeDraft.locationSource,
            uploadStatus: draft.uploadStatus === "done" ? "done" : "idle",
            errorMsg: "",
          }
    )));
    setErrorMsg("");
    setNoticeMsg(copy.copiedToAll);
  }

  function draftStatusLabel(draft: UploadDraft) {
    if (draft.uploadStatus === "uploading") return copy.uploadingFile;
    if (draft.uploadStatus === "saving") return copy.savingFile;
    if (draft.uploadStatus === "done") return copy.uploadedFile;
    if (draft.uploadStatus === "error") return copy.failedFile;
    return copy.pending;
  }

  async function uploadOriginalFile(draft: UploadDraft, uploadUrl: string) {
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader("Content-Type", draft.file.type);
      xhr.upload.addEventListener("progress", (ev) => {
        if (!ev.lengthComputable) return;
        updateDraft(draft.id, (current) => ({ ...current, progress: Math.round((ev.loaded / ev.total) * 100) }));
      });
      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`Upload failed: ${xhr.status}`));
      });
      xhr.addEventListener("error", reject);
      xhr.send(draft.file);
    });
  }

  async function submitDraft(draft: UploadDraft) {
    updateDraft(draft.id, (current) => ({ ...current, uploadStatus: "uploading", progress: 0, errorMsg: "" }));

    const presignRes = await fetch("/api/uploads/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: draft.file.name, contentType: draft.file.type }),
    });
    if (!presignRes.ok) throw new Error("Failed to get upload URL");
    const { uploadUrl, storagePath } = await presignRes.json() as { uploadUrl: string; storagePath: string };

    await uploadOriginalFile(draft, uploadUrl);
    updateDraft(draft.id, (current) => ({ ...current, uploadStatus: "saving", progress: 100 }));

    const tagList = draft.tags.split(",").map((tag) => tag.trim()).filter(Boolean);
    const display = rotatedDimensions(draft.imgWidth, draft.imgHeight, draft.rotationDegrees);

    const saveRes = await fetch("/api/uploads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        original_filename: draft.file.name,
        title: draft.title.trim(),
        description: draft.description.trim(),
        title_ko: lang === "ko" ? draft.title.trim() : draft.localizedDraft.title_ko,
        title_en: lang === "en" ? draft.title.trim() : draft.localizedDraft.title_en,
        description_ko: lang === "ko" ? draft.description.trim() : draft.localizedDraft.description_ko,
        description_en: lang === "en" ? draft.description.trim() : draft.localizedDraft.description_en,
        tags_ko: lang === "ko" ? tagList : draft.localizedDraft.tags_ko,
        tags_en: lang === "en" ? tagList : draft.localizedDraft.tags_en,
        category: draft.categoryCodes[0],
        category_codes: draft.categoryCodes,
        tags: tagList,
        storage_path_original: storagePath,
        file_size_mb: parseFloat((draft.file.size / 1024 / 1024).toFixed(2)),
        file_format: fileFormat(draft.file),
        width: display.width,
        height: display.height,
        resolution_mp: display.width && display.height ? parseFloat(((display.width * display.height) / 1_000_000).toFixed(1)) : null,
        upload_rotation_degrees: draft.rotationDegrees,
        upload_original_width: draft.imgWidth,
        upload_original_height: draft.imgHeight,
        exif_taken_at: draft.takenAt === UNKNOWN ? null : draft.takenAt || null,
        exif_taken_at_unknown: draft.takenAt === UNKNOWN,
        exif_location: draft.location || null,
        exif_lat: draft.exifData?.lat ?? null,
        exif_lng: draft.exifData?.lng ?? null,
        exif_camera: draft.exifData?.camera ?? null,
        copyright_license: copyrightLicense,
        free_usage_policy: freeUsagePolicy,
        attribution_name: copyrightLicense !== "standard" && copyrightLicense !== "cc0" ? attributionName.trim() || null : null,
        attribution_url: copyrightLicense !== "standard" && copyrightLicense !== "cc0" ? attributionUrl.trim() || null : null,
        authorship_declaration: authorshipDeclaration,
        factuality_attested: factualityAgreed,
        promotional_use_allowed: promotionalUseAllowed,
      }),
    });

    if (!saveRes.ok) {
      const err = await saveRes.json().catch(() => null) as { error?: string } | null;
      throw new Error(err?.error ?? "Failed to save");
    }

    updateDraft(draft.id, (current) => ({ ...current, uploadStatus: "done", progress: 100, errorMsg: "" }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) {
      setErrorMsg(drafts.length === 0 ? copy.noFiles : copy.errors.uploadFailed);
      return;
    }

    setSubmitting(true);
    setErrorMsg("");
    setNoticeMsg("");
    let failed = 0;

    for (const draft of drafts.filter((item) => item.uploadStatus !== "done")) {
      try {
        await submitDraft(draft);
      } catch (err) {
        failed += 1;
        updateDraft(draft.id, (current) => ({
          ...current,
          uploadStatus: "error",
          errorMsg: err instanceof Error ? err.message : copy.errors.uploadFailed,
        }));
      }
    }

    setSubmitting(false);
    if (failed > 0) {
      setErrorMsg(copy.partialFailed(failed));
      return;
    }

    setPageDone(true);
    setTimeout(() => router.push("/dashboard/uploads"), 1500);
  }

  return (
    <div className="max-w-7xl p-6 md:p-10">
      <div className="mb-8 flex items-center gap-3">
        <Link href="/dashboard/uploads" className="text-outline transition-colors hover:text-on-surface">
          <span className="material-symbols-outlined text-xl">arrow_back</span>
        </Link>
        <div>
          <h1 className="font-headline text-2xl font-extrabold tracking-tight text-on-surface">{copy.pageTitle}</h1>
          {drafts.length > 0 && <p className="mt-1 text-xs text-outline">{copy.fileCount(drafts.length)}</p>}
        </div>
      </div>

      {pageDone && (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <span className="material-symbols-outlined text-6xl text-primary">check_circle</span>
          <h2 className="font-headline text-xl font-extrabold text-on-surface">{copy.doneTitle}</h2>
          <p className="text-sm text-on-surface-variant">{copy.doneBody}</p>
        </div>
      )}

      {!pageDone && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center gap-4 rounded-xl border-2 border-dashed border-outline-variant p-6 transition-all hover:border-primary hover:bg-primary/5 md:p-8"
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPTED_UPLOAD_TYPES.join(",")}
              className="sr-only"
              onChange={(e) => handleFiles(e.target.files ?? [])}
            />
            <span className="material-symbols-outlined text-5xl text-outline">cloud_upload</span>
            <div className="text-center">
              <p className="text-sm font-semibold text-on-surface">{drafts.length > 0 ? copy.addMore : copy.dropTitle}</p>
              <p className="mt-1 text-xs text-outline">{copy.dropHelp}</p>
            </div>
          </div>

          {drafts.length > 0 && (
            <div className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-4">
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-bold text-on-surface">{copy.queueTitle}</p>
                  <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-outline">{copy.queueHelp}</p>
                </div>
                <button
                  type="button"
                  onClick={copyActiveFieldsToAll}
                  disabled={!activeDraft || drafts.length <= 1}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded border border-outline-variant px-3 text-xs font-bold text-on-surface-variant transition-colors hover:border-outline hover:text-on-surface disabled:opacity-40"
                >
                  <span className="material-symbols-outlined text-base">content_copy</span>
                  {copy.copyToAll}
                </button>
              </div>
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {drafts.map((draft) => {
                  const active = activeDraft?.id === draft.id;
                  return (
                    <div
                      key={draft.id}
                      className={[
                        "flex min-w-0 items-center gap-3 rounded-lg border p-2 transition-colors",
                        active ? "border-primary bg-primary/5" : "border-outline-variant/40 bg-surface-container-low",
                      ].join(" ")}
                    >
                      <button
                        type="button"
                        onClick={() => setActiveDraftId(draft.id)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <div className="h-12 w-16 shrink-0 overflow-hidden rounded bg-surface-container">
                          <Image src={draft.preview} alt="" width={64} height={48} className="h-full w-full object-cover" unoptimized />
                        </div>
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-bold text-on-surface">{draft.file.name}</span>
                          <span className="mt-1 flex items-center gap-1 text-[11px] text-outline">
                            {active && <span className="font-semibold text-primary">{copy.activeFile}</span>}
                            {active && <span>·</span>}
                            <span>{draftStatusLabel(draft)}</span>
                            {draft.uploadStatus === "uploading" && <span>· {draft.progress}%</span>}
                          </span>
                          {draft.errorMsg && <span className="mt-1 block truncate text-[11px] text-error">{draft.errorMsg}</span>}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeDraft(draft.id)}
                        disabled={draft.uploadStatus === "uploading" || draft.uploadStatus === "saving"}
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded text-outline transition-colors hover:bg-surface-container-high hover:text-on-surface disabled:opacity-40"
                        aria-label={copy.remove}
                      >
                        <span className="material-symbols-outlined text-base">close</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeDraft && (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
              <section className="flex flex-col gap-4">
                <div className={previewContainerClass(activeDimensions.width, activeDimensions.height)}>
                  <Image
                    src={activeDraft.preview}
                    alt="Preview"
                    width={activeDraft.imgWidth ?? 900}
                    height={activeDraft.imgHeight ?? 600}
                    className="block max-h-[72vh] h-auto w-full object-contain transition-transform duration-200"
                    style={{ transform: activeDraft.rotationDegrees ? `rotate(${activeDraft.rotationDegrees}deg)` : "none" }}
                    unoptimized
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-outline">
                    <span className="material-symbols-outlined text-sm">insert_drive_file</span>
                    <span className="max-w-xs truncate font-mono">{activeDraft.file.name}</span>
                    <span>·</span>
                    <span>{(activeDraft.file.size / 1024 / 1024).toFixed(1)} MB</span>
                    {activeDimensions.width && activeDimensions.height && (
                      <>
                        <span>·</span>
                        <span>{activeDimensions.width.toLocaleString()} × {activeDimensions.height.toLocaleString()} px</span>
                      </>
                    )}
                    {activeDraft.rotationDegrees > 0 && (
                      <>
                        <span>·</span>
                        <span>{activeDraft.rotationDegrees}° {copy.rotated}</span>
                      </>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => patchActiveDraft({ rotationDegrees: normalizeRotationDegrees(activeDraft.rotationDegrees + 270), uploadStatus: activeDraft.uploadStatus === "done" ? "done" : "idle" })}
                      className="flex h-9 items-center gap-1.5 rounded-lg border border-outline-variant px-3 text-xs font-bold text-on-surface-variant hover:border-outline hover:text-on-surface"
                    >
                      <span className="material-symbols-outlined text-sm">rotate_left</span>
                      {copy.rotateLeft}
                    </button>
                    <button
                      type="button"
                      onClick={() => patchActiveDraft({ rotationDegrees: normalizeRotationDegrees(activeDraft.rotationDegrees + 90), uploadStatus: activeDraft.uploadStatus === "done" ? "done" : "idle" })}
                      className="flex h-9 items-center gap-1.5 rounded-lg border border-outline-variant px-3 text-xs font-bold text-on-surface-variant hover:border-outline hover:text-on-surface"
                    >
                      <span className="material-symbols-outlined text-sm">rotate_right</span>
                      {copy.rotateRight}
                    </button>
                    {activeDraft.rotationDegrees > 0 && (
                      <button
                        type="button"
                        onClick={() => patchActiveDraft({ rotationDegrees: 0, uploadStatus: activeDraft.uploadStatus === "done" ? "done" : "idle" })}
                        className="flex h-9 items-center gap-1.5 rounded-lg border border-outline-variant px-3 text-xs font-bold text-outline hover:border-outline hover:text-on-surface"
                      >
                        <span className="material-symbols-outlined text-sm">restart_alt</span>
                        {copy.reset}
                      </button>
                    )}
                    <span className="text-[11px] text-outline">{copy.rotationHelp}</span>
                  </div>
                  {activeDraft.exifData && <ExifPanel data={activeDraft.exifData} lang={lang} labels={copy.exifLabels} />}
                </div>
              </section>

              <section className="flex flex-col gap-6">
                {activeDraft.aiStatus === "analyzing" && (
                  <div className="flex items-center gap-2 text-sm text-on-surface-variant">
                    <span className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    {copy.aiAnalyzing}
                  </div>
                )}
                {activeDraft.aiStatus === "done" && (
                  <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                    <span className="material-symbols-outlined text-base">auto_awesome</span>
                    {copy.aiDone}
                  </div>
                )}
                {activeDraft.aiStatus === "failed" && (
                  <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    <span className="material-symbols-outlined text-base">info</span>
                    {copy.aiFailed}
                  </div>
                )}

                {(activeDraft.uploadStatus === "uploading" || activeDraft.uploadStatus === "saving") && (
                  <div>
                    <div className="mb-1 flex justify-between text-xs text-outline">
                      <span>{activeDraft.uploadStatus === "saving" ? copy.saving : copy.uploading}</span>
                      <span>{activeDraft.progress}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-container-low">
                      <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${activeDraft.progress}%` }} />
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-outline">
                    {copy.title}
                    {activeDraft.aiStatus === "done" && activeDraft.title && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-normal normal-case text-primary">{copy.aiGenerated}</span>
                    )}
                  </label>
                  <input
                    type="text"
                    required
                    value={activeDraft.title}
                    onChange={(e) => patchActiveDraft({ title: e.target.value, uploadStatus: activeDraft.uploadStatus === "done" ? "done" : "idle", errorMsg: "" })}
                    placeholder={activeDraft.aiStatus === "analyzing" ? copy.titlePlaceholderAnalyzing : copy.titlePlaceholder}
                    className="h-12 rounded-lg bg-surface-container-lowest px-4 text-sm text-on-surface outline-none ring-1 ring-outline-variant transition-all placeholder:text-outline focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-outline">{copy.description}</label>
                  <textarea
                    required
                    value={activeDraft.description}
                    onChange={(e) => patchActiveDraft({ description: e.target.value, uploadStatus: activeDraft.uploadStatus === "done" ? "done" : "idle", errorMsg: "" })}
                    rows={3}
                    placeholder={copy.descriptionPlaceholder}
                    className="resize-none rounded-lg bg-surface-container-lowest px-4 py-3 text-sm text-on-surface outline-none ring-1 ring-outline-variant transition-all placeholder:text-outline focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-outline">{copy.category}</label>
                  <div className="flex flex-wrap gap-2">
                    {categories.map((item) => {
                      const checked = activeDraft.categoryCodes.includes(item.code);
                      return (
                        <button
                          key={item.code}
                          type="button"
                          onClick={() => toggleActiveCategory(item.code)}
                          className={[
                            "inline-flex h-10 items-center gap-2 rounded-full border px-3 text-xs font-bold transition-colors",
                            checked ? "border-primary bg-primary/10 text-primary" : "border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:border-outline",
                          ].join(" ")}
                        >
                          <span className="material-symbols-outlined text-base">{checked ? "check_circle" : "radio_button_unchecked"}</span>
                          {item[lang]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-outline">{copy.tags}</label>
                  <input
                    type="text"
                    value={activeDraft.tags}
                    onChange={(e) => patchActiveDraft({ tags: e.target.value, uploadStatus: activeDraft.uploadStatus === "done" ? "done" : "idle", errorMsg: "" })}
                    placeholder={copy.tagsPlaceholder}
                    className="h-12 rounded-lg bg-surface-container-lowest px-4 text-sm text-on-surface outline-none ring-1 ring-outline-variant transition-all placeholder:text-outline focus:ring-2 focus:ring-primary"
                  />
                  {activeDraft.tags && activeDraft.tags.split(",").map((tag) => tag.trim()).filter(Boolean).length === 0 && (
                    <p className="text-xs text-error">{copy.tagsError}</p>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-outline">
                      {copy.shotAt}
                      {activeDraft.takenAtSource === "exif" && (
                        <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-normal normal-case text-primary">{copy.exifAuto}</span>
                      )}
                    </label>
                    {activeDraft.takenAt === UNKNOWN ? (
                      <div className="flex items-center gap-2">
                        <div className="flex h-12 flex-1 items-center rounded-lg bg-surface-container-low px-4 text-sm text-outline ring-1 ring-outline-variant/50">
                          {copy.unknownFull}
                        </div>
                        <button
                          type="button"
                          onClick={() => patchActiveDraft({ takenAt: "", takenAtSource: "manual" })}
                          className="h-12 rounded-lg border border-outline-variant px-4 text-xs text-outline transition-colors hover:text-on-surface"
                        >
                          {copy.manualInput}
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <input
                          type="date"
                          max={todayDate}
                          value={activeDraft.takenAt}
                          onChange={(e) => patchActiveDraft({ takenAt: e.target.value, takenAtSource: "manual" })}
                          aria-invalid={activeTakenAtIsFuture}
                          className={`h-12 flex-1 rounded-lg bg-surface-container-lowest px-4 text-sm text-on-surface outline-none ring-1 transition-all focus:ring-2 ${activeTakenAtIsFuture ? "ring-error focus:ring-error" : "ring-outline-variant focus:ring-primary"}`}
                        />
                        <button
                          type="button"
                          onClick={() => patchActiveDraft({ takenAt: UNKNOWN, takenAtSource: "manual" })}
                          className="h-12 whitespace-nowrap rounded-lg border border-outline-variant px-4 text-xs text-outline transition-colors hover:text-on-surface"
                        >
                          {copy.unknown}
                        </button>
                      </div>
                    )}
                    {activeTakenAtIsFuture
                      ? <p className="text-xs text-error">{copy.shotAtFutureError}</p>
                      : !activeDraft.takenAt && activeDraft.aiStatus !== "analyzing" && <p className="text-xs text-error">{copy.shotAtError}</p>}
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-outline">
                      {copy.shotLocation}
                      {activeDraft.locationSource === "exif" && (
                        <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-normal normal-case text-primary">{copy.exifAuto}</span>
                      )}
                    </label>
                    {activeDraft.location === UNKNOWN ? (
                      <div className="flex items-center gap-2">
                        <div className="flex h-12 flex-1 items-center rounded-lg bg-surface-container-low px-4 text-sm text-outline ring-1 ring-outline-variant/50">
                          {copy.unknownFull}
                        </div>
                        <button
                          type="button"
                          onClick={() => patchActiveDraft({ location: "", locationSource: "manual" })}
                          className="h-12 rounded-lg border border-outline-variant px-4 text-xs text-outline transition-colors hover:text-on-surface"
                        >
                          {copy.manualInput}
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2">
                        <LocationAutocomplete
                          lang={lang}
                          value={activeDraft.location}
                          onChange={(location) => patchActiveDraft({ location, locationSource: "manual" })}
                          placeholder={copy.locationPlaceholder}
                        />
                        <button
                          type="button"
                          onClick={() => patchActiveDraft({ location: UNKNOWN, locationSource: "manual" })}
                          className="h-12 whitespace-nowrap rounded-lg border border-outline-variant px-4 text-xs text-outline transition-colors hover:text-on-surface"
                        >
                          {copy.unknown}
                        </button>
                      </div>
                    )}
                    {!activeDraft.location && activeDraft.aiStatus !== "analyzing" && <p className="text-xs text-error">{copy.locationError}</p>}
                  </div>
                </div>
              </section>
            </div>
          )}

          {drafts.length > 0 && (
            <>
              <div className="flex flex-col gap-4 rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-outline">{copy.copyrightTitle}</p>
                  <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">{copy.copyrightHelp}</p>
                </div>

                <CopyrightLicenseStepper
                  lang={lang}
                  copyrightLicense={copyrightLicense}
                  freeUsagePolicy={freeUsagePolicy}
                  onCopyrightLicenseChange={setCopyrightLicense}
                  onFreeUsagePolicyChange={setFreeUsagePolicy}
                />

                {copyrightLicense !== "standard" && copyrightLicense !== "cc0" && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-outline">{copy.attributionName}</label>
                      <input
                        type="text"
                        value={attributionName}
                        onChange={(e) => setAttributionName(e.target.value)}
                        placeholder={copy.attributionPlaceholder}
                        className="h-11 rounded-lg bg-surface-container-lowest px-4 text-sm text-on-surface outline-none ring-1 ring-outline-variant transition-all placeholder:text-outline focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-outline">{copy.attributionUrl}</label>
                      <input
                        type="url"
                        value={attributionUrl}
                        onChange={(e) => setAttributionUrl(e.target.value)}
                        placeholder="https://..."
                        className="h-11 rounded-lg bg-surface-container-lowest px-4 text-sm text-on-surface outline-none ring-1 ring-outline-variant transition-all placeholder:text-outline focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3 rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-outline">{copy.authorshipTitle}</p>
                  <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">{copy.authorshipHelp}</p>
                </div>

                <label
                  className={[
                    "flex cursor-pointer gap-3 rounded-lg border px-4 py-3 transition-colors",
                    authorshipDeclaration === "human_original" ? "border-primary bg-primary/5" : "border-outline-variant/40 bg-surface-container-low hover:border-outline",
                  ].join(" ")}
                >
                  <input
                    type="radio"
                    name="authorship_declaration"
                    value="human_original"
                    checked={authorshipDeclaration === "human_original"}
                    onChange={() => setAuthorshipDeclaration("human_original")}
                    className="mt-1 h-4 w-4 shrink-0 accent-primary"
                  />
                  <span>
                    <span className="block text-sm font-bold text-on-surface">{copy.humanTitle}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-on-surface-variant">{copy.humanBody}</span>
                  </span>
                </label>

                <label
                  className={[
                    "flex cursor-pointer gap-3 rounded-lg border px-4 py-3 transition-colors",
                    authorshipDeclaration === "ai_generated" ? "border-primary bg-primary/5" : "border-outline-variant/40 bg-surface-container-low hover:border-outline",
                  ].join(" ")}
                >
                  <input
                    type="radio"
                    name="authorship_declaration"
                    value="ai_generated"
                    checked={authorshipDeclaration === "ai_generated"}
                    onChange={() => setAuthorshipDeclaration("ai_generated")}
                    className="mt-1 h-4 w-4 shrink-0 accent-primary"
                  />
                  <span>
                    <span className="block text-sm font-bold text-on-surface">{copy.aiTitle}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-on-surface-variant">{copy.aiBody}</span>
                  </span>
                </label>

                {!authorshipDeclaration && <p className="text-xs text-error">{copy.authorshipError}</p>}
              </div>

              <label className="flex cursor-pointer gap-3 rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-5 transition-colors hover:border-outline">
                <input
                  type="checkbox"
                  checked={factualityAgreed}
                  onChange={(e) => setFactualityAgreed(e.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0 accent-primary"
                />
                <span>
                  <span className="block text-sm font-bold text-on-surface">{copy.factualityTitle}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-on-surface-variant">{copy.factualityBody}</span>
                  {!factualityAgreed && <span className="mt-2 block text-xs text-error">{copy.factualityError}</span>}
                </span>
              </label>

              <label className="flex cursor-pointer gap-3 rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-5 transition-colors hover:border-primary/50">
                <input
                  type="checkbox"
                  checked={promotionalUseAllowed}
                  onChange={(e) => setPromotionalUseAllowed(e.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0 accent-primary"
                />
                <span>
                  <span className="block text-sm font-bold text-on-surface">{copy.promotionalTitle}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-on-surface-variant">{copy.promotionalBody}</span>
                </span>
              </label>
            </>
          )}

          {errorMsg && (
            <div className="flex items-center gap-2 rounded-lg border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
              <span className="material-symbols-outlined text-base">error</span>
              {errorMsg}
            </div>
          )}

          {noticeMsg && (
            <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
              <span className="material-symbols-outlined text-base">check_circle</span>
              {noticeMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="flex w-full items-center justify-center gap-2 rounded bg-primary py-4 text-xs font-bold uppercase tracking-widest text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {batchBusy ? (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <span className="material-symbols-outlined text-base">cloud_upload</span>
            )}
            {copy.submit}
          </button>

          <p className="text-center text-xs leading-relaxed text-outline">{copy.reviewHelp}</p>
        </form>
      )}
    </div>
  );
}

export default function NewUploadPage() {
  return (
    <PhotographerApprovalGate>
      <NewUploadContent />
    </PhotographerApprovalGate>
  );
}
