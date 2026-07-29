export const ACCEPTED_UPLOAD_TYPES = ["image/jpeg"] as const;
export const MAX_UPLOAD_BATCH_FILES = 20;
export const MAX_UPLOAD_SIZE_MB = 100;

export type UploadFileRejectionReason = "unsupported-type" | "too-large";

export interface UploadFileRejection {
  file: File;
  reason: UploadFileRejectionReason;
}

export interface UploadDraftReadiness {
  id: string;
  title: string;
  description: string;
  categoryCodes: string[];
  tags: string;
  takenAt: string;
  location: string;
  uploadStatus: "idle" | "uploading" | "saving" | "done" | "error";
}

export interface UploadBatchReadinessInput {
  drafts: UploadDraftReadiness[];
  authorshipDeclaration: string;
  factualityAgreed: boolean;
  busy: boolean;
}

export function uploadFileClientId(file: Pick<File, "name" | "size" | "lastModified">) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

export function dedupeUploadFiles(files: File[]) {
  const seen = new Set<string>();
  return files.filter((file) => {
    const id = uploadFileClientId(file);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export function filterAcceptedUploadFiles(files: File[]) {
  const accepted: File[] = [];
  const rejected: UploadFileRejection[] = [];

  for (const file of files) {
    if (!ACCEPTED_UPLOAD_TYPES.includes(file.type as typeof ACCEPTED_UPLOAD_TYPES[number])) {
      rejected.push({ file, reason: "unsupported-type" });
      continue;
    }
    if (file.size > MAX_UPLOAD_SIZE_MB * 1024 * 1024) {
      rejected.push({ file, reason: "too-large" });
      continue;
    }
    accepted.push(file);
  }

  return {
    accepted: dedupeUploadFiles(accepted),
    rejected,
  };
}

export function takeAvailableUploadSlots(files: File[], existingCount: number) {
  const availableCount = Math.max(0, MAX_UPLOAD_BATCH_FILES - existingCount);
  return {
    accepted: files.slice(0, availableCount),
    overflow: files.slice(availableCount),
  };
}

export function initialDraftIdForFiles(files: File[]) {
  return files[0] ? uploadFileClientId(files[0]) : null;
}

export function uploadDraftIsReady(draft: UploadDraftReadiness) {
  return (
    draft.uploadStatus !== "uploading" &&
    draft.uploadStatus !== "saving" &&
    draft.title.trim().length > 0 &&
    draft.description.trim().length > 0 &&
    draft.categoryCodes.length > 0 &&
    draft.tags.split(",").map((tag) => tag.trim()).filter(Boolean).length > 0 &&
    takenAtIsAllowed(draft.takenAt, localTodayDateValue()) &&
    draft.location.trim().length > 0
  );
}

export function canSubmitUploadBatch({
  drafts,
  authorshipDeclaration,
  factualityAgreed,
  busy,
}: UploadBatchReadinessInput) {
  if (busy || !factualityAgreed) return false;
  if (authorshipDeclaration !== "human_original" && authorshipDeclaration !== "ai_generated") return false;

  const pendingDrafts = drafts.filter((draft) => draft.uploadStatus !== "done");
  return pendingDrafts.length > 0 && pendingDrafts.every(uploadDraftIsReady);
}
import { localTodayDateValue, takenAtIsAllowed } from "./taken-at";
