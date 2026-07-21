export const MAX_AI_ANALYZE_REQUEST_BYTES = 4 * 1024 * 1024;
export const MAX_AI_IMAGE_DATA_URL_LENGTH = 3 * 1024 * 1024;

const ALLOWED_AI_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export interface AiAnalyzeBody {
  imageBase64?: string;
  filename?: string;
  language?: "ko" | "en";
  exifData?: {
    locationLabel?: string;
    camera?: string;
    takenAt?: string;
    lat?: number;
    lng?: number;
  };
}

export type AiImageInput = {
  dataUrl: string;
  base64Data: string;
  mimeType: string;
};

export function normalizePositiveLimit(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function requestBodyTooLarge(contentLength: string | null) {
  if (!contentLength) return false;
  const parsed = Number(contentLength);
  return Number.isFinite(parsed) && parsed > MAX_AI_ANALYZE_REQUEST_BYTES;
}

export function parseAiImageInput(value: unknown): AiImageInput {
  if (value === undefined || value === null || value === "") {
    return { dataUrl: "", base64Data: "", mimeType: "image/jpeg" };
  }
  if (typeof value !== "string") {
    throw new Error("imageBase64 must be a data URL");
  }
  if (value.length > MAX_AI_IMAGE_DATA_URL_LENGTH) {
    throw new Error("AI image input is too large");
  }

  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=\r\n]+)$/.exec(value);
  if (!match) throw new Error("imageBase64 must be a valid base64 data URL");

  const mimeType = match[1].toLowerCase();
  if (!ALLOWED_AI_IMAGE_MIME_TYPES.has(mimeType)) {
    throw new Error("Unsupported AI image type");
  }

  return { dataUrl: value, base64Data: match[2], mimeType };
}
