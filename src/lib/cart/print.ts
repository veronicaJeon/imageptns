import { thumbnailUrlFromPreviewUrl } from "../supabase/storage";

interface PrintableCartItem {
  src: string;
}

export function cartStatementThumbnailUrl(
  src: string,
  origin: string,
  width = 160,
  height = 120,
): string {
  if (!src) return "";

  const proxied = thumbnailUrlFromPreviewUrl(src, width, height);
  try {
    return new URL(proxied, origin).toString();
  } catch {
    return proxied;
  }
}

export function collectCartStatementThumbnailUrls(
  items: PrintableCartItem[],
  origin: string,
): string[] {
  return items
    .map((item) => cartStatementThumbnailUrl(item.src, origin))
    .filter(Boolean);
}
