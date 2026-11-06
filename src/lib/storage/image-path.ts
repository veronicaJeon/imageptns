export const R2_STORAGE_PATH_PREFIX = "r2/";

export type ImageStorageBucket =
  | "images-original"
  | "images-analysis"
  | "images-preview"
  | "images-full";

export type ImageStorageProvider = "supabase" | "r2";

export function imageStorageProvider(path: string | null | undefined): ImageStorageProvider {
  return path?.startsWith(R2_STORAGE_PATH_PREFIX) || path?.startsWith(`thumbs/${R2_STORAGE_PATH_PREFIX}`)
    ? "r2"
    : "supabase";
}

export function r2ImagePath(ownerId: string, objectName: string) {
  return `${R2_STORAGE_PATH_PREFIX}${ownerId}/${objectName}`;
}

export function imageStorageObjectKey(bucket: ImageStorageBucket, path: string) {
  return `${bucket}/${path}`;
}

export function r2PreviewUrl(path: string) {
  return `/api/image-assets/${path.split("/").map(encodeURIComponent).join("/")}`;
}

export function isPublicR2PreviewPath(path: string) {
  if (imageStorageProvider(path) !== "r2" || path.includes("\\") || path.includes("\0")) return false;
  const segments = path.split("/");
  return segments.every((segment) => Boolean(segment) && segment !== "." && segment !== "..");
}
