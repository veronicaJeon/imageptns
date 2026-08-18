export const DEFAULT_KEYWORD_STRONG_THRESHOLD = 0.12;
export const DEFAULT_SEMANTIC_MIN_SIMILARITY = 0.72;
export const DEFAULT_KEYWORD_FIRST_THRESHOLDS = Object.freeze({
  keywordStrong: DEFAULT_KEYWORD_STRONG_THRESHOLD,
  semanticMinimum: DEFAULT_SEMANTIC_MIN_SIMILARITY,
});

export interface KeywordSearchSignal {
  imageId: string;
  keywordScore: number;
}

export interface SemanticFallbackSignal {
  imageId: string;
  cosineSimilarity: number;
}

export interface KeywordFirstThresholds {
  keywordStrong: number;
  semanticMinimum: number;
}

export interface KeywordFirstSearchDecision {
  source: "keyword" | "semantic" | "none";
  shouldRequestSemanticFallback: boolean;
  imageIds: string[];
}

type ThresholdEnvironment = Readonly<Record<string, string | undefined>>;

function thresholdFromEnvironment(value: string | undefined, fallback: number) {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : fallback;
}

export function readKeywordFirstSearchThresholds(
  environment: ThresholdEnvironment = process.env,
): KeywordFirstThresholds {
  return {
    keywordStrong: thresholdFromEnvironment(
      environment.KEYWORD_SEARCH_STRONG_THRESHOLD,
      DEFAULT_KEYWORD_STRONG_THRESHOLD,
    ),
    semanticMinimum: thresholdFromEnvironment(
      environment.SEMANTIC_SEARCH_MIN_SIMILARITY,
      DEFAULT_SEMANTIC_MIN_SIMILARITY,
    ),
  };
}

function uniqueRankedIds<T>(
  signals: readonly T[],
  scoreFor: (signal: T) => number,
  idFor: (signal: T) => string,
  minimum: number,
) {
  const strongest = new Map<string, number>();
  for (const signal of signals) {
    const imageId = idFor(signal);
    const score = scoreFor(signal);
    if (!imageId || !Number.isFinite(score) || score < minimum || score > 1) continue;
    strongest.set(imageId, Math.max(strongest.get(imageId) ?? 0, score));
  }
  return [...strongest]
    .sort(([leftId, leftScore], [rightId, rightScore]) =>
      rightScore - leftScore || leftId.localeCompare(rightId))
    .map(([imageId]) => imageId);
}

/**
 * Applies a strict cascade: a strong keyword hit suppresses semantic lookup;
 * semantic results are considered only after the caller observes the fallback
 * request and supplies them in a second call.
 */
export function chooseKeywordFirstSearchResults(
  keywordSignals: readonly KeywordSearchSignal[],
  semanticSignals: readonly SemanticFallbackSignal[] | undefined,
  thresholds: KeywordFirstThresholds = DEFAULT_KEYWORD_FIRST_THRESHOLDS,
): KeywordFirstSearchDecision {
  const keywordImageIds = uniqueRankedIds(
    keywordSignals,
    (signal) => signal.keywordScore,
    (signal) => signal.imageId,
    thresholds.keywordStrong,
  );
  if (keywordImageIds.length > 0) {
    return { source: "keyword", shouldRequestSemanticFallback: false, imageIds: keywordImageIds };
  }

  if (semanticSignals === undefined) {
    return { source: "none", shouldRequestSemanticFallback: true, imageIds: [] };
  }

  const semanticImageIds = uniqueRankedIds(
    semanticSignals,
    (signal) => signal.cosineSimilarity,
    (signal) => signal.imageId,
    thresholds.semanticMinimum,
  );
  return semanticImageIds.length > 0
    ? { source: "semantic", shouldRequestSemanticFallback: false, imageIds: semanticImageIds }
    : { source: "none", shouldRequestSemanticFallback: false, imageIds: [] };
}
