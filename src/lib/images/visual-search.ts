import { hammingDistance, type ImageFingerprint } from "./fingerprint";

export const PHOTO_SEARCH_MAX_RESULTS = 20;
export const PHOTO_SEARCH_MAX_CANDIDATES = 2_000;
export const PHOTO_SEARCH_MAX_FILE_BYTES = 3_500_000;
export const PHOTO_SEARCH_MAX_IMAGE_PIXELS = 3_000_000;

const MAX_PHASH_DISTANCE = 18;
const MAX_DHASH_DISTANCE = 10;
const MAX_ASPECT_RATIO_DELTA = 0.15;

export interface VisualSearchCandidate {
  imageId: string;
  originalSha256: string;
  phash: string;
  dhash: string;
  width: number;
  height: number;
  algorithmVersion: string;
}

export interface RankedVisualMatch {
  imageId: string;
  matchKind: "exact" | "close";
  score: number;
}

function validHash(value: string, length: number) {
  return value.length === length && /^[01]+$/.test(value);
}

function aspectRatioDelta(leftWidth: number, leftHeight: number, rightWidth: number, rightHeight: number) {
  const left = leftWidth / leftHeight;
  const right = rightWidth / rightHeight;
  return Math.abs(left - right) / Math.max(left, right);
}

export function rankVisualMatches(
  query: ImageFingerprint,
  candidates: VisualSearchCandidate[],
  limit = PHOTO_SEARCH_MAX_RESULTS,
): RankedVisualMatch[] {
  if (!validHash(query.phash, 64) || !validHash(query.dhash, 64)) return [];

  return candidates.flatMap((candidate): RankedVisualMatch[] => {
    if (
      candidate.algorithmVersion !== query.algorithmVersion ||
      !validHash(candidate.phash, 64) ||
      !validHash(candidate.dhash, 64) ||
      candidate.width <= 0 ||
      candidate.height <= 0
    ) return [];

    if (candidate.originalSha256 === query.originalSha256) {
      return [{ imageId: candidate.imageId, matchKind: "exact", score: 0 }];
    }

    const phashDistance = hammingDistance(query.phash, candidate.phash);
    const dhashDistance = hammingDistance(query.dhash, candidate.dhash);
    const ratioDelta = aspectRatioDelta(query.width, query.height, candidate.width, candidate.height);
    if (
      phashDistance > MAX_PHASH_DISTANCE ||
      dhashDistance > MAX_DHASH_DISTANCE ||
      ratioDelta > MAX_ASPECT_RATIO_DELTA
    ) return [];

    const score = phashDistance / 64 * 0.65 + dhashDistance / 64 * 0.25 + ratioDelta * 0.1;
    return [{ imageId: candidate.imageId, matchKind: "close", score }];
  }).sort((left, right) => left.score - right.score || left.imageId.localeCompare(right.imageId))
    .slice(0, Math.min(Math.max(limit, 1), PHOTO_SEARCH_MAX_RESULTS));
}
