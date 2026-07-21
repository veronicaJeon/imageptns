export const CANONICAL_HOST = "www.imagepartners.kr";
export const CANONICAL_ORIGIN = `https://${CANONICAL_HOST}`;

const REDIRECT_TO_CANONICAL_HOSTS = new Set([
  "imageptns.vercel.app",
  "imagepartners.kr",
]);

export function getCanonicalRedirectUrl(input: string | URL): URL | null {
  const url = new URL(input.toString());

  if (!REDIRECT_TO_CANONICAL_HOSTS.has(url.hostname)) {
    return null;
  }

  url.protocol = "https:";
  url.hostname = CANONICAL_HOST;
  url.port = "";

  return url;
}

export function getCanonicalRedirectOrigin(origin: string): string {
  try {
    const url = new URL(origin);
    const redirect = getCanonicalRedirectUrl(url);

    return redirect ? redirect.origin : url.origin;
  } catch {
    return origin;
  }
}

export function getSafeRelativePath(
  path: string | null | undefined,
  fallback: string
): string {
  if (!path || !path.startsWith("/") || path.startsWith("//")) {
    return fallback;
  }

  try {
    const safeOrigin = "https://redirect-check.invalid";
    const parsed = new URL(path, safeOrigin);
    if (parsed.origin !== safeOrigin) return fallback;

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function buildSiteUrl(path: string, origin?: string): string {
  const baseOrigin =
    origin ?? (typeof window !== "undefined" ? window.location.origin : CANONICAL_ORIGIN);
  const canonicalOrigin = getCanonicalRedirectOrigin(baseOrigin);

  return new URL(path, canonicalOrigin).toString();
}
