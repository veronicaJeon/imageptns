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
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  void width;
  void height;
  return `${base}/storage/v1/object/public/images-preview/thumbs/${path}`;
}

export function thumbnailUrlFromPreviewUrl(src: string, width = 320, height = 240): string {
  if (!src) return "";
  void width;
  void height;

  try {
    const url = new URL(src);
    const marker = "/storage/v1/object/public/images-preview/";
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex === -1) return src;

    const objectPath = url.pathname.slice(markerIndex + marker.length);
    if (objectPath.startsWith("thumbs/")) return src;

    url.pathname = `${url.pathname.slice(0, markerIndex)}/storage/v1/object/public/images-preview/thumbs/${objectPath}`;
    url.search = "";
    return url.toString();
  } catch {
    return src;
  }
}
