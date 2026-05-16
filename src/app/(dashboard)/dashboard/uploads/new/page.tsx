"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { extractExif, type ExifData } from "@/lib/utils/exif";

const CATEGORIES = ["nature", "people", "editorial", "urban", "abstract", "architecture"] as const;
type Category = typeof CATEGORIES[number];

const ACCEPTED_TYPES = ["image/tiff", "image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_MB = 500;

export default function NewUploadPage() {
  const router = useRouter();

  const [file, setFile]         = useState<File | null>(null);
  const [preview, setPreview]   = useState<string | null>(null);
  const [title, setTitle]       = useState("");
  const [description, setDesc]  = useState("");
  const [category, setCategory] = useState<Category>("nature");
  const [tags, setTags]         = useState("");
  const [progress, setProgress] = useState(0);
  const [status, setStatus]     = useState<"idle" | "uploading" | "saving" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [aiStatus, setAiStatus] = useState<"idle" | "analyzing" | "done" | "failed">("idle");
  const [exifData, setExifData] = useState<ExifData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function runAiAnalysis(f: File) {
    setAiStatus("analyzing");
    try {
      // Convert file to base64 data URL
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(f);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
      });

      // Run EXIF extraction and AI analysis in parallel
      const [exif, aiRes] = await Promise.all([
        extractExif(f),
        fetch("/api/ai/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: base64 }),
        }),
      ]);

      setExifData(exif);

      if (aiRes.ok) {
        const { caption, tags: aiTags } = await aiRes.json();
        if (caption) setDesc(caption);
        if (Array.isArray(aiTags) && aiTags.length > 0) setTags(aiTags.join(", "));
      }

      setAiStatus("done");
    } catch {
      // Silently fail — leave fields empty
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
    const url = URL.createObjectURL(f);
    setPreview(url);
    // Auto-fill title from filename
    if (!title) setTitle(f.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "));
    // Trigger AI analysis
    setAiStatus("idle");
    setExifData(null);
    runAiAnalysis(f);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFileChange(f);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !title || !category) return;
    setStatus("uploading");
    setProgress(0);
    setErrorMsg("");

    try {
      // 1. Get presigned upload URL
      const presignRes = await fetch("/api/uploads/presign", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
      });
      if (!presignRes.ok) throw new Error("Failed to get upload URL");
      const { uploadUrl, storagePath } = await presignRes.json();

      // 2. Upload directly to Supabase Storage
      const xhr = new XMLHttpRequest();
      await new Promise<void>((resolve, reject) => {
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.upload.addEventListener("progress", (ev) => {
          if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100));
        });
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload failed: ${xhr.status}`));
        });
        xhr.addEventListener("error", reject);
        xhr.send(file);
      });
      setProgress(100);

      // 3. Create image record in DB
      setStatus("saving");
      const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);

      const saveRes = await fetch("/api/uploads", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description || null,
          category,
          tags: tagList,
          storage_path_original: storagePath,
          file_size_mb: parseFloat((file.size / 1024 / 1024).toFixed(2)),
          file_format: file.type === "image/tiff" ? "TIFF" : file.type === "image/jpeg" ? "JPEG" : file.type.split("/")[1].toUpperCase(),
          exif_taken_at: exifData?.takenAt?.toISOString() ?? null,
          exif_lat: exifData?.lat ?? null,
          exif_lng: exifData?.lng ?? null,
          exif_location: exifData?.locationLabel ?? null,
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
        <h1 className="font-headline text-2xl font-extrabold text-on-surface tracking-tight">
          이미지 업로드
        </h1>
      </div>

      {/* Success */}
      {status === "done" && (
        <div className="flex flex-col items-center py-16 gap-4 text-center">
          <span className="material-symbols-outlined text-6xl text-primary">check_circle</span>
          <h2 className="font-headline text-xl font-extrabold text-on-surface">업로드 완료!</h2>
          <p className="text-on-surface-variant text-sm">이미지가 검토 대기 중입니다. 승인 후 라이브러리에 노출됩니다.</p>
        </div>
      )}

      {status !== "done" && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">

          {/* File drop zone */}
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
              <div className="w-full max-h-64 overflow-hidden rounded-lg">
                <img src={preview} alt="Preview" className="w-full h-full object-contain" />
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

          {file && (
            <p className="text-xs text-outline">
              {file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB
            </p>
          )}

          {/* AI analysis status */}
          {aiStatus === "analyzing" && (
            <div className="flex items-center gap-2 text-sm text-on-surface-variant">
              <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin inline-block shrink-0" />
              AI가 이미지를 분석하고 있어요...
            </div>
          )}

          {aiStatus === "done" && (
            <div className="px-4 py-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm">
              AI가 내용을 자동으로 채웠어요. 수정하셔도 됩니다.
            </div>
          )}

          {/* Upload progress */}
          {status === "uploading" && (
            <div>
              <div className="flex justify-between text-xs text-outline mb-1">
                <span>업로드 중...</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 bg-surface-container-low rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
          {status === "saving" && (
            <p className="text-xs text-outline flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin inline-block" />
              메타데이터 저장 중...
            </p>
          )}

          {/* Metadata */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-outline uppercase tracking-widest">제목 *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="이미지 제목을 입력하세요"
              className="h-12 bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded-lg px-4 text-sm text-on-surface placeholder:text-outline outline-none transition-all"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-outline uppercase tracking-widest">설명</label>
            <textarea
              value={description}
              onChange={(e) => setDesc(e.target.value)}
              rows={3}
              placeholder="이미지에 대한 설명 (선택)"
              className="bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded-lg px-4 py-3 text-sm text-on-surface placeholder:text-outline outline-none resize-none transition-all"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-outline uppercase tracking-widest">카테고리 *</label>
            <select
              required
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              className="h-12 bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded-lg px-4 text-sm text-on-surface outline-none transition-all"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c} className="capitalize">{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-outline uppercase tracking-widest">태그</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="쉼표로 구분 (예: landscape, sunset, korea)"
              className="h-12 bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded-lg px-4 text-sm text-on-surface placeholder:text-outline outline-none transition-all"
            />
          </div>

          {/* EXIF info display */}
          {exifData && (exifData.takenAt || exifData.camera || exifData.locationLabel) && (
            <div className="rounded-lg bg-surface-container-low border border-outline-variant px-4 py-3 flex flex-col gap-1 text-xs text-on-surface-variant">
              {exifData.camera && (
                <span>📷 카메라: {exifData.camera}</span>
              )}
              {exifData.takenAt && (
                <span>
                  📅 촬영일시: {exifData.takenAt.toLocaleDateString("ko-KR", {
                    year: "numeric", month: "2-digit", day: "2-digit",
                  })}
                </span>
              )}
              {exifData.locationLabel && (
                <span>📍 위치: {exifData.locationLabel}</span>
              )}
            </div>
          )}

          {errorMsg && (
            <div className="px-4 py-3 rounded-lg bg-error/10 border border-error/20 text-error text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-base">error</span>
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={!file || !title || status === "uploading" || status === "saving"}
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
