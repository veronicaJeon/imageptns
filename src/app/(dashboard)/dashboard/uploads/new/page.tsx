"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useLang } from "@/lib/i18n/store";
import { extractExif, type ExifData } from "@/lib/utils/exif";
import { normalizeRotationDegrees, rotatedDimensions } from "@/lib/images/orientation";
import { localizedCopyrightLicenses, localizedFreeUsagePolicies, type CopyrightLicenseCode, type FreeUsagePolicyCode } from "@/lib/licenses/creative-commons";
import type { AuthorshipDeclaration } from "@/lib/onchain/registration";

const CATEGORIES = ["nature", "people", "editorial", "urban", "abstract", "architecture"] as const;
type Category = typeof CATEGORIES[number];

const ACCEPTED_TYPES = ["image/tiff", "image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_MB = 500;
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
      unsupportedType: "지원하지 않는 파일 형식입니다. TIFF, JPEG, PNG, WebP만 허용됩니다.",
      tooLarge: (max: number) => `파일 크기는 ${max}MB를 초과할 수 없습니다.`,
      uploadFailed: "업로드 중 오류가 발생했습니다.",
    },
    pageTitle: "이미지 업로드",
    doneTitle: "업로드 완료!",
    doneBody: "이미지가 검토 대기 중입니다. 승인 후 라이브러리에 노출됩니다.",
    dropTitle: "파일을 드래그하거나 클릭하여 선택",
    dropHelp: "TIFF, JPEG, PNG, WebP · 최대 500MB",
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
    locationPlaceholder: "예: Seoul, Korea",
    locationError: "촬영장소를 입력하거나 '미상'을 선택하세요.",
    copyrightTitle: "저작권 및 공개 범위 *",
    copyrightHelp: "사진별로 Creative Commons 등급과 무료 사용 조건을 지정합니다. 상업 라이선스 판매가 필요한 경우 기본 정책을 유지하세요.",
    freeHelpBefore: "무료로 공개하려면 무료 사용 정책에서",
    freeAll: "전체 무료",
    freeEducation: "교육용 무료",
    freeHelpAfter: "를 선택하세요. CC0/CC BY 계열을 선택하면 라이브러리에서도 해당 저작권 등급이 함께 표시됩니다.",
    attributionName: "출처 표기명",
    attributionPlaceholder: "예: 작가명 또는 스튜디오명",
    attributionUrl: "출처 URL",
    authorshipTitle: "AI 및 오리지널리티 보증 *",
    authorshipHelp: "플랫폼 운영 리스크 관리를 위해 업로드하는 이미지의 생성 방식을 반드시 선언해주세요.",
    humanTitle: "AI 이미지가 아니며, 본인의 오리지널리티가 있음을 보증합니다.",
    humanBody: "직접 촬영했거나 권리자로서 라이선스 판매 및 증명을 요청할 수 있는 이미지입니다.",
    aiTitle: "이 이미지는 AI 생성 이미지입니다.",
    aiBody: "AI 생성 또는 AI 보정 사실을 명시하며, 판매/배포 권한을 보유하고 있음을 확인합니다.",
    authorshipError: "AI 여부 또는 오리지널리티 보증을 선택해주세요.",
    factualityTitle: "업로드 내용 사실성 보증 *",
    factualityBody: "이번에 제출하는 사진, 제목, 설명, 캡션, 태그 및 관련 메타데이터가 사실과 부합하며, 제3자의 권리나 신원을 오인하게 만들지 않음을 확인합니다.",
    factualityError: "사실성 보증 동의가 필요합니다.",
    submit: "검토 제출",
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
      unsupportedType: "Unsupported file type. TIFF, JPEG, PNG, and WebP are allowed.",
      tooLarge: (max: number) => `File size must not exceed ${max}MB.`,
      uploadFailed: "An error occurred while uploading.",
    },
    pageTitle: "Upload image",
    doneTitle: "Upload complete",
    doneBody: "Your image is pending review. It will appear in the library after approval.",
    dropTitle: "Drag a file here or click to select",
    dropHelp: "TIFF, JPEG, PNG, WebP · up to 500MB",
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
    locationPlaceholder: "Example: Seoul, Korea",
    locationError: "Enter the location taken or choose Unknown.",
    copyrightTitle: "Copyright and release scope *",
    copyrightHelp: "Set the Creative Commons level and free-use policy for this image. Keep the standard policy if you want to sell commercial licenses.",
    freeHelpBefore: "To publish this as free, choose",
    freeAll: "Free for all uses",
    freeEducation: "Free for education",
    freeHelpAfter: "in the free-use policy. CC0/CC BY-family choices will also be shown in the library.",
    attributionName: "Credit name",
    attributionPlaceholder: "Example: photographer or studio name",
    attributionUrl: "Credit URL",
    authorshipTitle: "AI and originality declaration *",
    authorshipHelp: "To manage platform risk, declare how this image was created.",
    humanTitle: "This is not an AI image, and I attest to my originality.",
    humanBody: "This image was photographed by me, or I hold the rights needed to sell licenses and request proof.",
    aiTitle: "This is an AI-generated image.",
    aiBody: "I disclose AI generation or AI alteration and confirm that I hold the rights to sell or distribute it.",
    authorshipError: "Select whether this is AI-generated or originality-attested.",
    factualityTitle: "Factuality attestation *",
    factualityBody: "I confirm that the submitted image, title, description, caption, tags, and metadata are factual and do not mislead about third-party rights or identity.",
    factualityError: "Factuality attestation is required.",
    submit: "Submit for review",
    reviewHelp: "Submitted images appear in the library after operations review. Review usually takes 1-3 business days.",
  },
} as const;

