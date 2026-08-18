import { describe, expect, it } from "vitest";
import {
  createSemanticEvaluationPlan,
  evaluateRecordedSemanticRun,
  percentile95,
} from "./semantic-evaluation-harness";
import { SEMANTIC_MODEL_CANDIDATES } from "./semantic-model-registry";

describe("semantic model evaluation harness", () => {
  it("plans unsupported tracks explicitly instead of assigning a zero score", () => {
    const plan = createSemanticEvaluationPlan(SEMANTIC_MODEL_CANDIDATES);

    expect(plan).toContainEqual({
      modelId: "nvidia:nemotron-embed-vl-1b-v2",
      track: "image-to-image",
      stage: "retrieval",
      status: "unsupported",
    });
    expect(plan).toContainEqual({
      modelId: "nvidia:nemotron-embed-vl-1b-v2",
      track: "text-to-image",
      stage: "retrieval",
      status: "ready",
    });
    expect(plan).toContainEqual({
      modelId: "nvidia:nvclip",
      track: "image-to-image",
      stage: "retrieval",
      status: "benchmark-only",
    });
    expect(plan).toContainEqual({
      modelId: "nvidia-build:gemma-4-31b-it",
      track: "image-to-image",
      stage: "caption-bridge",
      status: "excluded",
    });
    expect(plan).toContainEqual({
      modelId: "nvidia:nemotron-rerank-vl-1b-v2",
      track: "text-to-image",
      stage: "reranking",
      status: "excluded",
    });
  });

  it("evaluates recorded rankings, latency, and failures without external calls", () => {
    const voyage = SEMANTIC_MODEL_CANDIDATES[0];
    const result = evaluateRecordedSemanticRun(voyage, {
      modelId: voyage.id,
      track: "image-to-image",
      stage: "retrieval",
      cases: [{ relevantImageIds: ["a"], rankedImageIds: ["a", "b"] }],
      latencyMilliseconds: [100, 200, 300, 400, 500],
      attemptedRequests: 5,
      failedRequests: 1,
    }, 2);

    expect(result).toMatchObject({
      status: "completed",
      p95LatencyMilliseconds: 500,
      failureRate: 0.2,
      metrics: { recallAtK: 1, precisionAtK: 0.5, meanReciprocalRank: 1 },
    });
  });

  it("returns unsupported before evaluating an incompatible model track", () => {
    const nemotron = SEMANTIC_MODEL_CANDIDATES[2];
    expect(evaluateRecordedSemanticRun(nemotron, {
      modelId: nemotron.id,
      track: "image-to-image",
      stage: "retrieval",
      cases: [],
      latencyMilliseconds: [],
      attemptedRequests: 0,
      failedRequests: 0,
    })).toEqual({ modelId: nemotron.id, track: "image-to-image", stage: "retrieval", status: "unsupported" });
  });

  it("calculates nearest-rank p95 and rejects inconsistent counters", () => {
    expect(percentile95([30, Number.NaN, -1, 10, 20])).toBe(30);
    expect(percentile95([])).toBe(0);

    const voyage = SEMANTIC_MODEL_CANDIDATES[0];
    expect(() => evaluateRecordedSemanticRun(voyage, {
      modelId: voyage.id,
      track: "text-to-image",
      stage: "retrieval",
      cases: [],
      latencyMilliseconds: [],
      attemptedRequests: 1,
      failedRequests: 2,
    })).toThrow("between zero and attemptedRequests");
  });
});
