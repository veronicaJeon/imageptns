import path from "node:path";
import {
  MAX_UPLOAD_FILE_BYTES,
  MAX_UPLOAD_IMAGE_PIXELS,
} from "./limits";

export { MAX_UPLOAD_FILE_BYTES, MAX_UPLOAD_IMAGE_PIXELS } from "./limits";
export const UPLOAD_SESSION_TTL_MINUTES = 20;

export const ALLOWED_UPLOAD_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/tiff": "tif",
};

export const ALLOWED_SHARP_FORMATS = new Set(["jpeg", "png", "webp", "tiff"]);

export function uploadPathBelongsToUser(storagePath: unknown, userId: string) {
  if (typeof storagePath !== "string" || !storagePath) return false;
  if (storagePath.includes("\\") || storagePath.includes("\0")) return false;

  const normalized = path.posix.normalize(storagePath);
  if (normalized !== storagePath || normalized.startsWith("../") || normalized.startsWith("/")) {
    return false;
  }

  const [ownerId, filename, ...rest] = normalized.split("/");
  return ownerId === userId && Boolean(filename) && rest.length === 0;
}

export function normalizeUploadFileSize(value: unknown) {
  const size = Number(value);
  if (!Number.isInteger(size) || size <= 0 || size > MAX_UPLOAD_FILE_BYTES) {
    return null;
  }
  return size;
}

export function uploadSessionExpiresAt(now = new Date()) {
  return new Date(now.getTime() + UPLOAD_SESSION_TTL_MINUTES * 60 * 1000).toISOString();
}

export function validateImageMetadata(input: {
  format?: string | null;
  width?: number | null;
  height?: number | null;
}) {
  const format = input.format?.toLowerCase() ?? "";
  const width = Number(input.width);
  const height = Number(input.height);

  if (!ALLOWED_SHARP_FORMATS.has(format)) {
    return { ok: false as const, error: "Unsupported image format" };
  }
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    return { ok: false as const, error: "Image dimensions could not be verified" };
  }
  if (width * height > MAX_UPLOAD_IMAGE_PIXELS) {
    return { ok: false as const, error: "Image dimensions are too large" };
  }

  return { ok: true as const, format, width, height };
}
