export type SearchOrientation = "landscape" | "portrait" | "square";
export type OrientationFilter = SearchOrientation | "all";

export interface ParsedOrientationSearch {
  textQuery: string;
  orientation: SearchOrientation | null;
  conflictingOrientations: boolean;
}

export interface ResolvedOrientationSearch {
  textQuery: string;
  effectiveOrientation: OrientationFilter;
  conflictingOrientations: boolean;
}

const SINGLE_TOKEN_ORIENTATIONS: Record<string, SearchOrientation> = {
  "가로": "landscape",
  "가로형": "landscape",
  "가로사진": "landscape",
  "가로이미지": "landscape",
  horizontal: "landscape",
  "세로": "portrait",
  "세로형": "portrait",
  "세로사진": "portrait",
  "세로이미지": "portrait",
  vertical: "portrait",
  "정사각형": "square",
  "정방형": "square",
  "스퀘어": "square",
  square: "square",
};

const ORIENTATION_PHRASES: Array<{
  tokens: readonly string[];
  orientation: SearchOrientation;
}> = [
  { tokens: ["가로", "사진"], orientation: "landscape" },
  { tokens: ["가로", "이미지"], orientation: "landscape" },
  { tokens: ["세로", "사진"], orientation: "portrait" },
  { tokens: ["세로", "이미지"], orientation: "portrait" },
  { tokens: ["정사각형", "사진"], orientation: "square" },
  { tokens: ["정사각형", "이미지"], orientation: "square" },
  { tokens: ["정방형", "사진"], orientation: "square" },
  { tokens: ["정방형", "이미지"], orientation: "square" },
  { tokens: ["스퀘어", "사진"], orientation: "square" },
  { tokens: ["스퀘어", "이미지"], orientation: "square" },
  { tokens: ["landscape", "orientation"], orientation: "landscape" },
  { tokens: ["portrait", "orientation"], orientation: "portrait" },
  { tokens: ["square", "orientation"], orientation: "square" },
];

function normalizedToken(token: string) {
  return token
    .toLocaleLowerCase("en-US")
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

export function parseOrientationSearch(query: string): ParsedOrientationSearch {
  const rawTokens = query.trim().split(/\s+/).filter(Boolean);
  const normalizedTokens = rawTokens.map(normalizedToken);
  const removedIndexes = new Set<number>();
  const orientations = new Set<SearchOrientation>();

  for (let index = 0; index < normalizedTokens.length; index += 1) {
    const phrase = ORIENTATION_PHRASES.find(({ tokens }) =>
      tokens.every((token, tokenIndex) => normalizedTokens[index + tokenIndex] === token),
    );
    if (!phrase) continue;

    phrase.tokens.forEach((_, tokenIndex) => removedIndexes.add(index + tokenIndex));
    orientations.add(phrase.orientation);
    index += phrase.tokens.length - 1;
  }

  normalizedTokens.forEach((token, index) => {
    if (removedIndexes.has(index)) return;
    const orientation = SINGLE_TOKEN_ORIENTATIONS[token];
    if (!orientation) return;
    removedIndexes.add(index);
    orientations.add(orientation);
  });

  // Landscape and portrait can describe a subject in English. Treat those
  // ambiguous words as orientation only when the whole query is that word.
  if (rawTokens.length === 1 && orientations.size === 0) {
    const ambiguousOrientation = normalizedTokens[0] === "landscape"
      ? "landscape"
      : normalizedTokens[0] === "portrait"
        ? "portrait"
        : null;
    if (ambiguousOrientation) {
      removedIndexes.add(0);
      orientations.add(ambiguousOrientation);
    }
  }

  return {
    textQuery: rawTokens.filter((_, index) => !removedIndexes.has(index)).join(" "),
    orientation: orientations.size === 1 ? [...orientations][0] : null,
    conflictingOrientations: orientations.size > 1,
  };
}

export function resolveOrientationSearch(
  query: string,
  selectedOrientation: OrientationFilter,
): ResolvedOrientationSearch {
  const parsed = parseOrientationSearch(query);
  const filterConflict = selectedOrientation !== "all" &&
    parsed.orientation !== null &&
    selectedOrientation !== parsed.orientation;

  return {
    textQuery: parsed.textQuery,
    effectiveOrientation: selectedOrientation === "all"
      ? parsed.orientation ?? "all"
      : selectedOrientation,
    conflictingOrientations: parsed.conflictingOrientations || filterConflict,
  };
}
