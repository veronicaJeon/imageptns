/**
 * Convert a raw Supabase Storage path to a public URL.
 * Works without a client instance (builds URL directly).
 */
export function previewUrl(path: string | null | undefined): string {
  if (!path) return "";
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
    const url = new URL(src);
    const marker = "/storage/v1/object/public/images-preview/";
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex === -1) return src;

    const params = new URLSearchParams({
      src: url.toString(),
      w: String(width),
      h: String(height),
      wm: "1",
    });
    return `/api/images/thumbnail?${params.toString()}`;
  } catch {
    return src;
  }
}
