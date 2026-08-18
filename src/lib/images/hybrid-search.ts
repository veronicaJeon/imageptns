export const HYBRID_SEARCH_MAX_RESULTS = 20;

const DEFAULT_SEMANTIC_WEIGHT = 0.8;
const DEFAULT_VISUAL_WEIGHT = 0.2;
const MAX_VISUAL_DISTANCE_SCORE = 0.25;

export interface SemanticSearchSignal {
  imageId: string;
  cosineSimilarity: number;
}

export interface VisualSearchSignal {
  imageId: string;
  matchKind: "exact" | "close";
  /** Lower is better; this is the score returned by rankVisualMatches. */
  score: number;
}

export interface HybridSearchWeights {
  semantic: number;
  visual: number;
}

export interface HybridSearchResult {
  imageId: string;
  matchKind: "exact" | "hybrid" | "semantic" | "visual";
  score: number;
}

function clamp(value: number, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

function validWeight(value: number) {
  return Number.isFinite(value) && value >= 0;
}

export function rankHybridImageMatches(
  semanticSignals: SemanticSearchSignal[],
  visualSignals: VisualSearchSignal[],
  limit = HYBRID_SEARCH_MAX_RESULTS,
  weights: HybridSearchWeights = { semantic: DEFAULT_SEMANTIC_WEIGHT, visual: DEFAULT_VISUAL_WEIGHT },
): HybridSearchResult[] {
  if (!validWeight(weights.semantic) || !validWeight(weights.visual) || weights.semantic + weights.visual === 0) {
    throw new Error("Hybrid search weights must be finite, non-negative, and not both zero");
  }

  const combined = new Map<string, {
    exact: boolean;
    semantic?: number;
    visual?: number;
  }>();

  for (const signal of semanticSignals) {
    if (!signal.imageId || !Number.isFinite(signal.cosineSimilarity)) continue;
    const current = combined.get(signal.imageId) ?? { exact: false };
    const normalized = clamp((signal.cosineSimilarity + 1) / 2);
    current.semantic = Math.max(current.semantic ?? 0, normalized);
    combined.set(signal.imageId, current);
  }

  for (const signal of visualSignals) {
    if (!signal.imageId || !Number.isFinite(signal.score) || signal.score < 0) continue;
    const current = combined.get(signal.imageId) ?? { exact: false };
    if (signal.matchKind === "exact") current.exact = true;
    current.visual = Math.max(current.visual ?? 0, 1 - clamp(signal.score / MAX_VISUAL_DISTANCE_SCORE));
    combined.set(signal.imageId, current);
  }

  return [...combined.entries()].map(([imageId, signals]): HybridSearchResult => {
    if (signals.exact) return { imageId, matchKind: "exact", score: 1 };

    const activeSemanticWeight = signals.semantic === undefined ? 0 : weights.semantic;
    const activeVisualWeight = signals.visual === undefined ? 0 : weights.visual;
    const activeWeight = activeSemanticWeight + activeVisualWeight;
    const score = activeWeight === 0 ? 0 : (
      (signals.semantic ?? 0) * activeSemanticWeight
      + (signals.visual ?? 0) * activeVisualWeight
    ) / activeWeight;

    return {
      imageId,
      matchKind: signals.semantic !== undefined && signals.visual !== undefined
        ? "hybrid"
        : signals.semantic !== undefined ? "semantic" : "visual",
      score,
    };
  }).sort((left, right) => {
    if (left.matchKind === "exact" && right.matchKind !== "exact") return -1;
    if (left.matchKind !== "exact" && right.matchKind === "exact") return 1;
    return right.score - left.score || left.imageId.localeCompare(right.imageId);
  }).slice(0, Math.min(Math.max(Math.trunc(limit), 1), HYBRID_SEARCH_MAX_RESULTS));
}

export interface SearchEvaluationCase {
  relevantImageIds: readonly string[];
  rankedImageIds: readonly string[];
  /** Optional non-negative relevance grades. Missing relevant IDs default to grade 1. */
  relevanceGrades?: Readonly<Record<string, number>>;
}

export interface SearchEvaluationMetrics {
  evaluatedQueries: number;
  recallAtK: number;
  precisionAtK: number;
  meanReciprocalRank: number;
  normalizedDiscountedCumulativeGainAtK: number;
  irrelevantRateAtK: number;
}

function discountedCumulativeGain(grades: readonly number[]) {
  return grades.reduce((total, grade, index) => total + (2 ** grade - 1) / Math.log2(index + 2), 0);
}

export function evaluateSearchRanking(
  cases: readonly SearchEvaluationCase[],
  k = 10,
): SearchEvaluationMetrics {
  const cutoff = Math.max(1, Math.trunc(k));
  const evaluable = cases.filter((item) => new Set(item.relevantImageIds).size > 0);
  if (evaluable.length === 0) {
    return {
      evaluatedQueries: 0,
      recallAtK: 0,
      precisionAtK: 0,
      meanReciprocalRank: 0,
      normalizedDiscountedCumulativeGainAtK: 0,
      irrelevantRateAtK: 0,
    };
  }

  let recall = 0;
  let precision = 0;
  let reciprocalRank = 0;
  let normalizedDiscountedCumulativeGain = 0;

  for (const item of evaluable) {
    const relevant = new Set(item.relevantImageIds);
    const ranked = [...new Set(item.rankedImageIds)].slice(0, cutoff);
    const relevantRetrieved = ranked.filter((imageId) => relevant.has(imageId)).length;
    recall += relevantRetrieved / relevant.size;
    precision += relevantRetrieved / cutoff;
    const firstRelevantIndex = ranked.findIndex((imageId) => relevant.has(imageId));
    reciprocalRank += firstRelevantIndex < 0 ? 0 : 1 / (firstRelevantIndex + 1);

    const gradeFor = (imageId: string) => {
      if (!relevant.has(imageId)) return 0;
      const grade = item.relevanceGrades?.[imageId] ?? 1;
      return Number.isFinite(grade) ? Math.max(0, grade) : 0;
    };
    const actualDcg = discountedCumulativeGain(ranked.map(gradeFor));
    const idealDcg = discountedCumulativeGain(
      [...relevant].map(gradeFor).sort((left, right) => right - left).slice(0, cutoff),
    );
    normalizedDiscountedCumulativeGain += idealDcg === 0 ? 0 : actualDcg / idealDcg;
  }

  const evaluatedQueries = evaluable.length;
  const precisionAtK = precision / evaluatedQueries;
  return {
    evaluatedQueries,
    recallAtK: recall / evaluatedQueries,
    precisionAtK,
    meanReciprocalRank: reciprocalRank / evaluatedQueries,
    normalizedDiscountedCumulativeGainAtK: normalizedDiscountedCumulativeGain / evaluatedQueries,
    irrelevantRateAtK: 1 - precisionAtK,
  };
}
