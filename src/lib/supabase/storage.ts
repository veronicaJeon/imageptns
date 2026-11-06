import { imageStorageProvider, r2PreviewUrl } from "../storage/image-path";

/**
 * Convert a raw Supabase Storage path to a public URL.
 * Works without a client instance (builds URL directly).
 */
export function previewUrl(path: string | null | undefined): string {
  if (!path) return "";
  if (imageStorageProvider(path) === "r2") {
    const assetPath = r2PreviewUrl(path);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    return appUrl ? new URL(assetPath, appUrl).toString() : assetPath;
  }
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${base}/storage/v1/object/public/images-preview/${path}`;
}

export function previewThumbnailUrl(path: string | null | undefined, width = 320, height = 240): string {
  if (!path) return "";
  return thumbnailUrlFromPreviewUrl(previewUrl(path), width, height);
}

export function thumbnailUrlFromPreviewUrl(src: string, width = 320, height = 240): string {
  if (!src) return "";

  try {
    const relative = src.startsWith("/");
    const url = new URL(src, "https://imagepartners.invalid");
    const r2Marker = "/api/image-assets/r2/";
    if (url.pathname.includes(r2Marker)) {
      url.pathname = url.pathname.replace(r2Marker, "/api/image-assets/thumbs/r2/");
      return relative ? `${url.pathname}${url.search}` : url.toString();
    }
    if (url.pathname.includes("/api/image-assets/thumbs/r2/")) {
      return relative ? `${url.pathname}${url.search}` : url.toString();
    }

    const marker = "/storage/v1/object/public/images-preview/";
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex === -1) return src;

    const params = new URLSearchParams({
      src: url.toString(),
      w: String(width),
      h: String(height),
    });
    return `/api/images/thumbnail?${params.toString()}`;
  } catch {
    return src;
  }
}