type NewUploadLang = keyof typeof NEW_UPLOAD_COPY;
type ExifLabelCopy = Record<keyof typeof NEW_UPLOAD_COPY.ko.exifLabels, string>;

// ── Adaptive preview container based on aspect ratio ─────────────────────────
function previewContainerClass(w: number | null, h: number | null): string {
  if (!w || !h) return "w-full max-h-64 overflow-hidden rounded-lg";
  const r = w / h;
  if (r >= 1.35)  return "w-full overflow-hidden rounded-lg";              // landscape
  if (r <= 0.74)  return "max-w-[280px] mx-auto overflow-hidden rounded-lg"; // portrait
  return "max-w-[420px] mx-auto overflow-hidden rounded-lg";              // square-ish
}

// ── EXIF metadata display ─────────────────────────────────────────────────────
function ExifPanel({ data, lang, labels }: { data: ExifData; lang: NewUploadLang; labels: ExifLabelCopy }) {
  const [expanded, setExpanded] = useState(false);

  // Build structured rows
  const rows: { label: string; value: string }[] = [];

  if (data.takenAt)        rows.push({ label: labels.takenAt, value: data.takenAt.toLocaleString(lang === "ko" ? "ko-KR" : "en-US") });
  if (data.locationLabel)  rows.push({ label: labels.location, value: data.locationLabel });
  if (data.lat != null && data.lng != null)
    rows.push({ label: "GPS", value: `${data.lat.toFixed(6)}, ${data.lng.toFixed(6)}` });
  if (data.altitude != null) rows.push({ label: labels.altitude, value: `${data.altitude.toFixed(0)}m` });
  if (data.camera)         rows.push({ label: labels.camera, value: data.camera });
  if (data.lensModel)      rows.push({ label: labels.lens, value: data.lensModel });
  if (data.focalLength != null) {
    const fl = `${data.focalLength}mm${data.focalLength35mm ? ` (${data.focalLength35mm}mm ${labels.equivalent})` : ""}`;
    rows.push({ label: labels.focalLength, value: fl });
  }
  if (data.iso != null)        rows.push({ label: "ISO", value: String(data.iso) });
  if (data.aperture != null)   rows.push({ label: labels.aperture, value: `f/${data.aperture}` });
  if (data.shutterSpeed)       rows.push({ label: labels.shutterSpeed, value: data.shutterSpeed });
  if (data.flash)              rows.push({ label: labels.flash, value: data.flash });
  if (data.whiteBalance)       rows.push({ label: labels.whiteBalance, value: data.whiteBalance });
  if (data.exposureMode)       rows.push({ label: labels.exposureMode, value: data.exposureMode });
  if (data.meteringMode)       rows.push({ label: labels.meteringMode, value: data.meteringMode });
  if (data.colorSpace)         rows.push({ label: labels.colorSpace, value: data.colorSpace });
  if (data.orientation != null) rows.push({ label: labels.orientation, value: String(data.orientation) });
  if (data.software)           rows.push({ label: labels.software, value: data.software });

  // Raw additional fields
  for (const [k, v] of Object.entries(data.rawFields)) {
    if (rows.length >= 40) break;
    const val = v instanceof Date ? v.toLocaleString(lang === "ko" ? "ko-KR" : "en-US") : String(v);
    if (val.length > 120) continue;
    rows.push({ label: k, value: val });
  }

  if (rows.length === 0) return null;

  // Summary line: key exposure info
  const summaryParts: string[] = [];
  if (data.camera) summaryParts.push(data.camera);
  if (data.iso != null) summaryParts.push(`ISO ${data.iso}`);
  if (data.aperture != null) summaryParts.push(`f/${data.aperture}`);
  if (data.shutterSpeed) summaryParts.push(data.shutterSpeed);
  if (data.focalLength != null) summaryParts.push(`${data.focalLength}mm`);
  const summary = summaryParts.join(" · ") || rows[0].value;

  return (
    <div className="rounded-lg bg-surface-container-low border border-outline-variant/40 text-xs overflow-hidden">
      {/* Summary row — always visible */}
      <button
        type="button"
        onClick={() => setExpanded((x) => !x)}
        className="w-full flex items-center justify-between px-4 py-2.5 gap-3 text-on-surface-variant hover:bg-surface-container transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="material-symbols-outlined text-sm shrink-0">photo_camera</span>
          <span className="truncate">{summary}</span>
        </div>
        <span className="material-symbols-outlined text-sm shrink-0 transition-transform duration-200" style={{ transform: expanded ? "rotate(180deg)" : "none" }}>
          expand_more
        </span>
      </button>

      {/* Expanded grid */}
      {expanded && (
        <div className="border-t border-outline-variant/30 px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
          {rows.map(({ label, value }) => (
            <div key={label} className="contents">
              <span className="text-outline font-semibold truncate">{label}</span>
              <span className="text-on-surface-variant truncate" title={value}>{value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function NewUploadPage() {
  const { lang } = useLang();
  const copy = NEW_UPLOAD_COPY[lang];
  const copyrightLicenses = localizedCopyrightLicenses(lang);
  const freeUsagePolicies = localizedFreeUsagePolicies(lang);
  const router = useRouter();

  const [file, setFile]         = useState<File | null>(null);
  const [preview, setPreview]   = useState<string | null>(null);
  const [title, setTitle]       = useState("");
  const [description, setDesc]  = useState("");
  const [localizedDraft, setLocalizedDraft] = useState({
    title_ko: "",
    title_en: "",
    description_ko: "",
    description_en: "",
    tags_ko: [] as string[],
    tags_en: [] as string[],
  });
  const [category, setCategory] = useState<Category>("nature");
  const [tags, setTags]         = useState("");
  // 촬영일시: ISO date string | "unknown" | ""
  const [takenAt, setTakenAt]   = useState("");
  const [takenAtSource, setTakenAtSource] = useState<"exif" | "manual">("manual");
  // 촬영장소: text | "unknown" | ""
  const [location, setLocation] = useState("");
  const [locationSource, setLocationSource] = useState<"exif" | "manual">("manual");
  const [copyrightLicense, setCopyrightLicense] = useState<CopyrightLicenseCode>("standard");
  const [freeUsagePolicy, setFreeUsagePolicy] = useState<FreeUsagePolicyCode>("none");
  const [attributionName, setAttributionName] = useState("");
  const [attributionUrl, setAttributionUrl] = useState("");
  const [authorshipDeclaration, setAuthorshipDeclaration] = useState<AuthorshipDeclaration | "">("");
  const [factualityAgreed, setFactualityAgreed] = useState(false);
  const [rotationDegrees, setRotationDegrees] = useState(0);

  const [imgWidth, setImgWidth]   = useState<number | null>(null);
  const [imgHeight, setImgHeight] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus]     = useState<"idle" | "uploading" | "saving" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [aiStatus, setAiStatus] = useState<"idle" | "analyzing" | "done" | "failed">("idle");
  const [exifData, setExifData] = useState<ExifData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function resizeForAI(f: File): Promise<string> {
    if (f.type === "image/tiff") {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(f);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
      });
    }
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(f);
      const img = new window.Image();
      img.onload = () => {
        const MAX = 800;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        const reader = new FileReader();
        reader.readAsDataURL(f);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
      };
      img.src = url;
    });
  }

  async function runAiAnalysis(f: File) {
    setAiStatus("analyzing");
    try {
      const [exif, imageBase64] = await Promise.all([
        extractExif(f),
        resizeForAI(f),
      ]);

      setExifData(exif);

      // Pre-fill 촬영일시 / 촬영장소 from EXIF
      if (exif?.takenAt) {
        setTakenAt(exif.takenAt.toISOString().slice(0, 10));
        setTakenAtSource("exif");
      }
      if (exif?.locationLabel) {
        setLocation(exif.locationLabel);
        setLocationSource("exif");
      }

      const aiRes = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64,
          filename: f.name,
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

      if (!aiRes.ok) { setAiStatus("failed"); return; }

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
      const filled = !!(aiTitle || caption || (Array.isArray(aiTags) && aiTags.length > 0));

      if (aiTitle) setTitle(aiTitle);
      if (caption) setDesc(caption);
      if (Array.isArray(aiTags) && aiTags.length > 0) setTags(aiTags.join(", "));
      setLocalizedDraft({
        title_ko: title_ko || (lang === "ko" ? aiTitle : ""),
        title_en: title_en || (lang === "en" ? aiTitle : ""),
        description_ko: caption_ko || (lang === "ko" ? caption : ""),
        description_en: caption_en || (lang === "en" ? caption : ""),
        tags_ko: Array.isArray(tags_ko) ? tags_ko : lang === "ko" && Array.isArray(aiTags) ? aiTags : [],
        tags_en: Array.isArray(tags_en) ? tags_en : lang === "en" && Array.isArray(aiTags) ? aiTags : [],
      });
      if (aiCategory && CATEGORIES.includes(aiCategory as Category)) setCategory(aiCategory as Category);

      setAiStatus(filled ? "done" : "failed");
    } catch {
      setAiStatus("failed");
    }
  }

  function handleFileChange(f: File | null) {
    if (!f) return;
    if (!ACCEPTED_TYPES.includes(f.type)) {
      setErrorMsg(copy.errors.unsupportedType);
      return;
    }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      setErrorMsg(copy.errors.tooLarge(MAX_SIZE_MB));
      return;
    }
    setErrorMsg("");
    setFile(f);
    setTitle("");     // clear title — will be filled by AI
    setDesc("");
    setTags("");
    setLocalizedDraft({ title_ko: "", title_en: "", description_ko: "", description_en: "", tags_ko: [], tags_en: [] });
    setImgWidth(null); setImgHeight(null);
    setRotationDegrees(0);
    setFactualityAgreed(false);
    const objectUrl = URL.createObjectURL(f);
    setPreview(objectUrl);
    // Extract image dimensions (skip for TIFF — canvas can't decode it)
    if (f.type !== "image/tiff") {
      const img = new window.Image();
      img.onload = () => { setImgWidth(img.naturalWidth); setImgHeight(img.naturalHeight); };
      img.src = objectUrl;
    }
    setTakenAt(""); setTakenAtSource("manual");
    setLocation(""); setLocationSource("manual");
    setAiStatus("idle");
    setExifData(null);
    runAiAnalysis(f);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFileChange(f);
  }

  const orientedDimensions = rotatedDimensions(imgWidth, imgHeight, rotationDegrees);
  const displayWidth = orientedDimensions.width;
  const displayHeight = orientedDimensions.height;

  const canSubmit =
    !!file &&
    !!title.trim() &&
    !!description.trim() &&
    tags.split(",").map((t) => t.trim()).filter(Boolean).length > 0 &&
    !!takenAt &&
    !!location &&
    !!authorshipDeclaration &&
    factualityAgreed &&
    status !== "uploading" &&
    status !== "saving";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setStatus("uploading");
    setProgress(0);
    setErrorMsg("");

    try {
      const presignRes = await fetch("/api/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file!.name, contentType: file!.type }),
      });
      if (!presignRes.ok) throw new Error("Failed to get upload URL");
      const { uploadUrl, storagePath } = await presignRes.json();

      const xhr = new XMLHttpRequest();
      await new Promise<void>((resolve, reject) => {
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", file!.type);
        xhr.upload.addEventListener("progress", (ev) => {
          if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100));
        });
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload failed: ${xhr.status}`));
        });
        xhr.addEventListener("error", reject);
        xhr.send(file!);
      });
      setProgress(100);

      setStatus("saving");
      const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);

      const saveRes = await fetch("/api/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          original_filename: file!.name,
          title: title.trim(),
          description: description.trim(),
          title_ko: lang === "ko" ? title.trim() : localizedDraft.title_ko,
          title_en: lang === "en" ? title.trim() : localizedDraft.title_en,
          description_ko: lang === "ko" ? description.trim() : localizedDraft.description_ko,
          description_en: lang === "en" ? description.trim() : localizedDraft.description_en,
          tags_ko: lang === "ko" ? tagList : localizedDraft.tags_ko,
          tags_en: lang === "en" ? tagList : localizedDraft.tags_en,
          category,
          tags: tagList,
          storage_path_original: storagePath,
          file_size_mb: parseFloat((file!.size / 1024 / 1024).toFixed(2)),
          file_format: file!.type === "image/tiff" ? "TIFF" : file!.type === "image/jpeg" ? "JPEG" : file!.type.split("/")[1].toUpperCase(),
          width: displayWidth,
          height: displayHeight,
          resolution_mp: displayWidth && displayHeight ? parseFloat(((displayWidth * displayHeight) / 1_000_000).toFixed(1)) : null,
          upload_rotation_degrees: rotationDegrees,
          upload_original_width: imgWidth,
          upload_original_height: imgHeight,
          // 촬영일시: "unknown" → null (TIMESTAMPTZ 불가), 날짜 문자열 → ISO
          exif_taken_at: takenAt === UNKNOWN ? null : takenAt || null,
          exif_taken_at_unknown: takenAt === UNKNOWN,
          // 촬영장소: "unknown" 그대로 저장 가능
          exif_location: location || null,
          exif_lat: exifData?.lat ?? null,
          exif_lng: exifData?.lng ?? null,
          exif_camera: exifData?.camera ?? null,
          copyright_license: copyrightLicense,
          free_usage_policy: freeUsagePolicy,
          attribution_name: attributionName.trim() || null,
          attribution_url: attributionUrl.trim() || null,
          authorship_declaration: authorshipDeclaration,
          factuality_attested: factualityAgreed,
        }),
      });

      if (!saveRes.ok) {
        const err = await saveRes.json();
        throw new Error(err.error ?? "Failed to save");
      }

      setStatus("done");
      setTimeout(() => router.push("/dashboard/uploads"), 1500);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : copy.errors.uploadFailed);
      setStatus("error");
    }
  }

  return (
    <div className="p-6 md:p-10 max-w-2xl">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/dashboard/uploads" className="text-outline hover:text-on-surface transition-colors">
          <span className="material-symbols-outlined text-xl">arrow_back</span>
        </Link>
        <h1 className="font-headline text-2xl font-extrabold text-on-surface tracking-tight">{copy.pageTitle}</h1>
      </div>

      {status === "done" && (
        <div className="flex flex-col items-center py-16 gap-4 text-center">
          <span className="material-symbols-outlined text-6xl text-primary">check_circle</span>
          <h2 className="font-headline text-xl font-extrabold text-on-surface">{copy.doneTitle}</h2>
          <p className="text-on-surface-variant text-sm">{copy.doneBody}</p>
        </div>
      )}

      {status !== "done" && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">

          {/* ── Drop zone ── */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className="cursor-pointer border-2 border-dashed border-outline-variant rounded-xl p-8 flex flex-col items-center gap-4 hover:border-primary hover:bg-primary/5 transition-all"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".tiff,.tif,.jpg,.jpeg,.png,.webp"
              className="sr-only"
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            />
            {preview ? (
              <div className={previewContainerClass(displayWidth, displayHeight)}>
                <Image
                  src={preview}
                  alt="Preview"
                  width={imgWidth ?? 800}
                  height={imgHeight ?? 600}
                  className="w-full h-auto block transition-transform duration-200"
                  style={{
                    transform: rotationDegrees ? `rotate(${rotationDegrees}deg)` : "none",
                  }}
                  unoptimized
                />
              </div>
            ) : (
              <>
                <span className="material-symbols-outlined text-5xl text-outline">cloud_upload</span>
                <div className="text-center">
                  <p className="text-sm font-semibold text-on-surface">{copy.dropTitle}</p>
                  <p className="text-xs text-outline mt-1">{copy.dropHelp}</p>
                </div>
              </>
            )}
          </div>

          {/* ── File info + EXIF ── */}
          {file && (
            <div className="flex flex-col gap-2">
              {/* Filename / size / dimensions */}
              <div className="flex items-center gap-2 text-xs text-outline">
                <span className="material-symbols-outlined text-sm">insert_drive_file</span>
                <span className="font-mono truncate max-w-xs">{file.name}</span>
                <span>·</span>
                <span>{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                {displayWidth && displayHeight && (
                  <>
                    <span>·</span>
                    <span>{displayWidth.toLocaleString()} × {displayHeight.toLocaleString()} px</span>
                  </>
                )}
                {rotationDegrees > 0 && (
                  <>
                    <span>·</span>
                    <span>{rotationDegrees}° {copy.rotated}</span>
                  </>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setRotationDegrees((value) => normalizeRotationDegrees(value + 270))}
                  className="h-9 px-3 rounded-lg border border-outline-variant text-xs font-bold text-on-surface-variant hover:text-on-surface hover:border-outline flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">rotate_left</span>
                  {copy.rotateLeft}
                </button>
                <button
                  type="button"
                  onClick={() => setRotationDegrees((value) => normalizeRotationDegrees(value + 90))}
                  className="h-9 px-3 rounded-lg border border-outline-variant text-xs font-bold text-on-surface-variant hover:text-on-surface hover:border-outline flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">rotate_right</span>
                  {copy.rotateRight}
                </button>
                {rotationDegrees > 0 && (
                  <button
                    type="button"
                    onClick={() => setRotationDegrees(0)}
                    className="h-9 px-3 rounded-lg border border-outline-variant text-xs font-bold text-outline hover:text-on-surface hover:border-outline flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-sm">restart_alt</span>
                    {copy.reset}
                  </button>
                )}
                <span className="text-[11px] text-outline">
                  {copy.rotationHelp}
                </span>
              </div>
              {/* EXIF metadata panel */}
              {exifData && <ExifPanel data={exifData} lang={lang} labels={copy.exifLabels} />}
            </div>
          )}

          {/* AI status */}
          {aiStatus === "analyzing" && (
            <div className="flex items-center gap-2 text-sm text-on-surface-variant">
              <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin inline-block shrink-0" />
              {copy.aiAnalyzing}
            </div>
          )}
          {aiStatus === "done" && (
            <div className="px-4 py-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-base">auto_awesome</span>
              {copy.aiDone}
            </div>
          )}
          {aiStatus === "failed" && (
            <div className="px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-base">info</span>
              {copy.aiFailed}
            </div>
          )}

          {/* Progress */}
          {status === "uploading" && (
            <div>
              <div className="flex justify-between text-xs text-outline mb-1">
                <span>{copy.uploading}</span><span>{progress}%</span>
              </div>
              <div className="h-2 bg-surface-container-low rounded-full overflow-hidden">
                <div className="h-full bg-primary transition-all duration-300 rounded-full" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
          {status === "saving" && (
            <p className="text-xs text-outline flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin inline-block" />
              {copy.saving}
            </p>
          )}

          {/* ── 작품 제목 * (AI 자동생성) ── */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-outline uppercase tracking-widest flex items-center gap-2">
              {copy.title}
              {aiStatus === "done" && title && (
                <span className="normal-case font-normal text-primary text-[10px] bg-primary/10 px-2 py-0.5 rounded-full">{copy.aiGenerated}</span>
              )}
            </label>
            <input
              type="text" required value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder={aiStatus === "analyzing" ? copy.titlePlaceholderAnalyzing : copy.titlePlaceholder}
              className="h-12 bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded-lg px-4 text-sm text-on-surface placeholder:text-outline outline-none transition-all"
            />
          </div>

          {/* ── 설명 * ── */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-outline uppercase tracking-widest">{copy.description}</label>
            <textarea
              required value={description} onChange={(e) => setDesc(e.target.value)}
              rows={3} placeholder={copy.descriptionPlaceholder}
              className="bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded-lg px-4 py-3 text-sm text-on-surface placeholder:text-outline outline-none resize-none transition-all"
            />
          </div>

          {/* ── 카테고리 * ── */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-outline uppercase tracking-widest">{copy.category}</label>
            <select
              required value={category} onChange={(e) => setCategory(e.target.value as Category)}
              className="h-12 bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded-lg px-4 text-sm text-on-surface outline-none transition-all"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
          </div>

          {/* ── 태그 * ── */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-outline uppercase tracking-widest">{copy.tags}</label>
            <input
              type="text" value={tags} onChange={(e) => setTags(e.target.value)}
              placeholder={copy.tagsPlaceholder}
              className="h-12 bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded-lg px-4 text-sm text-on-surface placeholder:text-outline outline-none transition-all"
            />
            {tags && tags.split(",").map((t) => t.trim()).filter(Boolean).length === 0 && (
              <p className="text-xs text-error">{copy.tagsError}</p>
            )}
          </div>

          {/* ── 촬영일시 * ── */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-outline uppercase tracking-widest">
              {copy.shotAt}
              {takenAtSource === "exif" && (
                <span className="ml-2 normal-case font-normal text-primary text-[10px] bg-primary/10 px-2 py-0.5 rounded-full">{copy.exifAuto}</span>
              )}
            </label>
            {takenAt === UNKNOWN ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 h-12 bg-surface-container-low ring-1 ring-outline-variant/50 rounded-lg px-4 flex items-center text-sm text-outline">
                  {copy.unknownFull}
                </div>
                <button
                  type="button"
                  onClick={() => { setTakenAt(""); setTakenAtSource("manual"); }}
                  className="h-12 px-4 text-xs text-outline hover:text-on-surface border border-outline-variant rounded-lg transition-colors"
                >
                  {copy.manualInput}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={takenAt}
                  onChange={(e) => { setTakenAt(e.target.value); setTakenAtSource("manual"); }}
                  className="flex-1 h-12 bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded-lg px-4 text-sm text-on-surface outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => { setTakenAt(UNKNOWN); setTakenAtSource("manual"); }}
                  className="h-12 px-4 text-xs text-outline hover:text-on-surface border border-outline-variant rounded-lg transition-colors whitespace-nowrap"
                >
                  {copy.unknown}
                </button>
              </div>
            )}
            {!takenAt && file && aiStatus !== "analyzing" && (
              <p className="text-xs text-error">{copy.shotAtError}</p>
            )}
          </div>

          {/* ── 촬영장소 * ── */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-outline uppercase tracking-widest">
              {copy.shotLocation}
              {locationSource === "exif" && (
                <span className="ml-2 normal-case font-normal text-primary text-[10px] bg-primary/10 px-2 py-0.5 rounded-full">{copy.exifAuto}</span>
              )}
            </label>
            {location === UNKNOWN ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 h-12 bg-surface-container-low ring-1 ring-outline-variant/50 rounded-lg px-4 flex items-center text-sm text-outline">
                  {copy.unknownFull}
                </div>
                <button
                  type="button"
                  onClick={() => { setLocation(""); setLocationSource("manual"); }}
                  className="h-12 px-4 text-xs text-outline hover:text-on-surface border border-outline-variant rounded-lg transition-colors"
                >
                  {copy.manualInput}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={location}
                  onChange={(e) => { setLocation(e.target.value); setLocationSource("manual"); }}
                  placeholder={copy.locationPlaceholder}
                  className="flex-1 h-12 bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded-lg px-4 text-sm text-on-surface placeholder:text-outline outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => { setLocation(UNKNOWN); setLocationSource("manual"); }}
                  className="h-12 px-4 text-xs text-outline hover:text-on-surface border border-outline-variant rounded-lg transition-colors whitespace-nowrap"
                >
                  {copy.unknown}
                </button>
              </div>
            )}
            {!location && file && aiStatus !== "analyzing" && (
              <p className="text-xs text-error">{copy.locationError}</p>
            )}
          </div>

          {/* ── 저작권/무료 사용 정책 ── */}
          <div className="flex flex-col gap-4 rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-5">
            <div>
              <p className="text-xs font-bold text-outline uppercase tracking-widest">{copy.copyrightTitle}</p>
              <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
                {copy.copyrightHelp}
              </p>
            </div>

            <div className="grid gap-3">
              {copyrightLicenses.map((license) => (
                <label
                  key={license.code}
                  className={[
                    "flex cursor-pointer gap-3 rounded-lg border px-4 py-3 transition-colors",
                    copyrightLicense === license.code
                      ? "border-primary bg-primary/5"
                      : "border-outline-variant/40 bg-surface-container-low hover:border-outline",
                  ].join(" ")}
                >
                  <input
                    type="radio"
                    name="copyright_license"
                    value={license.code}
                    checked={copyrightLicense === license.code}
                    onChange={() => setCopyrightLicense(license.code)}
                    className="mt-1 h-4 w-4 shrink-0 accent-primary"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-on-surface">{license.label}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-on-surface-variant">{license.summary}</span>
                  </span>
                </label>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {freeUsagePolicies.map((policy) => (
                <label
                  key={policy.code}
                  className={[
                    "cursor-pointer rounded-lg border px-4 py-3 transition-colors",
                    freeUsagePolicy === policy.code
                      ? "border-primary bg-primary/5"
                      : "border-outline-variant/40 bg-surface-container-low hover:border-outline",
                  ].join(" ")}
                >
                  <input
                    type="radio"
                    name="free_usage_policy"
                    value={policy.code}
                    checked={freeUsagePolicy === policy.code}
                    onChange={() => setFreeUsagePolicy(policy.code)}
                    className="sr-only"
                  />
                  <span className="block text-sm font-bold text-on-surface">{policy.label}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-on-surface-variant">{policy.summary}</span>
                </label>
              ))}
            </div>

            <p className="text-xs leading-relaxed text-on-surface-variant">
              {copy.freeHelpBefore} <span className="font-semibold text-on-surface">{copy.freeAll}</span> {lang === "ko" ? "또는" : "or"} <span className="font-semibold text-on-surface">{copy.freeEducation}</span>{lang === "ko" ? "" : " "} {copy.freeHelpAfter}
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-outline uppercase tracking-widest">{copy.attributionName}</label>
                <input
                  type="text"
                  value={attributionName}
                  onChange={(e) => setAttributionName(e.target.value)}
                  placeholder={copy.attributionPlaceholder}
                  className="h-11 rounded-lg bg-surface-container-lowest px-4 text-sm text-on-surface outline-none ring-1 ring-outline-variant transition-all placeholder:text-outline focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-outline uppercase tracking-widest">{copy.attributionUrl}</label>
                <input
                  type="url"
                  value={attributionUrl}
                  onChange={(e) => setAttributionUrl(e.target.value)}
                  placeholder="https://..."
                  className="h-11 rounded-lg bg-surface-container-lowest px-4 text-sm text-on-surface outline-none ring-1 ring-outline-variant transition-all placeholder:text-outline focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          {/* ── AI / 오리지널리티 선언 ── */}
          <div className="flex flex-col gap-3 rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-5">
            <div>
              <p className="text-xs font-bold text-outline uppercase tracking-widest">{copy.authorshipTitle}</p>
              <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
                {copy.authorshipHelp}
              </p>
            </div>

            <label
              className={[
                "flex cursor-pointer gap-3 rounded-lg border px-4 py-3 transition-colors",
                authorshipDeclaration === "human_original"
                  ? "border-primary bg-primary/5"
                  : "border-outline-variant/40 bg-surface-container-low hover:border-outline",
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
                <span className="block text-sm font-bold text-on-surface">
                  {copy.humanTitle}
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-on-surface-variant">
                  {copy.humanBody}
                </span>
              </span>
            </label>

            <label
              className={[
                "flex cursor-pointer gap-3 rounded-lg border px-4 py-3 transition-colors",
                authorshipDeclaration === "ai_generated"
                  ? "border-primary bg-primary/5"
                  : "border-outline-variant/40 bg-surface-container-low hover:border-outline",
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
                <span className="mt-0.5 block text-xs leading-relaxed text-on-surface-variant">
                  {copy.aiBody}
                </span>
              </span>
            </label>

            {!authorshipDeclaration && file && (
              <p className="text-xs text-error">{copy.authorshipError}</p>
            )}
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
              <span className="mt-1 block text-xs leading-relaxed text-on-surface-variant">
                {copy.factualityBody}
              </span>
              {!factualityAgreed && file && (
                <span className="mt-2 block text-xs text-error">{copy.factualityError}</span>
              )}
            </span>
          </label>

          {errorMsg && (
            <div className="px-4 py-3 rounded-lg bg-error/10 border border-error/20 text-error text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-base">error</span>
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full py-4 bg-primary text-white font-bold text-xs uppercase tracking-widest rounded hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-base">cloud_upload</span>
            {copy.submit}
          </button>

          <p className="text-xs text-outline text-center leading-relaxed">
            {copy.reviewHelp}
          </p>
        </form>
      )}
    </div>
  );
}
