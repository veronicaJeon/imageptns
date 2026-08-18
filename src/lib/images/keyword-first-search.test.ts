import { describe, expect, it } from "vitest";
import {
  DEFAULT_KEYWORD_STRONG_THRESHOLD,
  DEFAULT_SEMANTIC_MIN_SIMILARITY,
  chooseKeywordFirstSearchResults,
  readKeywordFirstSearchThresholds,
} from "./keyword-first-search";

describe("keyword-first search cascade", () => {
  const thresholds = { keywordStrong: 0.2, semanticMinimum: 0.75 };

  it("uses keyword results at the inclusive strong threshold and skips semantic lookup", () => {
    expect(chooseKeywordFirstSearchResults(
      [{ imageId: "keyword", keywordScore: 0.2 }],
      undefined,
      thresholds,
    )).toEqual({
      source: "keyword",
      shouldRequestSemanticFallback: false,
      imageIds: ["keyword"],
    });
  });

  it("requests semantic fallback when every keyword score is below the threshold", () => {
    expect(chooseKeywordFirstSearchResults(
      [{ imageId: "weak", keywordScore: 0.199_999 }],
      undefined,
      thresholds,
    )).toEqual({ source: "none", shouldRequestSemanticFallback: true, imageIds: [] });
  });

  it("is deterministic with default policy and does not read environment state", () => {
    expect(chooseKeywordFirstSearchResults(
      [{ imageId: "default-boundary", keywordScore: DEFAULT_KEYWORD_STRONG_THRESHOLD }],
      undefined,
    )).toMatchObject({ source: "keyword", shouldRequestSemanticFallback: false });
  });

  it("returns only semantic matches at or above the inclusive minimum", () => {
    expect(chooseKeywordFirstSearchResults(
      [],
      [
        { imageId: "below", cosineSimilarity: 0.749_999 },
        { imageId: "boundary", cosineSimilarity: 0.75 },
        { imageId: "best", cosineSimilarity: 0.9 },
      ],
      thresholds,
    )).toEqual({
      source: "semantic",
      shouldRequestSemanticFallback: false,
      imageIds: ["best", "boundary"],
    });
  });

  it("returns no results when both retrieval stages are below their thresholds", () => {
    expect(chooseKeywordFirstSearchResults(
      [{ imageId: "weak-keyword", keywordScore: 0.1 }],
      [{ imageId: "weak-semantic", cosineSimilarity: 0.7 }],
      thresholds,
    )).toEqual({ source: "none", shouldRequestSemanticFallback: false, imageIds: [] });
  });

  it("deduplicates, sorts deterministically, and ignores malformed scores", () => {
    expect(chooseKeywordFirstSearchResults(
      [
        { imageId: "b", keywordScore: 0.5 },
        { imageId: "a", keywordScore: 0.5 },
        { imageId: "a", keywordScore: 0.3 },
        { imageId: "invalid", keywordScore: Number.NaN },
        { imageId: "too-high", keywordScore: 1.1 },
      ],
      undefined,
      thresholds,
    ).imageIds).toEqual(["a", "b"]);
  });
});

describe("keyword-first search threshold configuration", () => {
  it("uses documented defaults when environment values are absent", () => {
    expect(readKeywordFirstSearchThresholds({})).toEqual({
      keywordStrong: DEFAULT_KEYWORD_STRONG_THRESHOLD,
      semanticMinimum: DEFAULT_SEMANTIC_MIN_SIMILARITY,
    });
  });

  it("accepts inclusive zero and one boundaries", () => {
    expect(readKeywordFirstSearchThresholds({
      KEYWORD_SEARCH_STRONG_THRESHOLD: "0",
      SEMANTIC_SEARCH_MIN_SIMILARITY: "1",
    })).toEqual({ keywordStrong: 0, semanticMinimum: 1 });
  });

  it("falls back for non-finite and out-of-range values", () => {
    expect(readKeywordFirstSearchThresholds({
      KEYWORD_SEARCH_STRONG_THRESHOLD: "1.01",
      SEMANTIC_SEARCH_MIN_SIMILARITY: "NaN",
    })).toEqual({
      keywordStrong: DEFAULT_KEYWORD_STRONG_THRESHOLD,
      semanticMinimum: DEFAULT_SEMANTIC_MIN_SIMILARITY,
    });
  });
});
