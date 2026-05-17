/**
 * Convert a raw Supabase Storage path to a public URL.
 * Works without a client instance (builds URL directly).
 */
export function previewUrl(path: string | null | undefined): string {
  if (!path) return "";
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${base}/storage/v1/object/public/images-preview/${path}`;
}
