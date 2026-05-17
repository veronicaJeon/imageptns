"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { extractExif, type ExifData } from "@/lib/utils/exif";

const CATEGORIES = ["nature", "people", "editorial", "urban", "abstract", "architecture"] as const;
type Category = typeof CATEGORIES[number];

const ACCEPTED_TYPES = ["image/tiff", "image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_MB = 500;
const UNKNOWN = "unknown";

// ── Adaptive preview container based on aspect ratio ─────────────────────────
function previewContainerClass(w: number | null, h: number | null): string {
  if (!w || !h) return "w-full max-h-64 overflow-hidden rounded-lg";
  const r = w / h;
  if (r >= 1.35)  return "w-full overflow-hidden rounded-lg";              // landscape
  if (r <= 0.74)  return "max-w-[280px] mx-auto overflow-hidden rounded-lg"; // portrait
  return "max-w-[420px] mx-auto overflow-hidden rounded-lg";              // square-ish
}

// ── EXIF metadata display ─────────────────────────────────────────────────────
function ExifPanel({ data }: { data: ExifData }) {
  const [expanded, setExpanded] = useState(false);

  // Build structured rows
  const rows: { label: string; value: string }[] = [];

  if (data.takenAt)        rows.push({ label: "촬영일시", value: data.takenAt.toLocaleString("ko-KR") });
  if (data.locationLabel)  rows.push({ label: "위치", value: data.locationLabel });
  if (data.lat != null && data.lng != null)
    rows.push({ label: "GPS", value: `${data.lat.toFixed(6)}, ${data.lng.toFixed(6)}` });
  if (data.altitude != null) rows.push({ label: "고도", value: `${data.altitude.toFixed(0)}m` });
  if (data.camera)         rows.push({ label: "카메라", value: data.camera });
  if (data.lensModel)      rows.push({ label: "렌즈", value: data.lensModel });
  if (data.focalLength != null) {
    const fl = `${data.focalLength}mm${data.focalLength35mm ? ` (${data.focalLength35mm}mm 환산)` : ""}`;
    rows.push({ label: "초점거리", value: fl });
  }
  if (data.iso != null)        rows.push({ label: "ISO", value: String(data.iso) });
  if (data.aperture != null)   rows.push({ label: "조리개", value: `f/${data.aperture}` });
  if (data.shutterSpeed)       rows.push({ label: "셔터속도", value: data.shutterSpeed });
  if (data.flash)              rows.push({ label: "플래시", value: data.flash });
  if (data.whiteBalance)       rows.push({ label: "화이트밸런스", value: data.whiteBalance });
  if (data.exposureMode)       rows.push({ label: "노출모드", value: data.exposureMode });
  if (data.meteringMode)       rows.push({ label: "측광모드", value: data.meteringMode });
  if (data.colorSpace)         rows.push({ label: "색공간", value: data.colorSpace });
  if (data.orientation != null) rows.push({ label: "방향", value: String(data.orientation) });
  if (data.software)           rows.push({ label: "소프트웨어", value: data.software });

  // Raw additional fields
  for (const [k, v] of Object.entries(data.rawFields)) {
    if (rows.length >= 40) break;
    const val = v instanceof Date ? v.toLocaleString("ko-KR") : String(v);
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
  const router = useRouter();

  const [file, setFile]         = useState<File | null>(null);
  const [fileName, setFileName] = useState("");   // original filename — read-only display
  const [preview, setPreview]   = useState<string | null>(null);
  const [title, setTitle]       = useState("");
  const [description, setDesc]  = useState("");
  const [category, setCategory] = useState<Category>("nature");
  const [tags, setTags]         = useState("");
  // 촬영일시: ISO date string | "unknown" | ""
  const [takenAt, setTakenAt]   = useState("");
  const [takenAtSource, setTakenAtSource] = useState<"exif" | "manual">("manual");
  // 촬영장소: text | "unknown" | ""
  const [location, setLocation] = useState("");
  const [locationSource, setLocationSource] = useState<"exif" | "manual">("manual");

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
      const img = new Image();
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

      const { title: aiTitle, caption, tags: aiTags, category: aiCategory } = await aiRes.json();
      const filled = !!(aiTitle || caption || (Array.isArray(aiTags) && aiTags.length > 0));

      if (aiTitle) setTitle(aiTitle);
      if (caption) setDesc(caption);
      if (Array.isArray(aiTags) && aiTags.length > 0) setTags(aiTags.join(", "));
      if (aiCategory && CATEGORIES.includes(aiCategory as Category)) setCategory(aiCategory as Category);

      setAiStatus(filled ? "done" : "failed");
    } catch {
      setAiStatus("failed");
    }
  }

  function handleFileChange(f: File | null) {
    if (!f) return;
    if (!ACCEPTED_TYPES.includes(f.type)) {
      setErrorMsg("지원하지 않는 파일 형식입니다. TIFF, JPEG, PNG, WebP만 허용됩니다.");
      return;
    }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      setErrorMsg(`파일 크기는 ${MAX_SIZE_MB}MB를 초과할 수 없습니다.`);
      return;
    }
    setErrorMsg("");
    setFile(f);
    setFileName(f.name);
    setTitle("");     // clear title — will be filled by AI
    setImgWidth(null); setImgHeight(null);
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

  const canSubmit =
    !!file &&
    !!title.trim() &&
    !!description.trim() &&
    tags.split(",").map((t) => t.trim()).filter(Boolean).length > 0 &&
    !!takenAt &&
    !!location &&
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
          category,
          tags: tagList,
          storage_path_original: storagePath,
          file_size_mb: parseFloat((file!.size / 1024 / 1024).toFixed(2)),
          file_format: file!.type === "image/tiff" ? "TIFF" : file!.type === "image/jpeg" ? "JPEG" : file!.type.split("/")[1].toUpperCase(),
          width: imgWidth,
          height: imgHeight,
          resolution_mp: imgWidth && imgHeight ? parseFloat(((imgWidth * imgHeight) / 1_000_000).toFixed(1)) : null,
          // 촬영일시: "unknown" → null (TIMESTAMPTZ 불가), 날짜 문자열 → ISO
          exif_taken_at: takenAt === UNKNOWN ? null : takenAt || null,
          exif_taken_at_unknown: takenAt === UNKNOWN,
          // 촬영장소: "unknown" 그대로 저장 가능
          exif_location: location || null,
          exif_lat: exifData?.lat ?? null,
          exif_lng: exifData?.lng ?? null,
          exif_camera: exifData?.camera ?? null,
        }),
      });

      if (!saveRes.ok) {
        const err = await saveRes.json();
        throw new Error(err.error ?? "Failed to save");
      }

      setStatus("done");
      setTimeout(() => router.push("/dashboard/uploads"), 1500);
    } catch (err: any) {
      setErrorMsg(err.message ?? "업로드 중 오류가 발생했습니다.");
      setStatus("error");
    }
  }

  return (
    <div className="p-6 md:p-10 max-w-2xl">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/dashboard/uploads" className="text-outline hover:text-on-surface transition-colors">
          <span className="material-symbols-outlined text-xl">arrow_back</span>
        </Link>
        <h1 className="font-headline text-2xl font-extrabold text-on-surface tracking-tight">이미지 업로드</h1>
      </div>

      {status === "done" && (
        <div className="flex flex-col items-center py-16 gap-4 text-center">
          <span className="material-symbols-outlined text-6xl text-primary">check_circle</span>
          <h2 className="font-headline text-xl font-extrabold text-on-surface">업로드 완료!</h2>
          <p className="text-on-surface-variant text-sm">이미지가 검토 대기 중입니다. 승인 후 라이브러리에 노출됩니다.</p>
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
              <div className={previewContainerClass(imgWidth, imgHeight)}>
                <img src={preview} alt="Preview" className="w-full h-auto block" />
              </div>
            ) : (
              <>
                <span className="material-symbols-outlined text-5xl text-outline">cloud_upload</span>
                <div className="text-center">
                  <p className="text-sm font-semibold text-on-surface">파일을 드래그하거나 클릭하여 선택</p>
                  <p className="text-xs text-outline mt-1">TIFF, JPEG, PNG, WebP · 최대 500MB</p>
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
                {imgWidth && imgHeight && (
                  <>
                    <span>·</span>
                    <span>{imgWidth.toLocaleString()} × {imgHeight.toLocaleString()} px</span>
                  </>
                )}
              </div>
              {/* EXIF metadata panel */}
              {exifData && <ExifPanel data={exifData} />}
            </div>
          )}

          {/* AI status */}
          {aiStatus === "analyzing" && (
            <div className="flex items-center gap-2 text-sm text-on-surface-variant">
              <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin inline-block shrink-0" />
              AI가 이미지를 분석하고 있어요...
            </div>
          )}
          {aiStatus === "done" && (
            <div className="px-4 py-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-base">auto_awesome</span>
              AI가 내용을 자동으로 채웠어요. 수정하셔도 됩니다.
            </div>
          )}
          {aiStatus === "failed" && (
            <div className="px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-base">info</span>
              AI 분석을 완료하지 못했어요. 직접 입력해 주세요.
            </div>
          )}

          {/* Progress */}
          {status === "uploading" && (
            <div>
              <div className="flex justify-between text-xs text-outline mb-1">
                <span>업로드 중...</span><span>{progress}%</span>
              </div>
              <div className="h-2 bg-surface-container-low rounded-full overflow-hidden">
                <div className="h-full bg-primary transition-all duration-300 rounded-full" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
          {status === "saving" && (
            <p className="text-xs text-outline flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin inline-block" />
              메타데이터 저장 중...
            </p>
          )}

          {/* ── 작품 제목 * (AI 자동생성) ── */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-outline uppercase tracking-widest flex items-center gap-2">
              작품 제목 *
              {aiStatus === "done" && title && (
                <span className="normal-case font-normal text-primary text-[10px] bg-primary/10 px-2 py-0.5 rounded-full">AI 자동생성</span>
              )}
            </label>
            <input
              type="text" required value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder={aiStatus === "analyzing" ? "AI가 제목을 생성 중..." : "작품 제목을 입력하세요 (AI가 자동으로 채워줍니다)"}
              className="h-12 bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded-lg px-4 text-sm text-on-surface placeholder:text-outline outline-none transition-all"
            />
          </div>

          {/* ── 설명 * ── */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-outline uppercase tracking-widest">설명 *</label>
            <textarea
              required value={description} onChange={(e) => setDesc(e.target.value)}
              rows={3} placeholder="이미지에 대한 설명을 입력하세요"
              className="bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded-lg px-4 py-3 text-sm text-on-surface placeholder:text-outline outline-none resize-none transition-all"
            />
          </div>

          {/* ── 카테고리 * ── */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-outline uppercase tracking-widest">카테고리 *</label>
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
            <label className="text-xs font-bold text-outline uppercase tracking-widest">태그 *</label>
            <input
              type="text" value={tags} onChange={(e) => setTags(e.target.value)}
              placeholder="쉼표로 구분 (예: landscape, sunset, korea)"
              className="h-12 bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded-lg px-4 text-sm text-on-surface placeholder:text-outline outline-none transition-all"
            />
            {tags && tags.split(",").map((t) => t.trim()).filter(Boolean).length === 0 && (
              <p className="text-xs text-error">태그를 최소 1개 입력해 주세요.</p>
            )}
          </div>

          {/* ── 촬영일시 * ── */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-outline uppercase tracking-widest">
              촬영일시 *
              {takenAtSource === "exif" && (
                <span className="ml-2 normal-case font-normal text-primary text-[10px] bg-primary/10 px-2 py-0.5 rounded-full">EXIF 자동입력</span>
              )}
            </label>
            {takenAt === UNKNOWN ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 h-12 bg-surface-container-low ring-1 ring-outline-variant/50 rounded-lg px-4 flex items-center text-sm text-outline">
                  미상 (Unknown)
                </div>
                <button
                  type="button"
                  onClick={() => { setTakenAt(""); setTakenAtSource("manual"); }}
                  className="h-12 px-4 text-xs text-outline hover:text-on-surface border border-outline-variant rounded-lg transition-colors"
                >
                  직접입력
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
                  미상
                </button>
              </div>
            )}
            {!takenAt && file && aiStatus !== "analyzing" && (
              <p className="text-xs text-error">촬영일시를 입력하거나 '미상'을 선택하세요.</p>
            )}
          </div>

          {/* ── 촬영장소 * ── */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-outline uppercase tracking-widest">
              촬영장소 *
              {locationSource === "exif" && (
                <span className="ml-2 normal-case font-normal text-primary text-[10px] bg-primary/10 px-2 py-0.5 rounded-full">EXIF 자동입력</span>
              )}
            </label>
            {location === UNKNOWN ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 h-12 bg-surface-container-low ring-1 ring-outline-variant/50 rounded-lg px-4 flex items-center text-sm text-outline">
                  미상 (Unknown)
                </div>
                <button
                  type="button"
                  onClick={() => { setLocation(""); setLocationSource("manual"); }}
                  className="h-12 px-4 text-xs text-outline hover:text-on-surface border border-outline-variant rounded-lg transition-colors"
                >
                  직접입력
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={location}
                  onChange={(e) => { setLocation(e.target.value); setLocationSource("manual"); }}
                  placeholder="예: Seoul, Korea"
                  className="flex-1 h-12 bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded-lg px-4 text-sm text-on-surface placeholder:text-outline outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => { setLocation(UNKNOWN); setLocationSource("manual"); }}
                  className="h-12 px-4 text-xs text-outline hover:text-on-surface border border-outline-variant rounded-lg transition-colors whitespace-nowrap"
                >
                  미상
                </button>
              </div>
            )}
            {!location && file && aiStatus !== "analyzing" && (
              <p className="text-xs text-error">촬영장소를 입력하거나 '미상'을 선택하세요.</p>
            )}
          </div>

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
            검토 제출
          </button>

          <p className="text-xs text-outline text-center leading-relaxed">
            제출한 이미지는 운영팀 검토 후 라이브러리에 노출됩니다. 검토에는 1-3 영업일이 소요됩니다.
          </p>
        </form>
      )}
    </div>
  );
}
