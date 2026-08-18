import { describe, expect, it } from "vitest";
import { evaluateSearchRanking, rankHybridImageMatches } from "./hybrid-search";

describe("hybrid image search ranking", () => {
  it("always places exact fingerprint matches before stronger semantic matches", () => {
    const result = rankHybridImageMatches(
      [
        { imageId: "semantic-best", cosineSimilarity: 0.99 },
        { imageId: "exact", cosineSimilarity: -0.5 },
      ],
      [{ imageId: "exact", matchKind: "exact", score: 0 }],
    );

    expect(result.map(({ imageId, matchKind }) => ({ imageId, matchKind }))).toEqual([
      { imageId: "exact", matchKind: "exact" },
      { imageId: "semantic-best", matchKind: "semantic" },
    ]);
  });

  it("combines available signals and sorts ties by image id", () => {
    const result = rankHybridImageMatches(
      [
        { imageId: "hybrid", cosineSimilarity: 0.6 },
        { imageId: "semantic-b", cosineSimilarity: 0.4 },
        { imageId: "semantic-a", cosineSimilarity: 0.4 },
      ],
      [{ imageId: "hybrid", matchKind: "close", score: 0.05 }],
    );

    expect(result[0]).toMatchObject({ imageId: "hybrid", matchKind: "hybrid" });
    expect(result.slice(1).map((item) => item.imageId)).toEqual(["semantic-a", "semantic-b"]);
  });

  it("ignores malformed signals, validates weights, and caps results", () => {
    const semantic = Array.from({ length: 25 }, (_, index) => ({
      imageId: `image-${String(index).padStart(2, "0")}`,
      cosineSimilarity: index / 25,
    }));
    semantic.push({ imageId: "invalid", cosineSimilarity: Number.NaN });

    expect(rankHybridImageMatches(semantic, [], 100)).toHaveLength(20);
    expect(() => rankHybridImageMatches([], [], 20, { semantic: 0, visual: 0 })).toThrow("not both zero");
  });
});

describe("semantic search offline evaluation", () => {
  it("calculates recall, precision, MRR, nDCG, and irrelevant rate at k", () => {
    const metrics = evaluateSearchRanking([
      { relevantImageIds: ["a", "b"], rankedImageIds: ["x", "a", "b"] },
      { relevantImageIds: ["c"], rankedImageIds: ["c", "x", "y"] },
    ], 2);

    expect(metrics).toMatchObject({
      evaluatedQueries: 2,
      recallAtK: 0.75,
      precisionAtK: 0.5,
      meanReciprocalRank: 0.75,
      irrelevantRateAtK: 0.5,
    });
    const firstQueryNdcg = (1 / Math.log2(3)) / (1 + 1 / Math.log2(3));
    expect(metrics.normalizedDiscountedCumulativeGainAtK).toBeCloseTo((firstQueryNdcg + 1) / 2);
  });

  it("uses optional graded relevance for nDCG", () => {
    const metrics = evaluateSearchRanking([{
      relevantImageIds: ["best", "okay"],
      rankedImageIds: ["okay", "best"],
      relevanceGrades: { best: 3, okay: 1 },
    }], 2);

    const expected = (1 + 7 / Math.log2(3)) / (7 + 1 / Math.log2(3));
    expect(metrics.normalizedDiscountedCumulativeGainAtK).toBeCloseTo(expected);
  });

  it("returns zero metrics when no ground-truth query is evaluable", () => {
    expect(evaluateSearchRanking([{ relevantImageIds: [], rankedImageIds: ["x"] }])).toEqual({
      evaluatedQueries: 0,
      recallAtK: 0,
      precisionAtK: 0,
      meanReciprocalRank: 0,
      normalizedDiscountedCumulativeGainAtK: 0,
      irrelevantRateAtK: 0,
    });
  });
});
